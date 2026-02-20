# 🏆 Discord Leaderboard Bot

A **production-grade, stateless** Discord leaderboard system for **Marvel Rivals**, **Overwatch**, and **Deadlock**. Staff post rank updates in a single private channel; the bot processes them every 15 minutes, deletes the source messages, and updates three public-facing leaderboard embeds — all with zero database.

---

## 📋 Table of Contents

1. [Architecture](#architecture)
2. [Quick Start](#quick-start)
3. [Message Format Examples](#message-format-examples)
4. [GitHub Secrets Configuration](#github-secrets-configuration)
5. [First Run & Getting Message IDs](#first-run--getting-message-ids)
6. [Running Locally](#running-locally)
7. [Running Tests](#running-tests)
8. [Validating Secrets](#validating-secrets)
9. [Troubleshooting](#troubleshooting)

---

## Architecture

```
#staff-leaderboard-updates (private)
        │
        ▼
  GitHub Actions (every 15 min)
        │  Parse → Process → Delete
        │
        ├──► Marvel Rivals Webhook ──► #marvel-rivals-lb
        ├──► Overwatch Webhook     ──► #overwatch-lb
        └──► Deadlock Webhook      ──► #deadlock-lb
```

**State is stored inside the webhook message** itself (as a hidden JSON block), so no database is needed.

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_ORG/leaderboard-bot.git
cd leaderboard-bot
npm install
```

### 2. Create your Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. **New Application** → give it a name
3. Under **Bot** → click **Add Bot**
4. Under **Token** → **Reset Token** → copy it (this is your `DISCORD_TOKEN`)
5. Enable these **Privileged Gateway Intents**:
   - ✅ Message Content Intent
6. Under **OAuth2 → URL Generator**:
   - Scopes: `bot`
   - Bot Permissions: **Read Messages/View Channels**, **Read Message History**, **Manage Messages**
7. Open the generated URL and invite the bot to your server

### 3. Create Discord Webhooks

For each of the 3 leaderboard channels:

1. Open **Channel Settings** → **Integrations** → **Webhooks**
2. Click **New Webhook** → give it a name → **Copy Webhook URL**
3. Repeat for all 3 channels

### 4. Get Channel & Message IDs

Enable **Developer Mode** in Discord (User Settings → Advanced → Developer Mode), then:
- Right-click your **private staff channel** → **Copy Channel ID** → this is `LISTENING_CHANNEL_ID`

### 5. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 6. Set GitHub Secrets

See [GitHub Secrets Configuration](#github-secrets-configuration) below.

### 7. Validate before first run

```bash
npm run test:secrets
```

---

## Message Format Examples

All updates go to **one private channel**. The bot detects the game from the prefix.

### Marvel Rivals

```
LB_UPDATE_MR: @PlayerName role Rank tier PeakRank peak_tier date
```

**Example:**
```
LB_UPDATE_MR: @Turbo Strategist Diamond 2 Master 1 yesterday
LB_UPDATE_MR: @Alice Duelist One Above All 1 One Above All 1 2 hours ago
LB_UPDATE_MR: @Bob Vanguard Bronze 3 Gold 2 3 days ago
```

**Ranks** (lowest → highest): `Bronze` → `Silver` → `Gold` → `Platinum` → `Diamond` → `Grandmaster` → `Celestial` → `Eternity` → `One Above All`

**Tiers**: `3`, `2`, `1` (where `1` = highest within rank)

---

### Overwatch

```
LB_UPDATE_OW: @PlayerName role Rank tier SR PeakRank peak_tier peak_SR date
```

**Example:**
```
LB_UPDATE_OW: @Alpha Tank Diamond 3 3200 Master 2 3400 2 days ago
LB_UPDATE_OW: @ProPlayer DPS Top 500 47 4800 Top 500 12 4900 today
LB_UPDATE_OW: @Healer Support Master 1 3750 Grandmaster 2 3800 5 hours ago
```

**Ranks** (lowest → highest): `Bronze` → `Silver` → `Gold` → `Platinum` → `Diamond` → `Master` → `Grandmaster` → `Champion` → `Top 500`

**Tiers**: `5`, `4`, `3`, `2`, `1` (where `1` = highest within rank), except **Top 500** where the tier is the actual leaderboard rank number (e.g. `47` = rank #47)

---

### Deadlock

```
LB_UPDATE_DL: @PlayerName hero Rank tier value date
```

**Example:**
```
LB_UPDATE_DL: @Player2 Haze Archon 4 1200 Feb 14 2026
LB_UPDATE_DL: @TopPlayer Dynamo Eternus 6 250 yesterday
LB_UPDATE_DL: @NewPlayer Lady Geist Initiate 1 50 today
```

**Ranks** (lowest → highest): `Initiate` → `Seeker` → `Alchemist` → `Arcanist` → `Ritualist` → `Emissary` → `Archon` → `Oracle` → `Phantom` → `Ascendant` → `Eternus`

**Tiers**: `1`, `2`, `3`, `4`, `5`, `6` (where `6` = highest within rank — **reversed from MR/OW!**)

---

### Date Formats Accepted

| Format | Example |
|--------|---------|
| Relative natural | `just now`, `today`, `yesterday` |
| Relative precise | `2 hours ago`, `3 days ago`, `1 week ago`, `2 months ago` |
| Natural date | `Feb 14 2026`, `January 1 2025` |
| ISO 8601 | `2026-02-14T15:30:00Z` |

---

## GitHub Secrets Configuration

Navigate to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

### Required Secrets

| Secret Name | Value | Where to get it |
|---|---|---|
| `DISCORD_TOKEN` | Bot token | Discord Developer Portal → Bot → Token |
| `LISTENING_CHANNEL_ID` | 17-20 digit ID | Right-click channel → Copy Channel ID |
| `MARVEL_RIVALS_WEBHOOK_URL` | Full webhook URL | Channel Settings → Integrations → Webhooks |
| `OVERWATCH_WEBHOOK_URL` | Full webhook URL | Channel Settings → Integrations → Webhooks |
| `DEADLOCK_WEBHOOK_URL` | Full webhook URL | Channel Settings → Integrations → Webhooks |

### Optional Secrets (set after first run)

After the **first run**, the bot will print new message IDs to the Actions log. Copy these and add them as secrets to prevent duplicate messages on future runs.

| Secret Name | Value | Purpose |
|---|---|---|
| `MARVEL_RIVALS_MESSAGE_ID` | 17-20 digit ID | Edit existing leaderboard message |
| `OVERWATCH_MESSAGE_ID` | 17-20 digit ID | Edit existing leaderboard message |
| `DEADLOCK_MESSAGE_ID` | 17-20 digit ID | Edit existing leaderboard message |

### Optional Tuning Secrets

| Secret Name | Default | Description |
|---|---|---|
| `FETCH_LIMIT` | `50` | Max messages to fetch per sync (max 100) |
| `API_DELAY_MS` | `1000` | Milliseconds between API calls |

---

## First Run & Getting Message IDs

1. Push your code + secrets to GitHub
2. Go to **Actions** → **Leaderboard Sync** → **Run workflow** (manual trigger)
3. Watch the logs — you'll see output like:
   ```
   [sync] ⚠️  NEW MESSAGE ID for MARVEL_RIVALS: 123456789012345678
   [sync] ⚠️  Add this to your GitHub Secrets / .env as:
              MARVEL_RIVALS_MESSAGE_ID=123456789012345678
   ```
4. Add those message IDs as GitHub Secrets
5. All subsequent runs will **edit** those messages instead of creating new ones

---

## Running Locally

```bash
# 1. Copy and fill in your .env
cp .env.example .env

# 2. Run the sync once
npm run sync

# 3. Validate your secrets (read-only checks)
npm run test:secrets
```

---

## Running Tests

```bash
# Run all unit tests
npm test

# Run individual test suites
npm run test:parser
npm run test:renderer
npm run test:storage
npm run test:sorting

# Validate secrets / environment (live API checks)
npm run test:secrets
```

### Test Coverage

| Suite | What it tests |
|---|---|
| **Parser** | All 3 message formats, edge cases, sanitisation, date parsing |
| **Renderer** | Relative timestamps, rank emojis, leaderboard formatting |
| **Storage** | State encode/decode, upsert logic, stale update rejection |
| **Sorting** | All tiebreaker rules for all 3 games |
| **Secrets Validator** | Live API connectivity checks for all Discord secrets |

---

## Validating Secrets

The secrets validator (`npm run test:secrets`) runs **4 checks** without making any destructive API calls:

1. **Presence** — Confirms all required env vars are set
2. **Format** — Validates token/URL/ID formats without calling Discord
3. **Live API** — Pings Discord to confirm each webhook and the bot token are valid
4. **Message IDs** — Checks that stored message IDs still exist

```
══════════════════════════════════════════════════
  🔍 GitHub Secrets / Environment Validation
══════════════════════════════════════════════════

[1/4] Checking required variables are set...
  ✅ DISCORD_TOKEN is set
  ✅ LISTENING_CHANNEL_ID is set
  ✅ MARVEL_RIVALS_WEBHOOK_URL is set
  ...

[2/4] Validating value formats...
  ✅ DISCORD_TOKEN has valid token format
  ✅ LISTENING_CHANNEL_ID is a valid snowflake ID
  ...

[3/4] Live API connectivity checks...
  ✅ DISCORD_TOKEN is VALID — bot: "LeaderboardBot#0"
  ✅ LISTENING_CHANNEL_ID is accessible — "#staff-leaderboard-updates"
  ✅ MARVEL_RIVALS webhook is LIVE — channel: "1234...", name: "MR Leaderboard"
  ...

[4/4] Webhook message ID checks...
  ✅ MARVEL_RIVALS message ID 1234... is VALID — message exists
  ℹ️  OVERWATCH: message ID not set — bot will CREATE a new message on first run
  ...

══════════════════════════════════════════════════
  ✅ All checks passed! Bot is ready to deploy.
══════════════════════════════════════════════════
```

You can also trigger this from GitHub Actions via **Run workflow** → enable "Run secrets validation before sync".

---

## Troubleshooting

### ❌ `DISCORD_TOKEN is INVALID (HTTP 401)`
- The token was reset or is incorrect
- Go to Discord Developer Portal → Bot → **Reset Token** → update `DISCORD_TOKEN` secret

### ❌ `Webhook 401 or 404`
- The webhook was deleted or is incorrect
- Go to the leaderboard channel → Settings → Integrations → Webhooks → create a new one
- Update the corresponding `*_WEBHOOK_URL` secret

### ❌ `LISTENING_CHANNEL_ID not accessible (HTTP 403)`
- The bot isn't in your server, or lacks the required permissions
- Re-invite the bot using the OAuth URL Generator with permissions: **Read Messages**, **Read Message History**, **Manage Messages**
- Make sure the bot role can see the private staff channel

### ❌ `LISTENING_CHANNEL_ID not found (HTTP 404)`
- Wrong channel ID
- Enable Developer Mode → right-click the channel → Copy Channel ID

### ❌ `Message ID 404 — message not found`
- The stored leaderboard message was deleted from Discord
- Clear the corresponding `*_MESSAGE_ID` secret (leave blank)
- The bot will create a new message on the next run; update the secret with the new ID

### ❌ Messages not being deleted
- Bot needs **Manage Messages** permission in the listening channel
- Check Actions logs for `Failed to delete message` errors

### ❌ Leaderboard not updating
- Check that the message format exactly matches the spec (prefix, spacing)
- Run locally: `npm run sync` to see detailed logs
- Check that `FETCH_LIMIT` is high enough if there are many queued messages

### ⚠️ Duplicate leaderboard messages
- The `*_MESSAGE_ID` secrets aren't set after first run
- Find the message IDs in the Actions log and add them as secrets

### ℹ️ GitHub Actions only runs every 15 minutes
- Scheduled workflows run on GitHub's infrastructure and may be delayed by up to a few minutes under high load
- Use **Run workflow** (manual trigger) for immediate syncs
