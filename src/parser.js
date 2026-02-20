// ============================================================
// parser.js — Parse rank update messages for all 3 games
// ============================================================

// ── Rank definitions ─────────────────────────────────────────

/** Marvel Rivals ranks in ascending order (index = value for comparison) */
export const MR_RANKS = [
  'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond',
  'Grandmaster', 'Celestial', 'Eternity', 'One Above All'
];

/** Overwatch ranks in ascending order */
export const OW_RANKS = [
  'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond',
  'Master', 'Grandmaster', 'Champion', 'Top 500'
];

/** Deadlock ranks in ascending order */
export const DL_RANKS = [
  'Initiate', 'Seeker', 'Alchemist', 'Arcanist',
  'Ritualist', 'Emissary', 'Archon', 'Oracle',
  'Phantom', 'Ascendant', 'Eternus'
];

// Build longest-match regex alternations (multi-word first)
const mrRankAlt = [...MR_RANKS].reverse().map(escapeRegex).join('|');
const owRankAlt = [...OW_RANKS].reverse().map(escapeRegex).join('|');
const dlRankAlt = [...DL_RANKS].reverse().map(escapeRegex).join('|');

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Date parsing ──────────────────────────────────────────────

/**
 * Parse a variety of date/time strings into a JS Date.
 * Supported: ISO dates, relative ("yesterday", "X days ago", "today"),
 * Discord-style natural language ("Feb 14 2026"), etc.
 */
export function parseDate(raw) {
  if (!raw || typeof raw !== 'string') return new Date();
  const s = raw.trim().toLowerCase();

  // "just now" / "now"
  if (s === 'now' || s === 'just now') return new Date();

  // "today"
  if (s === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // "yesterday"
  if (s === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Relative: "X seconds/minutes/hours/days/weeks/months/years ago"
  const relMatch = s.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/);
  if (relMatch) {
    const n = parseInt(relMatch[1], 10);
    const unit = relMatch[2];
    const d = new Date();
    const map = {
      second: 1000,
      minute: 60_000,
      hour: 3_600_000,
      day: 86_400_000,
      week: 7 * 86_400_000,
      month: 30 * 86_400_000,
      year: 365 * 86_400_000,
    };
    return new Date(d.getTime() - n * map[unit]);
  }

  // Natural: "Feb 14 2026" / "February 14 2026"
  const natMatch = raw.trim().match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/);
  if (natMatch) {
    const parsed = new Date(`${natMatch[1]} ${natMatch[2]}, ${natMatch[3]}`);
    if (!isNaN(parsed)) return parsed;
  }

  // ISO / standard
  const iso = new Date(raw.trim());
  if (!isNaN(iso)) return iso;

  // Fallback
  console.warn(`[parser] Could not parse date: "${raw}" — using now`);
  return new Date();
}

// ── Input sanitisation ────────────────────────────────────────

/** Strip potentially dangerous characters from player name / role inputs */
function sanitise(s) {
  return String(s).replace(/[<>"';()]/g, '').trim();
}

// ── Marvel Rivals parser ──────────────────────────────────────

/**
 * LB_UPDATE_MR: @PlayerName role Rank_current tier_current Rank_peak tier_peak date
 * e.g.  LB_UPDATE_MR: @Turbo Strategist Diamond 2 Master 1 yesterday
 */
export function parseMarvelRivals(content) {
  // Strip prefix
  const body = content.replace(/^\s*LB_UPDATE_MR:\s*/i, '').trim();

  // Extract @PlayerName (may contain spaces until the first non-@ word ends)
  const playerMatch = body.match(/^@(.+?)\s+(\S+)\s+(.+)$/);
  if (!playerMatch) return null;

  const playerName = sanitise(playerMatch[1]);
  const role = sanitise(playerMatch[2]);
  const rest = playerMatch[3];

  // Now parse: Rank_current tier_current Rank_peak tier_peak date
  // Rank can be multi-word, tier is an integer
  const rankPattern = new RegExp(
    `^(${mrRankAlt})\\s+(\\d+)\\s+(${mrRankAlt})\\s+(\\d+)\\s+(.+)$`,
    'i'
  );
  const m = rest.match(rankPattern);
  if (!m) return null;

  const [, rankCurrent, tierCurrentRaw, rankPeak, tierPeakRaw, dateRaw] = m;

  const rankCurrentNorm = normaliseRankName(rankCurrent, MR_RANKS);
  const rankPeakNorm = normaliseRankName(rankPeak, MR_RANKS);
  if (!rankCurrentNorm || !rankPeakNorm) return null;

  const tierCurrent = parseInt(tierCurrentRaw, 10);
  const tierPeak = parseInt(tierPeakRaw, 10);
  if (tierCurrent < 1 || tierCurrent > 3) return null;
  if (tierPeak < 1 || tierPeak > 3) return null;

  return {
    game: 'MARVEL_RIVALS',
    playerName,
    role,
    rankCurrent: rankCurrentNorm,
    tierCurrent,
    rankPeak: rankPeakNorm,
    tierPeak,
    date: parseDate(dateRaw),
    dateRaw: dateRaw.trim(),
  };
}

// ── Overwatch parser ──────────────────────────────────────────

/**
 * LB_UPDATE_OW: @PlayerName role Rank_current tier current_value Rank_peak tier peak_value date
 * e.g.  LB_UPDATE_OW: @Alpha Tank Diamond 3 3200 Master 2 3400 2 days ago
 */
export function parseOverwatch(content) {
  const body = content.replace(/^\s*LB_UPDATE_OW:\s*/i, '').trim();

  const playerMatch = body.match(/^@(.+?)\s+(\S+)\s+(.+)$/);
  if (!playerMatch) return null;

  const playerName = sanitise(playerMatch[1]);
  const role = sanitise(playerMatch[2]);
  const rest = playerMatch[3];

  const rankPattern = new RegExp(
    `^(${owRankAlt})\\s+(\\d+)\\s+(\\d+)\\s+(${owRankAlt})\\s+(\\d+)\\s+(\\d+)\\s+(.+)$`,
    'i'
  );
  const m = rest.match(rankPattern);
  if (!m) return null;

  const [, rankCurrent, tierCurrentRaw, currentValueRaw,
         rankPeak, tierPeakRaw, peakValueRaw, dateRaw] = m;

  const rankCurrentNorm = normaliseRankName(rankCurrent, OW_RANKS);
  const rankPeakNorm = normaliseRankName(rankPeak, OW_RANKS);
  if (!rankCurrentNorm || !rankPeakNorm) return null;

  const tierCurrent = parseInt(tierCurrentRaw, 10);
  const tierPeak = parseInt(tierPeakRaw, 10);
  const currentValue = parseInt(currentValueRaw, 10);
  const peakValue = parseInt(peakValueRaw, 10);

  // Top 500: tier = rank number (1–500), otherwise 1–5
  const isTop500Current = rankCurrentNorm === 'Top 500';
  const isTop500Peak = rankPeakNorm === 'Top 500';
  if (!isTop500Current && (tierCurrent < 1 || tierCurrent > 5)) return null;
  if (!isTop500Peak && (tierPeak < 1 || tierPeak > 5)) return null;

  return {
    game: 'OVERWATCH',
    playerName,
    role,
    rankCurrent: rankCurrentNorm,
    tierCurrent,
    currentValue,
    rankPeak: rankPeakNorm,
    tierPeak,
    peakValue,
    date: parseDate(dateRaw),
    dateRaw: dateRaw.trim(),
  };
}

// ── Deadlock parser ───────────────────────────────────────────

/**
 * LB_UPDATE_DL: @PlayerName hero_name Rank_current tier current_value date
 * e.g.  LB_UPDATE_DL: @Player2 Haze Archon 4 1200 Feb 14 2026
 */
export function parseDeadlock(content) {
  const body = content.replace(/^\s*LB_UPDATE_DL:\s*/i, '').trim();

  const playerMatch = body.match(/^@(.+?)\s+(\S+)\s+(.+)$/);
  if (!playerMatch) return null;

  const playerName = sanitise(playerMatch[1]);
  const hero = sanitise(playerMatch[2]);
  const rest = playerMatch[3];

  // Deadlock tiers go 1–6 where 6 = highest
  const rankPattern = new RegExp(
    `^(${dlRankAlt})\\s+(\\d+)\\s+(\\d+)\\s+(.+)$`,
    'i'
  );
  const m = rest.match(rankPattern);
  if (!m) return null;

  const [, rankCurrent, tierCurrentRaw, currentValueRaw, dateRaw] = m;

  const rankCurrentNorm = normaliseRankName(rankCurrent, DL_RANKS);
  if (!rankCurrentNorm) return null;

  const tierCurrent = parseInt(tierCurrentRaw, 10);
  const currentValue = parseInt(currentValueRaw, 10);
  if (tierCurrent < 1 || tierCurrent > 6) return null;

  return {
    game: 'DEADLOCK',
    playerName,
    hero,
    rankCurrent: rankCurrentNorm,
    tierCurrent,
    currentValue,
    date: parseDate(dateRaw),
    dateRaw: dateRaw.trim(),
  };
}

// ── Unified entry point ───────────────────────────────────────

/**
 * Detect game from message prefix and dispatch to the correct parser.
 * Returns null if the message doesn't match any known format.
 */
export function parseMessage(content) {
  if (typeof content !== 'string') return null;
  const trimmed = content.trim();

  if (/^LB_UPDATE_MR:/i.test(trimmed)) return parseMarvelRivals(trimmed);
  if (/^LB_UPDATE_OW:/i.test(trimmed)) return parseOverwatch(trimmed);
  if (/^LB_UPDATE_DL:/i.test(trimmed)) return parseDeadlock(trimmed);

  return null;
}

// ── Helpers ───────────────────────────────────────────────────

/** Case-insensitive rank name normalisation, returns the canonical form or null */
function normaliseRankName(raw, rankList) {
  const lower = raw.toLowerCase().trim();
  const found = rankList.find(r => r.toLowerCase() === lower);
  return found || null;
}

/** Get the numeric rank index for comparison (higher = better) */
export function rankIndex(rankName, rankList) {
  return rankList.findIndex(r => r.toLowerCase() === rankName.toLowerCase());
}
