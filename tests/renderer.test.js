// ============================================================
// tests/renderer.test.js
// ============================================================

import { relativeTime, rankEmoji, renderLeaderboard } from '../src/renderer.js';
import { runSuite, assertEqual, assert } from './helpers.js';

export async function runRendererTests() {
  return runSuite('Renderer', [

    // ── relativeTime ──────────────────────────────────────────

    { name: 'relativeTime: just now (< 10s)', fn: () => {
        assertEqual(relativeTime(new Date(Date.now() - 5000)), 'just now', 'just now');
    }},
    { name: 'relativeTime: seconds', fn: () => {
        const d = new Date(Date.now() - 30_000);
        assertEqual(relativeTime(d), '30 seconds ago', '30 seconds');
    }},
    { name: 'relativeTime: 1 minute', fn: () => {
        const d = new Date(Date.now() - 65_000);
        assertEqual(relativeTime(d), '1 minute ago', '1 minute');
    }},
    { name: 'relativeTime: plural minutes', fn: () => {
        const d = new Date(Date.now() - 3 * 60_000);
        assertEqual(relativeTime(d), '3 minutes ago', '3 minutes');
    }},
    { name: 'relativeTime: hours', fn: () => {
        const d = new Date(Date.now() - 2 * 3600_000);
        assertEqual(relativeTime(d), '2 hours ago', '2 hours');
    }},
    { name: 'relativeTime: days', fn: () => {
        const d = new Date(Date.now() - 3 * 86_400_000);
        assertEqual(relativeTime(d), '3 days ago', '3 days');
    }},
    { name: 'relativeTime: weeks', fn: () => {
        const d = new Date(Date.now() - 14 * 86_400_000);
        assertEqual(relativeTime(d), '2 weeks ago', '2 weeks');
    }},
    { name: 'relativeTime: months', fn: () => {
        const d = new Date(Date.now() - 45 * 86_400_000);
        assertEqual(relativeTime(d), '1 month ago', '1 month');
    }},
    { name: 'relativeTime: years', fn: () => {
        const d = new Date(Date.now() - 400 * 86_400_000);
        assertEqual(relativeTime(d), '1 year ago', '1 year');
    }},
    { name: 'relativeTime: future date returns "just now"', fn: () => {
        const d = new Date(Date.now() + 9999);
        assertEqual(relativeTime(d), 'just now', 'future');
    }},

    // ── rankEmoji ─────────────────────────────────────────────

    { name: 'rankEmoji: diamond', fn: () => {
        assertEqual(rankEmoji('Diamond'), '💎', 'diamond emoji');
    }},
    { name: 'rankEmoji: case insensitive', fn: () => {
        assertEqual(rankEmoji('GRANDMASTER'), '👑', 'grandmaster case');
    }},
    { name: 'rankEmoji: Top 500', fn: () => {
        assertEqual(rankEmoji('Top 500'), '⭐', 'top 500 emoji');
    }},
    { name: 'rankEmoji: One Above All', fn: () => {
        assertEqual(rankEmoji('One Above All'), '🌟', 'one above all emoji');
    }},
    { name: 'rankEmoji: Eternus', fn: () => {
        assertEqual(rankEmoji('Eternus'), '♾️', 'eternus emoji');
    }},
    { name: 'rankEmoji: unknown returns ❓', fn: () => {
        assertEqual(rankEmoji('FakeRank'), '❓', 'unknown emoji');
    }},

    // ── renderLeaderboard ─────────────────────────────────────

    { name: 'MR: empty board renders placeholder', fn: () => {
        const out = renderLeaderboard([], 'MARVEL_RIVALS');
        assert(out.includes('No players yet'), 'empty board placeholder');
    }},

    { name: 'MR: renders player row with emoji', fn: () => {
        const players = [{
            playerName: 'Turbo', role: 'Duelist',
            rankCurrent: 'Diamond', tierCurrent: 2,
            rankPeak: 'Master', tierPeak: 1,
            date: new Date(Date.now() - 7200_000),
        }];
        const out = renderLeaderboard(players, 'MARVEL_RIVALS');
        assert(out.includes('@Turbo'), 'player name');
        assert(out.includes('Duelist'), 'role');
        assert(out.includes('💎'), 'diamond emoji');
        assert(out.includes('Diamond 2'), 'current rank+tier');
        assert(out.includes('Master 1'), 'peak rank+tier');
        assert(out.includes('hours ago'), 'relative time');
    }},

    { name: 'OW: renders SR values', fn: () => {
        const players = [{
            playerName: 'Alpha', role: 'Tank',
            rankCurrent: 'Diamond', tierCurrent: 3, currentValue: 3200,
            rankPeak: 'Master', tierPeak: 2, peakValue: 3400,
            date: new Date(),
        }];
        const out = renderLeaderboard(players, 'OVERWATCH');
        assert(out.includes('3200 SR'), 'current SR');
        assert(out.includes('3400 SR'), 'peak SR');
    }},

    { name: 'OW: Top 500 shows # prefix', fn: () => {
        const players = [{
            playerName: 'Pro', role: 'DPS',
            rankCurrent: 'Top 500', tierCurrent: 47, currentValue: 4800,
            rankPeak: 'Top 500', tierPeak: 12, peakValue: 4900,
            date: new Date(),
        }];
        const out = renderLeaderboard(players, 'OVERWATCH');
        assert(out.includes('#47'), 'Top 500 current rank number');
        assert(out.includes('#12'), 'Top 500 peak rank number');
    }},

    { name: 'DL: renders pts value, no peak', fn: () => {
        const players = [{
            playerName: 'Player2', hero: 'Haze',
            rankCurrent: 'Archon', tierCurrent: 4, currentValue: 1200,
            date: new Date(),
        }];
        const out = renderLeaderboard(players, 'DEADLOCK');
        assert(out.includes('Haze'), 'hero name');
        assert(out.includes('1200 pts'), 'pts value');
        assert(!out.includes('Peak:'), 'no peak for Deadlock');
    }},

    { name: 'Medals: top 3 get 🥇🥈🥉', fn: () => {
        const players = ['A','B','C','D'].map((n, i) => ({
            playerName: n, role: 'DPS',
            rankCurrent: 'Diamond', tierCurrent: i + 1,
            rankPeak: 'Diamond', tierPeak: i + 1,
            date: new Date(),
        }));
        const out = renderLeaderboard(players, 'MARVEL_RIVALS');
        assert(out.includes('🥇'), '1st medal');
        assert(out.includes('🥈'), '2nd medal');
        assert(out.includes('🥉'), '3rd medal');
    }},

    { name: 'renderLeaderboard: includes Last updated timestamp', fn: () => {
        const out = renderLeaderboard([], 'DEADLOCK');
        assert(out.includes('Last updated:'), 'last updated');
    }},

  ]);
}
