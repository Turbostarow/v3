// ============================================================
// renderer.js — Format leaderboard display + relative time
// ============================================================

import { MR_RANKS, OW_RANKS, DL_RANKS, rankIndex } from './parser.js';

// ── Rank emojis ───────────────────────────────────────────────

const RANK_EMOJIS = {
  // Shared / Overwatch
  'bronze':        '🟫',
  'silver':        '⚪',
  'gold':          '🟡',
  'platinum':      '🔵',
  'diamond':       '💎',
  'master':        '🎖️',
  'grandmaster':   '👑',
  'champion':      '🏆',
  'top 500':       '⭐',
  // Marvel Rivals extra
  'celestial':     '✨',
  'eternity':      '♾️',
  'one above all': '🌟',
  // Deadlock
  'initiate':      '🔰',
  'seeker':        '🔍',
  'alchemist':     '⚗️',
  'arcanist':      '🔮',
  'ritualist':     '📿',
  'emissary':      '💼',
  'archon':        '👤',
  'oracle':        '🧙',
  'phantom':       '👻',
  'ascendant':     '🎖️',
  'eternus':       '♾️',
};

export function rankEmoji(rankName) {
  return RANK_EMOJIS[rankName.toLowerCase()] ?? '❓';
}

// ── Relative time ─────────────────────────────────────────────

/**
 * Return a human-readable relative time string.
 * e.g. "2 hours ago", "3 days ago", "just now"
 */
export function relativeTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = Date.now() - d.getTime();

  if (diffMs < 0) return 'just now'; // future date guard

  const sec   = Math.floor(diffMs / 1000);
  const min   = Math.floor(sec / 60);
  const hour  = Math.floor(min / 60);
  const day   = Math.floor(hour / 24);
  const week  = Math.floor(day / 7);
  const month = Math.floor(day / 30);
  const year  = Math.floor(day / 365);

  if (sec < 10)   return 'just now';
  if (sec < 60)   return `${sec} seconds ago`;
  if (min < 60)   return `${min} minute${min === 1 ? '' : 's'} ago`;
  if (hour < 24)  return `${hour} hour${hour === 1 ? '' : 's'} ago`;
  if (day < 7)    return `${day} day${day === 1 ? '' : 's'} ago`;
  if (week < 5)   return `${week} week${week === 1 ? '' : 's'} ago`;
  if (month < 12) return `${month} month${month === 1 ? '' : 's'} ago`;
  return `${year} year${year === 1 ? '' : 's'} ago`;
}

// ── Sorting ───────────────────────────────────────────────────

/** Sort Marvel Rivals players */
export function sortMarvelRivals(players) {
  return [...players].sort((a, b) => {
    // 1. Best current rank (higher index = better)
    const rankDiff = rankIndex(b.rankCurrent, MR_RANKS) - rankIndex(a.rankCurrent, MR_RANKS);
    if (rankDiff !== 0) return rankDiff;

    // 2. Lower tier_current wins (tier 1 > tier 2 > tier 3)
    const tierDiff = a.tierCurrent - b.tierCurrent;
    if (tierDiff !== 0) return tierDiff;

    // 3. Best peak rank
    const peakRankDiff = rankIndex(b.rankPeak, MR_RANKS) - rankIndex(a.rankPeak, MR_RANKS);
    if (peakRankDiff !== 0) return peakRankDiff;

    // 4. Lower tier_peak wins
    const peakTierDiff = a.tierPeak - b.tierPeak;
    if (peakTierDiff !== 0) return peakTierDiff;

    // 5. Most recent date
    return new Date(b.date) - new Date(a.date);
  });
}

/** Sort Overwatch players */
export function sortOverwatch(players) {
  return [...players].sort((a, b) => {
    // Top 500 special: higher rank_index; within Top 500, lower tier = better (rank 1 > rank 500)
    const rankDiff = rankIndex(b.rankCurrent, OW_RANKS) - rankIndex(a.rankCurrent, OW_RANKS);
    if (rankDiff !== 0) return rankDiff;

    const isTop500A = a.rankCurrent === 'Top 500';
    const isTop500B = b.rankCurrent === 'Top 500';

    if (isTop500A && isTop500B) {
      // Lower tier number = better rank for Top 500
      const top500Diff = a.tierCurrent - b.tierCurrent;
      if (top500Diff !== 0) return top500Diff;
    } else {
      // Normal tier comparison
      const tierDiff = a.tierCurrent - b.tierCurrent;
      if (tierDiff !== 0) return tierDiff;
    }

    // 3. Best peak rank
    const peakRankDiff = rankIndex(b.rankPeak, OW_RANKS) - rankIndex(a.rankPeak, OW_RANKS);
    if (peakRankDiff !== 0) return peakRankDiff;

    // 4. Lower tier_peak wins
    const peakTierDiff = a.tierPeak - b.tierPeak;
    if (peakTierDiff !== 0) return peakTierDiff;

    // 5. Most recent date
    return new Date(b.date) - new Date(a.date);
  });
}

/** Sort Deadlock players */
export function sortDeadlock(players) {
  return [...players].sort((a, b) => {
    // 1. Best current rank (higher index = better for Deadlock)
    const rankDiff = rankIndex(b.rankCurrent, DL_RANKS) - rankIndex(a.rankCurrent, DL_RANKS);
    if (rankDiff !== 0) return rankDiff;

    // 2. Higher tier wins for Deadlock (tier 6 > tier 5)
    const tierDiff = b.tierCurrent - a.tierCurrent;
    if (tierDiff !== 0) return tierDiff;

    // 3. Lower current_value wins
    const valueDiff = a.currentValue - b.currentValue;
    if (valueDiff !== 0) return valueDiff;

    // 4. Most recent date
    return new Date(b.date) - new Date(a.date);
  });
}

// ── Renderers ─────────────────────────────────────────────────

const GAME_HEADERS = {
  MARVEL_RIVALS: '## 🦸 Marvel Rivals Leaderboard',
  OVERWATCH:     '## 🔫 Overwatch Leaderboard',
  DEADLOCK:      '## 🔒 Deadlock Leaderboard',
};

/**
 * Render a full leaderboard message (human-readable, no state block).
 * State is now stored separately as a pinned message in the listening channel.
 */
export function renderLeaderboard(players, game) {
  const header = GAME_HEADERS[game] ?? `## ${game} Leaderboard`;
  const now = new Date().toUTCString();

  if (!players || players.length === 0) {
    return `${header}\n\n*No players yet. Post an update to get started!*\n\n-# Last updated: ${now}`;
  }

  const lines = players.map((p, i) => renderPlayer(p, game, i + 1));
  return `${header}\n\n${lines.join('\n')}\n\n-# Last updated: ${now}`;
}

/** Render a single player row */
function renderPlayer(p, game, position) {
  const pos = position <= 3
    ? ['🥇', '🥈', '🥉'][position - 1]
    : `\`${String(position).padStart(2, ' ')}\``;

  const time = relativeTime(p.date);

  if (game === 'MARVEL_RIVALS') {
    const curEmoji = rankEmoji(p.rankCurrent);
    const peakEmoji = rankEmoji(p.rankPeak);
    return (
      `${pos} **@${p.playerName}** • ${p.role} • ` +
      `${curEmoji} ${p.rankCurrent} ${p.tierCurrent} • ` +
      `Peak: ${peakEmoji} ${p.rankPeak} ${p.tierPeak} • ` +
      `*${time}*`
    );
  }

  if (game === 'OVERWATCH') {
    const curEmoji = rankEmoji(p.rankCurrent);
    const peakEmoji = rankEmoji(p.rankPeak);
    const curTierStr = p.rankCurrent === 'Top 500'
      ? `#${p.tierCurrent}`
      : `${p.tierCurrent}`;
    const peakTierStr = p.rankPeak === 'Top 500'
      ? `#${p.tierPeak}`
      : `${p.tierPeak}`;
    return (
      `${pos} **@${p.playerName}** • ${p.role} • ` +
      `${curEmoji} ${p.rankCurrent} ${curTierStr} (${p.currentValue} SR) • ` +
      `Peak: ${peakEmoji} ${p.rankPeak} ${peakTierStr} (${p.peakValue} SR) • ` +
      `*${time}*`
    );
  }

  if (game === 'DEADLOCK') {
    const curEmoji = rankEmoji(p.rankCurrent);
    return (
      `${pos} **@${p.playerName}** • ${p.hero} • ` +
      `${curEmoji} ${p.rankCurrent} ${p.tierCurrent} (${p.currentValue} pts) • ` +
      `*${time}*`
    );
  }

  return `${pos} **@${p.playerName}** • *${time}*`;
}
