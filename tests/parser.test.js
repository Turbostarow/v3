// ============================================================
// tests/parser.test.js
// ============================================================

import { parseMessage, parseMarvelRivals, parseOverwatch, parseDeadlock, parseDate } from '../src/parser.js';
import { runSuite, assertEqual, assertNull, assertNotNull, assert } from './helpers.js';

export async function runParserTests() {
  return runSuite('Parser', [

    // ── Marvel Rivals ─────────────────────────────────────────

    {
      name: 'MR: basic parse',
      fn: () => {
        // MR has no "Master" rank — uses Grandmaster. Using Diamond → Grandmaster.
        const r = parseMessage('LB_UPDATE_MR: @Turbo Strategist Diamond 2 Grandmaster 1 yesterday');
        assertNotNull(r, 'result should not be null');
        assertEqual(r.game, 'MARVEL_RIVALS', 'game');
        assertEqual(r.playerName, 'Turbo', 'playerName');
        assertEqual(r.role, 'Strategist', 'role');
        assertEqual(r.rankCurrent, 'Diamond', 'rankCurrent');
        assertEqual(r.tierCurrent, 2, 'tierCurrent');
        assertEqual(r.rankPeak, 'Grandmaster', 'rankPeak');
        assertEqual(r.tierPeak, 1, 'tierPeak');
        assertNotNull(r.date, 'date');
      },
    },

    {
      name: 'MR: case insensitive prefix',
      fn: () => {
        const r = parseMessage('lb_update_mr: @Alice Duelist Gold 3 Platinum 2 today');
        assertNotNull(r, 'should parse case-insensitive prefix');
        assertEqual(r.game, 'MARVEL_RIVALS', 'game');
      },
    },

    {
      name: 'MR: multi-word rank "One Above All"',
      fn: () => {
        const r = parseMessage('LB_UPDATE_MR: @God Duelist One Above All 1 One Above All 1 today');
        assertNotNull(r, 'should parse "One Above All"');
        assertEqual(r.rankCurrent, 'One Above All', 'rankCurrent');
        assertEqual(r.rankPeak, 'One Above All', 'rankPeak');
      },
    },

    {
      name: 'MR: Eternity rank',
      fn: () => {
        const r = parseMessage('LB_UPDATE_MR: @Zetsu Strategist Eternity 1 Eternity 1 2 days ago');
        assertNotNull(r, 'should parse Eternity');
        assertEqual(r.rankCurrent, 'Eternity', 'rankCurrent');
      },
    },

    {
      name: 'MR: invalid tier > 3 rejected',
      fn: () => {
        const r = parseMessage('LB_UPDATE_MR: @Bad Duelist Diamond 5 Master 1 today');
        assertNull(r, 'tier 5 in MR should be rejected');
      },
    },

    {
      name: 'MR: invalid rank name rejected',
      fn: () => {
        const r = parseMessage('LB_UPDATE_MR: @Bad Duelist FakeRank 1 Master 1 today');
        assertNull(r, 'unknown rank should be rejected');
      },
    },

    {
      name: 'MR: relative date "2 days ago"',
      fn: () => {
        const r = parseMessage('LB_UPDATE_MR: @Alpha Strategist Diamond 1 Celestial 1 2 days ago');
        assertNotNull(r, 'should parse');
        const diffDays = (Date.now() - r.date.getTime()) / 86_400_000;
        assert(diffDays > 1.9 && diffDays < 2.1, `expected ~2 days ago, got ${diffDays}`);
      },
    },

    // ── Overwatch ─────────────────────────────────────────────

    {
      name: 'OW: basic parse',
      fn: () => {
        const r = parseMessage('LB_UPDATE_OW: @Alpha Tank Diamond 3 3200 Master 2 3400 2 days ago');
        assertNotNull(r, 'should parse');
        assertEqual(r.game, 'OVERWATCH', 'game');
        assertEqual(r.playerName, 'Alpha', 'playerName');
        assertEqual(r.role, 'Tank', 'role');
        assertEqual(r.rankCurrent, 'Diamond', 'rankCurrent');
        assertEqual(r.tierCurrent, 3, 'tierCurrent');
        assertEqual(r.currentValue, 3200, 'currentValue');
        assertEqual(r.rankPeak, 'Master', 'rankPeak');
        assertEqual(r.tierPeak, 2, 'tierPeak');
        assertEqual(r.peakValue, 3400, 'peakValue');
      },
    },

    {
      name: 'OW: Top 500 special case',
      fn: () => {
        const r = parseMessage('LB_UPDATE_OW: @Pro DPS Top 500 47 4800 Top 500 12 4900 today');
        assertNotNull(r, 'should parse Top 500');
        assertEqual(r.rankCurrent, 'Top 500', 'rankCurrent');
        assertEqual(r.tierCurrent, 47, 'tierCurrent = rank number');
      },
    },

    {
      name: 'OW: Champion rank',
      fn: () => {
        const r = parseMessage('LB_UPDATE_OW: @Champ Support Champion 1 4100 Champion 1 4200 today');
        assertNotNull(r, 'should parse Champion');
        assertEqual(r.rankCurrent, 'Champion', 'rankCurrent');
      },
    },

    {
      name: 'OW: invalid tier > 5 rejected (non-Top500)',
      fn: () => {
        const r = parseMessage('LB_UPDATE_OW: @Bad DPS Diamond 6 3100 Master 1 3400 today');
        assertNull(r, 'tier 6 for Diamond should be rejected');
      },
    },

    // ── Deadlock ──────────────────────────────────────────────

    {
      name: 'DL: basic parse',
      fn: () => {
        const r = parseMessage('LB_UPDATE_DL: @Player2 Haze Archon 4 1200 Feb 14 2026');
        assertNotNull(r, 'should parse');
        assertEqual(r.game, 'DEADLOCK', 'game');
        assertEqual(r.playerName, 'Player2', 'playerName');
        assertEqual(r.hero, 'Haze', 'hero');
        assertEqual(r.rankCurrent, 'Archon', 'rankCurrent');
        assertEqual(r.tierCurrent, 4, 'tierCurrent');
        assertEqual(r.currentValue, 1200, 'currentValue');
      },
    },

    {
      name: 'DL: tier 6 (max) valid',
      fn: () => {
        const r = parseMessage('LB_UPDATE_DL: @TopPlayer Dynamo Eternus 6 9999 today');
        assertNotNull(r, 'tier 6 is valid for Deadlock');
        assertEqual(r.tierCurrent, 6, 'tierCurrent');
      },
    },

    {
      name: 'DL: tier 7 rejected',
      fn: () => {
        const r = parseMessage('LB_UPDATE_DL: @Bad Haze Archon 7 1200 today');
        assertNull(r, 'tier 7 should be rejected for Deadlock');
      },
    },

    {
      name: 'DL: Phantom rank',
      fn: () => {
        // Hero names must be single words in the current format spec
        const r = parseMessage('LB_UPDATE_DL: @Ghost Geist Phantom 3 5000 yesterday');
        assertNotNull(r, 'should parse Phantom');
        assertEqual(r.rankCurrent, 'Phantom', 'rankCurrent');
      },
    },

    {
      name: 'DL: natural date "Feb 14 2026"',
      fn: () => {
        const r = parseMessage('LB_UPDATE_DL: @Player2 Haze Archon 4 1200 Feb 14 2026');
        assertNotNull(r, 'should parse');
        assertEqual(r.date.getFullYear(), 2026, 'year');
        assertEqual(r.date.getMonth(), 1, 'month (0-indexed Feb=1)');
        assertEqual(r.date.getDate(), 14, 'day');
      },
    },

    // ── Unrecognised messages ─────────────────────────────────

    {
      name: 'Unknown prefix returns null',
      fn: () => {
        const r = parseMessage('LB_UPDATE_UNKNOWN: @User Tank Diamond 1 today');
        assertNull(r, 'unknown prefix should return null');
      },
    },

    {
      name: 'Empty string returns null',
      fn: () => {
        const r = parseMessage('');
        assertNull(r, 'empty string should return null');
      },
    },

    {
      name: 'Sanitisation: strips angle brackets from player name',
      fn: () => {
        const r = parseMessage('LB_UPDATE_MR: @<script>alert Duelist Diamond 1 Grandmaster 1 today');
        assertNotNull(r, 'should parse after sanitisation');
        assert(!r.playerName.includes('<'), 'playerName should not contain <');
        assert(!r.playerName.includes('>'), 'playerName should not contain >');
      },
    },

    // ── parseDate edge cases ──────────────────────────────────

    {
      name: 'parseDate: "just now"',
      fn: () => {
        const d = parseDate('just now');
        assert(Date.now() - d.getTime() < 1000, 'should be within 1 second');
      },
    },

    {
      name: 'parseDate: "1 week ago"',
      fn: () => {
        const d = parseDate('1 week ago');
        const diffDays = (Date.now() - d.getTime()) / 86_400_000;
        assert(diffDays > 6.9 && diffDays < 7.1, `expected ~7 days, got ${diffDays}`);
      },
    },

    {
      name: 'parseDate: ISO string',
      fn: () => {
        const iso = '2026-01-15T10:00:00Z';
        const d = parseDate(iso);
        assertEqual(d.toISOString(), new Date(iso).toISOString(), 'ISO date');
      },
    },

  ]);
}
