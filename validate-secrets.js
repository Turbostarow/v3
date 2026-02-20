#!/usr/bin/env node
// ============================================================
// tests/validate-secrets.js
//
// Run this after deployment to verify all required GitHub
// Secrets are present and structurally valid. It does NOT
// make destructive API calls — it uses read-only checks only.
//
// Usage:
//   npm run test:secrets
//   node tests/validate-secrets.js
//
// In GitHub Actions this runs automatically as part of the
// post-deploy validation job.
// ============================================================

import 'dotenv/config';

// ── ANSI colours ──────────────────────────────────────────────

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

const ok   = msg => console.log(`  ${GREEN}✅ ${msg}${RESET}`);
const fail = msg => console.error(`  ${RED}❌ ${msg}${RESET}`);
const warn = msg => console.warn(`  ${YELLOW}⚠️  ${msg}${RESET}`);
const info = msg => console.log(`  ${CYAN}ℹ️  ${msg}${RESET}`);

// ── Validation helpers ────────────────────────────────────────

let failures = 0;

function check(condition, successMsg, failMsg) {
  if (condition) {
    ok(successMsg);
  } else {
    fail(failMsg);
    failures++;
  }
}

function checkPresent(key, description) {
  const val = process.env[key];
  check(
    val && val.trim() !== '',
    `${key} is set`,
    `${key} is MISSING — ${description}`
  );
  return val;
}

/** Check a Discord webhook URL is structurally valid */
function isValidWebhookUrl(url) {
  if (!url) return false;
  const WEBHOOK_PATTERN = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
  return WEBHOOK_PATTERN.test(url.trim());
}

/** Check a Discord snowflake ID (pure digits, 17–20 chars) */
function isValidSnowflake(id) {
  if (!id || id.trim() === '') return null; // optional = null means "not set"
  return /^\d{17,20}$/.test(id.trim());
}

/** Check a Discord bot token (basic structure: parts separated by dots) */
function isValidBotToken(token) {
  if (!token) return false;
  // Bot tokens: <base64_id>.<timestamp>.<hmac> — at least 2 dots, 50+ chars
  const parts = token.split('.');
  return parts.length >= 3 && token.length >= 50;
}

// ── Live API checks ───────────────────────────────────────────

/**
 * Verify a webhook URL is reachable and valid by hitting the
 * webhook info endpoint (GET, no destructive action).
 */
async function checkWebhookReachable(name, webhookUrl) {
  if (!webhookUrl) return;
  const match = webhookUrl.match(/webhooks\/(\d+)\/([\w-]+)/);
  if (!match) return;
  const [, id, token] = match;
  const url = `https://discord.com/api/v10/webhooks/${id}/${token}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      ok(`${name} webhook is LIVE — channel: "${data.channel_id}", name: "${data.name}"`);
    } else if (res.status === 401 || res.status === 403) {
      fail(`${name} webhook token is INVALID or deleted (HTTP ${res.status})`);
      failures++;
    } else if (res.status === 404) {
      fail(`${name} webhook NOT FOUND (HTTP 404) — webhook may have been deleted`);
      failures++;
    } else {
      warn(`${name} webhook returned HTTP ${res.status} — check manually`);
    }
  } catch (err) {
    fail(`${name} webhook unreachable: ${err.message}`);
    failures++;
  }
}

/**
 * Verify bot token by calling the Discord /users/@me endpoint.
 */
async function checkBotToken(token) {
  if (!token) return;
  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      ok(`DISCORD_TOKEN is VALID — bot: "${data.username}#${data.discriminator || '0'}" (ID: ${data.id})`);
    } else if (res.status === 401) {
      fail('DISCORD_TOKEN is INVALID — bot token rejected by Discord (HTTP 401)');
      failures++;
    } else {
      warn(`DISCORD_TOKEN check returned HTTP ${res.status} — check manually`);
    }
  } catch (err) {
    fail(`DISCORD_TOKEN check failed: ${err.message}`);
    failures++;
  }
}

/**
 * Verify the bot can see the listening channel.
 */
async function checkListeningChannel(token, channelId) {
  if (!token || !channelId) return;
  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      ok(`LISTENING_CHANNEL_ID is accessible — "#${data.name}" in guild "${data.guild_id}"`);
    } else if (res.status === 403) {
      fail(`LISTENING_CHANNEL_ID: bot lacks access to channel ${channelId} (HTTP 403) — check bot permissions`);
      failures++;
    } else if (res.status === 404) {
      fail(`LISTENING_CHANNEL_ID: channel ${channelId} not found (HTTP 404) — wrong ID?`);
      failures++;
    } else {
      warn(`LISTENING_CHANNEL_ID check returned HTTP ${res.status}`);
    }
  } catch (err) {
    fail(`LISTENING_CHANNEL_ID check failed: ${err.message}`);
    failures++;
  }
}

/**
 * Verify a webhook message ID by fetching it (GET only, no edits).
 */
async function checkWebhookMessageId(name, webhookUrl, messageId) {
  if (!webhookUrl || !messageId || messageId.trim() === '') {
    info(`${name}: message ID not set — bot will CREATE a new message on first run`);
    return;
  }
  const match = webhookUrl.match(/webhooks\/(\d+)\/([\w-]+)/);
  if (!match) return;
  const [, id, token] = match;
  const url = `https://discord.com/api/v10/webhooks/${id}/${token}/messages/${messageId}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    if (res.ok) {
      ok(`${name} message ID ${messageId} is VALID — message exists`);
    } else if (res.status === 404) {
      fail(`${name} message ID ${messageId} NOT FOUND — wrong ID or message deleted`);
      failures++;
    } else {
      warn(`${name} message ID check returned HTTP ${res.status}`);
    }
  } catch (err) {
    fail(`${name} message ID check failed: ${err.message}`);
    failures++;
  }
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}${'═'.repeat(50)}${RESET}`);
  console.log(`${BOLD}  🔍 GitHub Secrets / Environment Validation${RESET}`);
  console.log(`${BOLD}${'═'.repeat(50)}${RESET}\n`);

  // ── Section 1: Presence checks ────────────────────────────

  console.log(`${BOLD}[1/4] Checking required variables are set...${RESET}`);

  const token       = checkPresent('DISCORD_TOKEN',             'Your bot token from Discord Developer Portal');
  const channelId   = checkPresent('LISTENING_CHANNEL_ID',      'The private staff update channel ID');
  const mrWebhook   = checkPresent('MARVEL_RIVALS_WEBHOOK_URL', 'Webhook URL for Marvel Rivals leaderboard');
  const owWebhook   = checkPresent('OVERWATCH_WEBHOOK_URL',     'Webhook URL for Overwatch leaderboard');
  const dlWebhook   = checkPresent('DEADLOCK_WEBHOOK_URL',      'Webhook URL for Deadlock leaderboard');

  const mrMsgId = process.env.MARVEL_RIVALS_MESSAGE_ID ?? '';
  const owMsgId = process.env.OVERWATCH_MESSAGE_ID ?? '';
  const dlMsgId = process.env.DEADLOCK_MESSAGE_ID ?? '';

  // ── Section 2: Format validation ─────────────────────────

  console.log(`\n${BOLD}[2/4] Validating value formats...${RESET}`);

  check(isValidBotToken(token),
    'DISCORD_TOKEN has valid token format',
    'DISCORD_TOKEN format looks wrong (expected format: xxxx.yyyy.zzzz, 50+ chars)');

  const chanSnowflake = isValidSnowflake(channelId);
  check(chanSnowflake !== null && chanSnowflake,
    'LISTENING_CHANNEL_ID is a valid snowflake ID',
    'LISTENING_CHANNEL_ID is not a valid Discord snowflake (17-20 digit number)');

  check(isValidWebhookUrl(mrWebhook),
    'MARVEL_RIVALS_WEBHOOK_URL has valid webhook URL format',
    'MARVEL_RIVALS_WEBHOOK_URL is not a valid Discord webhook URL (expected: https://discord.com/api/webhooks/ID/TOKEN)');

  check(isValidWebhookUrl(owWebhook),
    'OVERWATCH_WEBHOOK_URL has valid webhook URL format',
    'OVERWATCH_WEBHOOK_URL is not a valid Discord webhook URL');

  check(isValidWebhookUrl(dlWebhook),
    'DEADLOCK_WEBHOOK_URL has valid webhook URL format',
    'DEADLOCK_WEBHOOK_URL is not a valid Discord webhook URL');

  // Optional message IDs — only validate if set
  for (const [key, val] of [
    ['MARVEL_RIVALS_MESSAGE_ID', mrMsgId],
    ['OVERWATCH_MESSAGE_ID',     owMsgId],
    ['DEADLOCK_MESSAGE_ID',      dlMsgId],
  ]) {
    if (val && val.trim() !== '') {
      const valid = isValidSnowflake(val);
      check(valid, `${key} is a valid snowflake`, `${key} format is invalid (expected 17-20 digit number)`);
    } else {
      info(`${key} not set (bot will auto-create on first run)`);
    }
  }

  // ── Section 3: Live API checks ────────────────────────────

  console.log(`\n${BOLD}[3/4] Live API connectivity checks...${RESET}`);
  console.log(`  (These make read-only HTTP requests to Discord)\n`);

  await checkBotToken(token);
  await checkListeningChannel(token, channelId);
  await checkWebhookReachable('MARVEL_RIVALS', mrWebhook);
  await checkWebhookReachable('OVERWATCH',     owWebhook);
  await checkWebhookReachable('DEADLOCK',      dlWebhook);

  // ── Section 4: Message ID checks ─────────────────────────

  console.log(`\n${BOLD}[4/4] Webhook message ID checks...${RESET}`);

  await checkWebhookMessageId('MARVEL_RIVALS', mrWebhook, mrMsgId);
  await checkWebhookMessageId('OVERWATCH',     owWebhook, owMsgId);
  await checkWebhookMessageId('DEADLOCK',      dlWebhook, dlMsgId);

  // ── Summary ───────────────────────────────────────────────

  console.log(`\n${BOLD}${'═'.repeat(50)}${RESET}`);
  if (failures === 0) {
    console.log(`${GREEN}${BOLD}  ✅ All checks passed! Bot is ready to deploy.${RESET}`);
  } else {
    console.log(`${RED}${BOLD}  ❌ ${failures} check(s) failed. Fix above errors before running sync.${RESET}`);
    console.log(`\n${BOLD}  Troubleshooting guide:${RESET}`);
    console.log(`  • DISCORD_TOKEN invalid → regenerate in Discord Developer Portal`);
    console.log(`  • Webhook 401/404 → recreate webhook in channel settings`);
    console.log(`  • Channel 403 → add the bot to the server & grant permissions`);
    console.log(`  • Channel 404 → enable Developer Mode and re-copy the channel ID`);
    console.log(`  • Message ID 404 → clear the MESSAGE_ID secret (bot will re-create)`);
    console.log(`\n  See README.md → Troubleshooting for more details.`);
  }
  console.log(`${BOLD}${'═'.repeat(50)}${RESET}\n`);

  process.exit(failures > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Validation script error:', err);
  process.exit(1);
});
