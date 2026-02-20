// ============================================================
// sync.js — Main orchestration: fetch → parse → update → delete
// ============================================================

import 'dotenv/config';
import {
  loginBot, destroyBot, fetchMessages, deleteMessage,
  fetchWebhookMessage, postWebhookMessage, editWebhookMessage,
  fetchStateMessage, createStateMessage, updateStateMessage,
  sleep,
} from './discord.js';
import { parseMessage } from './parser.js';
import { decodeState, encodeState, stateMarker } from './storage.js';
import { upsertPlayer } from './storage.js';
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
        // Show WHY the message was skipped — very useful for debugging
        const preview = msg.content.slice(0, 120).replace(/\n/g, '↵');
        const hasPrefix = /^LB_UPDATE_(MR|OW|DL):/i.test(msg.content.trim());
        if (hasPrefix) {
          console.warn(`[sync] ⚠️  PARSE FAILED (has LB prefix but failed validation):`);
          console.warn(`         "${preview}"`);
        } else {
          console.log(`[sync] Skipping non-LB message: "${preview}"`);
        }
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

  // 3a. Load current state from pinned message in listening channel
  let stateMsg = null;
  try {
    stateMsg = await fetchStateMessage(CONFIG.listeningChannelId, gameType);
  } catch (err) {
    console.warn(`[sync] ${gameType}: Could not fetch pinned state message: ${err.message}`);
  }

  const state = decodeState(stateMsg?.content ?? null);
  console.log(`[sync] ${gameType}: ${state.players.length} existing player(s) in state`);

  // 3b. Apply each update & delete source messages
  for (const { msg, data } of updates) {
    try {
      const updated = upsertPlayer(state.players, data);
      if (updated) {
        console.log(`[sync] ${gameType}: Updated player ${data.playerName}`);
        stats.processed++;
      } else {
        console.log(`[sync] ${gameType}: Skipped stale update for ${data.playerName}`);
      }

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
    }
  }

  // 3c. Sort & render (clean display only — no JSON)
  const sorted = cfg.sortFn(state.players);
  const rendered = renderLeaderboard(sorted, gameType);

  // 3d. Post or edit the public webhook leaderboard message
  try {
    if (cfg.messageId) {
      await editWebhookMessage(cfg.webhookUrl, cfg.messageId, rendered);
    } else {
      const newId = await postWebhookMessage(cfg.webhookUrl, rendered);
      console.log(`\n[sync] ⚠️  NEW MESSAGE ID for ${gameType}: ${newId}`);
      const secretKey = {
        MARVEL_RIVALS: 'MARVEL_RIVALS_MESSAGE_ID',
        OVERWATCH:     'OVERWATCH_MESSAGE_ID',
        DEADLOCK:      'DEADLOCK_MESSAGE_ID',
      }[gameType];
      console.log(`[sync] ⚠️  Add to your .env and GitHub Secrets: ${secretKey}=${newId}\n`);
      cfg.messageId = newId;
    }
  } catch (err) {
    console.error(`[sync] ${gameType}: Failed to update webhook message:`, err.message);
    stats.errors++;
  }

  // 3e. Save updated state to pinned message in listening channel
  try {
    const newStateContent = encodeState(gameType, { players: state.players });
    if (stateMsg) {
      await updateStateMessage(CONFIG.listeningChannelId, stateMsg.id, newStateContent);
    } else {
      await createStateMessage(CONFIG.listeningChannelId, newStateContent);
    }
  } catch (err) {
    console.error(`[sync] ${gameType}: Failed to save state:`, err.message);
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
