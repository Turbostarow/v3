// ============================================================
// discord.js — Discord API wrapper
//   • Login / destroy client
//   • Fetch messages from listening channel
//   • Delete messages
//   • Post / edit webhook messages
// ============================================================

import { Client, GatewayIntentBits, Partials } from 'discord.js';

// ── Constants ─────────────────────────────────────────────────

const DEFAULT_DELAY_MS = parseInt(process.env.API_DELAY_MS ?? '1000', 10);
const FETCH_LIMIT      = Math.min(parseInt(process.env.FETCH_LIMIT ?? '50', 10), 100);

// ── Client ────────────────────────────────────────────────────

let client = null;

export async function loginBot(token) {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel],
  });

  await new Promise((resolve, reject) => {
    client.once('ready', resolve);
    client.once('error', reject);
    client.login(token).catch(reject);
  });

  console.log(`[discord] Logged in as ${client.user.tag}`);
  return client;
}

export async function destroyBot() {
  if (client) {
    await client.destroy();
    client = null;
    console.log('[discord] Client destroyed');
  }
}

// ── Message fetching ──────────────────────────────────────────

/**
 * Fetch messages from a channel, newest-first, up to FETCH_LIMIT.
 * Optionally only messages after `afterMessageId`.
 * Returns an array sorted OLDEST first for processing order.
 */
export async function fetchMessages(channelId, afterMessageId = null) {
  const channel = await client.channels.fetch(channelId);
  if (!channel) throw new Error(`Channel ${channelId} not found`);

  const options = { limit: FETCH_LIMIT };
  if (afterMessageId) options.after = afterMessageId;

  const collection = await channel.messages.fetch(options);

  // Convert to array, oldest first
  const messages = [...collection.values()].sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp
  );

  console.log(`[discord] Fetched ${messages.length} messages from channel ${channelId}`);
  return messages;
}

// ── Message deletion ──────────────────────────────────────────

/**
 * Delete a single Discord message with exponential backoff on rate limits.
 */
export async function deleteMessage(message, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await message.delete();
      return true;
    } catch (err) {
      if (err.status === 429) {
        // Rate limited — wait and retry
        const retryAfter = (err.retryAfter ?? 2) * 1000;
        console.warn(`[discord] Rate limited on delete, retrying in ${retryAfter}ms (attempt ${attempt}/${retries})`);
        await sleep(retryAfter);
      } else if (err.code === 10008) {
        // Unknown message — already deleted, that's fine
        console.warn(`[discord] Message ${message.id} already deleted`);
        return true;
      } else {
        console.error(`[discord] Failed to delete message ${message.id}:`, err.message);
        if (attempt === retries) return false;
        await sleep(DEFAULT_DELAY_MS * attempt);
      }
    }
  }
  return false;
}

// ── Webhook operations ────────────────────────────────────────

/**
 * Fetch the current content of a webhook message.
 * Returns null if the message doesn't exist yet.
 * @param {string} webhookUrl
 * @param {string|null} messageId
 */
export async function fetchWebhookMessage(webhookUrl, messageId) {
  if (!messageId) return null;

  const { id, token } = parseWebhookUrl(webhookUrl);
  const url = `https://discord.com/api/v10/webhooks/${id}/${token}/messages/${messageId}`;

  const res = await fetchWithBackoff(url, { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`[discord] Failed to fetch webhook message: ${res.status}`);
    return null;
  }

  const data = await res.json();
  return data.content ?? '';
}

/**
 * Post a new webhook message and return its message ID.
 * @param {string} webhookUrl
 * @param {string} content
 */
export async function postWebhookMessage(webhookUrl, content) {
  const { id, token } = parseWebhookUrl(webhookUrl);
  const url = `https://discord.com/api/v10/webhooks/${id}/${token}?wait=true`;

  const res = await fetchWithBackoff(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: truncate(content) }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to post webhook message: ${res.status} ${err}`);
  }

  const data = await res.json();
  console.log(`[discord] Posted new webhook message: ${data.id}`);
  return data.id;
}

/**
 * Edit an existing webhook message.
 * @param {string} webhookUrl
 * @param {string} messageId
 * @param {string} content
 */
export async function editWebhookMessage(webhookUrl, messageId, content) {
  const { id, token } = parseWebhookUrl(webhookUrl);
  const url = `https://discord.com/api/v10/webhooks/${id}/${token}/messages/${messageId}`;

  const res = await fetchWithBackoff(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: truncate(content) }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to edit webhook message: ${res.status} ${err}`);
  }

  console.log(`[discord] Edited webhook message: ${messageId}`);
  return true;
}

// ── Helpers ───────────────────────────────────────────────────

function parseWebhookUrl(webhookUrl) {
  // https://discord.com/api/webhooks/{id}/{token}
  const match = webhookUrl.match(/webhooks\/(\d+)\/([A-Za-z0-9_\-.]+)/);
  if (!match) throw new Error(`Invalid webhook URL: ${webhookUrl}`);
  return { id: match[1], token: match[2] };
}

/** Truncate content to Discord's 2000 character limit */
function truncate(content) {
  if (content.length <= 2000) return content;
  const suffix = '\n…*(truncated)*';
  return content.slice(0, 2000 - suffix.length) + suffix;
}

/** Sleep helper */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Fetch with exponential backoff on 429 */
async function fetchWithBackoff(url, options, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      const wait = (body.retry_after ?? 2) * 1000;
      console.warn(`[discord] Rate limited on ${options.method} ${url}, waiting ${wait}ms`);
      await sleep(wait);
      continue;
    }
    return res;
  }
  throw new Error(`Max retries exceeded for ${url}`);
}
