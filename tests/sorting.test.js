// ============================================================
// tests/sorting.test.js
// ============================================================

import { sortMarvelRivals, sortOverwatch, sortDeadlock } from '../src/renderer.js';
import { runSuite, assertEqual, assert } from './helpers.js';

// ── Helpers ───────────────────────────────────────────────────

const now = new Date();
const older = new Date(now - 86_400_000);
const newest = new Date(now + 1000);

function mrPlayer(name, rankCurrent, tierCurrent, rankPeak, tierPeak, date = now) {
  return { playerName: name, role: 'DPS', rankCurrent, tierCurrent, rankPeak, tierPeak, date };
}

function owPlayer(name, rankCurrent, tierCurrent, currentValue, rankPeak, tierPeak, peakValue, date = now) {
  return { playerName: name, role: 'DPS', rankCurrent, tierCurrent, currentValue, rankPeak, tierPeak, peakValue, date };
}

function dlPlayer(name, rankCurrent, tierCurrent, currentValue, date = now) {
  return { playerName: name, hero: 'Haze', rankCurrent, tierCurrent, currentValue, date };
}

// ── Tests ─────────────────────────────────────────────────────

export async function runSortingTests() {
  return runSuite('Sorting', [

    // Marvel Rivals

    { name: 'MR: higher rank wins', fn: () => {
        const players = [
            mrPlayer('B', 'Diamond', 1, 'Diamond', 1),
            mrPlayer('A', 'Grandmaster', 1, 'Grandmaster', 1),
        ];
        const sorted = sortMarvelRivals(players);
        assertEqual(sorted[0].playerName, 'A', 'Grandmaster > Diamond');
    }},

    { name: 'MR: same rank — lower tier wins (tier 1 > tier 2)', fn: () => {
        const players = [
            mrPlayer('B', 'Diamond', 2, 'Diamond', 2),
            mrPlayer('A', 'Diamond', 1, 'Diamond', 1),
        ];
        const sorted = sortMarvelRivals(players);
        assertEqual(sorted[0].playerName, 'A', 'Diamond 1 > Diamond 2');
    }},

    { name: 'MR: tiebreak by peak rank', fn: () => {
        const players = [
            mrPlayer('B', 'Diamond', 1, 'Diamond', 1),
            mrPlayer('A', 'Diamond', 1, 'Grandmaster', 1),
        ];
        const sorted = sortMarvelRivals(players);
        assertEqual(sorted[0].playerName, 'A', 'better peak rank wins');
    }},

    { name: 'MR: tiebreak by peak tier', fn: () => {
        const players = [
            mrPlayer('B', 'Diamond', 1, 'Grandmaster', 2),
            mrPlayer('A', 'Diamond', 1, 'Grandmaster', 1),
        ];
        const sorted = sortMarvelRivals(players);
        assertEqual(sorted[0].playerName, 'A', 'lower peak tier wins');
    }},

    { name: 'MR: tiebreak by most recent date', fn: () => {
        const players = [
            mrPlayer('B', 'Diamond', 1, 'Grandmaster', 1, older),
            mrPlayer('A', 'Diamond', 1, 'Grandmaster', 1, newest),
        ];
        const sorted = sortMarvelRivals(players);
        assertEqual(sorted[0].playerName, 'A', 'more recent wins');
    }},

    { name: 'MR: One Above All is highest rank', fn: () => {
        const players = [
            mrPlayer('B', 'Eternity', 1, 'Eternity', 1),
            mrPlayer('A', 'One Above All', 1, 'One Above All', 1),
        ];
        const sorted = sortMarvelRivals(players);
        assertEqual(sorted[0].playerName, 'A', 'One Above All > Eternity');
    }},

    { name: 'MR: sorts 5 players correctly', fn: () => {
        const players = [
            mrPlayer('E', 'Bronze', 1, 'Bronze', 1),
            mrPlayer('C', 'Diamond', 2, 'Grandmaster', 1),
            mrPlayer('A', 'Celestial', 1, 'Eternity', 1),
            mrPlayer('D', 'Diamond', 1, 'Diamond', 1),
            mrPlayer('B', 'Celestial', 2, 'Grandmaster', 1),
        ];
        const sorted = sortMarvelRivals(players);
        assertEqual(sorted.map(p => p.playerName), ['A', 'B', 'D', 'C', 'E'], 'correct order');
    }},

    // Overwatch

    { name: 'OW: higher rank wins', fn: () => {
        const players = [
            owPlayer('B', 'Diamond', 1, 3000, 'Diamond', 1, 3000),
            owPlayer('A', 'Master', 1, 3500, 'Master', 1, 3500),
        ];
        const sorted = sortOverwatch(players);
        assertEqual(sorted[0].playerName, 'A', 'Master > Diamond');
    }},

    { name: 'OW: Top 500 beats all other ranks', fn: () => {
        const players = [
            owPlayer('B', 'Champion', 1, 4200, 'Champion', 1, 4200),
            owPlayer('A', 'Top 500', 100, 4500, 'Top 500', 50, 4600),
        ];
        const sorted = sortOverwatch(players);
        assertEqual(sorted[0].playerName, 'A', 'Top 500 > Champion');
    }},

    { name: 'OW: Top 500 — lower rank number wins', fn: () => {
        const players = [
            owPlayer('B', 'Top 500', 200, 4300, 'Top 500', 200, 4300),
            owPlayer('A', 'Top 500', 50, 4700, 'Top 500', 50, 4700),
        ];
        const sorted = sortOverwatch(players);
        assertEqual(sorted[0].playerName, 'A', 'Top 500 rank #50 > #200');
    }},

    { name: 'OW: tiebreak by peak rank', fn: () => {
        const players = [
            owPlayer('B', 'Diamond', 1, 3100, 'Diamond', 1, 3100),
            owPlayer('A', 'Diamond', 1, 3100, 'Master', 1, 3500),
        ];
        const sorted = sortOverwatch(players);
        assertEqual(sorted[0].playerName, 'A', 'better peak wins');
    }},

    // Deadlock

    { name: 'DL: higher rank wins', fn: () => {
        const players = [
            dlPlayer('B', 'Archon', 4, 1200),
            dlPlayer('A', 'Oracle', 1, 5000),
        ];
        const sorted = sortDeadlock(players);
        assertEqual(sorted[0].playerName, 'A', 'Oracle > Archon');
    }},

    { name: 'DL: same rank — higher tier wins (tier 6 > tier 5)', fn: () => {
        const players = [
            dlPlayer('B', 'Archon', 4, 1200),
            dlPlayer('A', 'Archon', 6, 900),
        ];
        const sorted = sortDeadlock(players);
        assertEqual(sorted[0].playerName, 'A', 'Archon 6 > Archon 4');
    }},

    { name: 'DL: same rank+tier — lower value wins', fn: () => {
        const players = [
            dlPlayer('B', 'Archon', 4, 1500),
            dlPlayer('A', 'Archon', 4, 900),
        ];
        const sorted = sortDeadlock(players);
        assertEqual(sorted[0].playerName, 'A', 'lower value wins in DL');
    }},

    { name: 'DL: tiebreak by most recent date', fn: () => {
        const players = [
            dlPlayer('B', 'Archon', 4, 1200, older),
            dlPlayer('A', 'Archon', 4, 1200, newest),
        ];
        const sorted = sortDeadlock(players);
        assertEqual(sorted[0].playerName, 'A', 'more recent wins');
    }},

    { name: 'DL: Eternus is highest rank', fn: () => {
        const players = [
            dlPlayer('B', 'Ascendant', 6, 100),
            dlPlayer('A', 'Eternus', 1, 9000),
        ];
        const sorted = sortDeadlock(players);
        assertEqual(sorted[0].playerName, 'A', 'Eternus > Ascendant');
    }},

  ]);
}
