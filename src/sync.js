// ============================================================
// sync.js — Main orchestration: fetch → parse → update → delete
// ============================================================

import 'dotenv/config';
import {
  loginBot, destroyBot, fetchMessages, deleteMessage,
  fetchWebhookMessage, postWebhookMessage, editWebhookMessage, sleep,
} from './discord.js';
import { parseMessage } from './parser.js';
import { decodeState, encodeState, upsertPlayer } from './storage.js';
import {
  renderLeaderboard,
  sortMarvelRivals, sortOverwatch, sortDeadlock,
} from './renderer.js';

// ── Config ────────────────────────────────────────────────────

const CONFIG = {
  token:              requireEnv('DISCORD_TOKEN'),
  listeningChannelId: requireEnv('LISTENING_CHANNEL_ID'),
  games: {
    MARVEL_RIVALS: {
      webhookUrl: requireEnv('MARVEL_RIVALS_WEBHOOK_URL'),
      messageId:  process.env.MARVEL_RIVALS_MESSAGE_ID || null,
      sortFn:     sortMarvelRivals,
    },
    OVERWATCH: {
      webhookUrl: requireEnv('OVERWATCH_WEBHOOK_URL'),
      messageId:  process.env.OVERWATCH_MESSAGE_ID || null,
      sortFn:     sortOverwatch,
    },
    DEADLOCK: {
      webhookUrl: requireEnv('DEADLOCK_WEBHOOK_URL'),
      messageId:  process.env.DEADLOCK_MESSAGE_ID || null,
      sortFn:     sortDeadlock,
    },
  },
};

const API_DELAY = parseInt(process.env.API_DELAY_MS ?? '1000', 10);

// ── Entry point ───────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log('═══════════════════════════════════════');
  console.log('  Discord Leaderboard Sync — Starting  ');
  console.log(`  ${new Date().toUTCString()}`);
  console.log('═══════════════════════════════════════');

  let bot;
  try {
    bot = await loginBot(CONFIG.token);

    // ── Step 1: Fetch all messages from listening channel ──────
    const messages = await fetchMessages(CONFIG.listeningChannelId);
    if (messages.length === 0) {
      console.log('[sync] No messages to process.');
      return;
    }

    // ── Step 2: Parse & group by game ─────────────────────────
    const byGame = {
      MARVEL_RIVALS: [],
      OVERWATCH:     [],
      DEADLOCK:      [],
    };
    const unparsed = [];

    for (const msg of messages) {
      const parsed = parseMessage(msg.content);
      if (parsed) {
        byGame[parsed.game].push({ msg, data: parsed });
      } else {
        unparsed.push(msg);
      }
    }

    console.log(
      `[sync] Parsed — MR: ${byGame.MARVEL_RIVALS.length}, ` +
      `OW: ${byGame.OVERWATCH.length}, DL: ${byGame.DEADLOCK.length}, ` +
      `Skipped: ${unparsed.length}`
    );

    // ── Step 3: Process each game independently ────────────────
    const gameResults = {};
    for (const [gameType, updates] of Object.entries(byGame)) {
      if (updates.length === 0) {
        console.log(`[sync] ${gameType}: no updates.`);
        continue;
      }

      const result = await processGame(gameType, updates);
      gameResults[gameType] = result;
      await sleep(API_DELAY);
    }

    // ── Step 4: Summary ───────────────────────────────────────
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('═══════════════════════════════════════');
    console.log(`  Sync complete in ${elapsed}s`);
    for (const [game, result] of Object.entries(gameResults)) {
      console.log(`  ${game}: ${result.processed} processed, ${result.deleted} deleted, ${result.errors} errors`);
    }
    console.log('═══════════════════════════════════════');

  } catch (err) {
    console.error('[sync] Fatal error:', err);
    process.exit(1);
  } finally {
    if (bot) await destroyBot();
  }
}

// ── Per-game processing ───────────────────────────────────────

async function processGame(gameType, updates) {
  const cfg = CONFIG.games[gameType];
  const stats = { processed: 0, deleted: 0, errors: 0 };

  console.log(`\n[sync] ── Processing ${gameType} (${updates.length} update(s)) ──`);

  // 3a. Load current state from webhook message
  let currentContent = null;
  try {
    currentContent = await fetchWebhookMessage(cfg.webhookUrl, cfg.messageId);
    console.log(`[sync] ${gameType}: Loaded existing webhook message`);
  } catch (err) {
    console.warn(`[sync] ${gameType}: Could not fetch webhook message, starting fresh: ${err.message}`);
  }

  const state = decodeState(currentContent);
  console.log(`[sync] ${gameType}: ${state.players.length} existing player(s) in state`);

  // 3b. Apply each update & delete source messages
  const successfulDeletes = [];

  for (const { msg, data } of updates) {
    try {
      const updated = upsertPlayer(state.players, data);
      if (updated) {
        console.log(`[sync] ${gameType}: Updated player ${data.playerName}`);
        stats.processed++;
      } else {
        console.log(`[sync] ${gameType}: Skipped stale update for ${data.playerName}`);
      }

      // Delete the source message
      await sleep(API_DELAY);
      const deleted = await deleteMessage(msg);
      if (deleted) {
        console.log(`[sync] ✓ Deleted message ${msg.id}`);
        stats.deleted++;
      } else {
        console.error(`[sync] ✗ Failed to delete message ${msg.id}`);
        stats.errors++;
      }
    } catch (err) {
      console.error(`[sync] ${gameType}: Error processing message ${msg.id}:`, err.message);
      stats.errors++;
      // Do NOT delete if processing failed
    }
  }

  // 3c. Sort
  const sorted = cfg.sortFn(state.players);

  // 3d. Render human-readable portion
  const humanReadable = renderLeaderboard(sorted, gameType);

  // 3e. Append hidden state block
  const fullContent = `${humanReadable}\n${encodeState({ players: state.players })}`;

  // 3f. Post or edit webhook message
  try {
    if (cfg.messageId) {
      await editWebhookMessage(cfg.webhookUrl, cfg.messageId, fullContent);
    } else {
      const newId = await postWebhookMessage(cfg.webhookUrl, fullContent);
      // Print so the operator can persist the ID in GitHub Secrets
      console.log(`\n[sync] ⚠️  NEW MESSAGE ID for ${gameType}: ${newId}`);
      console.log(`[sync] ⚠️  Add this to your GitHub Secrets / .env as:`);
      const secretKey = {
        MARVEL_RIVALS: 'MARVEL_RIVALS_MESSAGE_ID',
        OVERWATCH:     'OVERWATCH_MESSAGE_ID',
        DEADLOCK:      'DEADLOCK_MESSAGE_ID',
      }[gameType];
      console.log(`        ${secretKey}=${newId}\n`);
      // Update in-memory config so subsequent loops in same run use correct ID
      cfg.messageId = newId;
    }
  } catch (err) {
    console.error(`[sync] ${gameType}: Failed to update webhook message:`, err.message);
    stats.errors++;
  }

  return stats;
}

// ── Utilities ─────────────────────────────────────────────────

function requireEnv(key) {
  const val = process.env[key];
  if (!val) {
    console.error(`[sync] Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return val;
}

// ── Run ───────────────────────────────────────────────────────

main().catch(err => {
  console.error('[sync] Unhandled error:', err);
  process.exit(1);
});
