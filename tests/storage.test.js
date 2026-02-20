// ============================================================
// tests/storage.test.js
// ============================================================

import { encodeState, decodeState, upsertPlayer } from '../src/storage.js';
import { runSuite, assertEqual, assert } from './helpers.js';

export async function runStorageTests() {
  return runSuite('Storage', [

    { name: 'encodeState: round-trip basic object', fn: () => {
        const state = { players: [{ playerName: 'Turbo', rankCurrent: 'Diamond' }] };
        const encoded = encodeState(state);
        assert(encoded.includes('<!--STATE:'), 'has open tag');
        assert(encoded.includes('-->'), 'has close tag');
        assert(encoded.includes('Turbo'), 'has player name');
    }},

    { name: 'decodeState: extracts from full message content', fn: () => {
        const state = { players: [{ playerName: 'Alpha', rankCurrent: 'Master', date: new Date().toISOString() }] };
        const encoded = encodeState(state);
        const fullContent = `## Leaderboard\nSome content here\n${encoded}`;
        const decoded = decodeState(fullContent);
        assertEqual(decoded.players.length, 1, 'player count');
        assertEqual(decoded.players[0].playerName, 'Alpha', 'player name');
    }},

    { name: 'decodeState: returns empty state on null input', fn: () => {
        const result = decodeState(null);
        assertEqual(result.players, [], 'empty players');
    }},

    { name: 'decodeState: returns empty state on missing STATE block', fn: () => {
        const result = decodeState('## Just a leaderboard, no state block');
        assertEqual(result.players, [], 'empty players');
    }},

    { name: 'decodeState: restores Date objects from ISO strings', fn: () => {
        const iso = '2026-01-15T10:00:00.000Z';
        const state = { players: [{ playerName: 'X', date: iso }] };
        const decoded = decodeState(encodeState(state));
        assert(decoded.players[0].date instanceof Date, 'date is Date object');
        assertEqual(decoded.players[0].date.toISOString(), iso, 'ISO round-trip');
    }},

    { name: 'decodeState: corrupted JSON returns empty state', fn: () => {
        const bad = '<!--STATE:{broken json-->remaining';
        const result = decodeState(bad);
        assertEqual(result.players, [], 'graceful fallback');
    }},

    { name: 'upsertPlayer: inserts new player', fn: () => {
        const players = [];
        const data = { playerName: 'NewGuy', rankCurrent: 'Gold', date: new Date() };
        const updated = upsertPlayer(players, data);
        assert(updated, 'should return true');
        assertEqual(players.length, 1, 'one player');
        assertEqual(players[0].playerName, 'NewGuy', 'player name');
    }},

    { name: 'upsertPlayer: updates existing player with newer date', fn: () => {
        const oldDate = new Date(Date.now() - 86_400_000);
        const players = [{ playerName: 'Turbo', rankCurrent: 'Diamond', date: oldDate.toISOString() }];
        const data = { playerName: 'Turbo', rankCurrent: 'Grandmaster', date: new Date() };
        const updated = upsertPlayer(players, data);
        assert(updated, 'should return true');
        assertEqual(players.length, 1, 'still one player');
        assertEqual(players[0].rankCurrent, 'Grandmaster', 'rank updated');
    }},

    { name: 'upsertPlayer: rejects stale update (older date)', fn: () => {
        const players = [{ playerName: 'Alpha', rankCurrent: 'Master', date: new Date().toISOString() }];
        const oldData = { playerName: 'Alpha', rankCurrent: 'Diamond', date: new Date(0) };
        const updated = upsertPlayer(players, oldData);
        assert(!updated, 'should return false for stale update');
        assertEqual(players[0].rankCurrent, 'Master', 'rank unchanged');
    }},

    { name: 'upsertPlayer: case-insensitive player name matching', fn: () => {
        const players = [{ playerName: 'turbo', rankCurrent: 'Diamond', date: new Date().toISOString() }];
        const data = { playerName: 'TURBO', rankCurrent: 'Master', date: new Date(Date.now() + 1000) };
        upsertPlayer(players, data);
        assertEqual(players.length, 1, 'no duplicate inserted');
    }},

    { name: 'encodeState + decodeState: full round-trip with multiple players', fn: () => {
        const original = {
            players: [
                { playerName: 'A', game: 'MARVEL_RIVALS', rankCurrent: 'Diamond', tierCurrent: 1, date: new Date().toISOString() },
                { playerName: 'B', game: 'MARVEL_RIVALS', rankCurrent: 'Master', tierCurrent: 2, date: new Date().toISOString() },
            ]
        };
        const encoded = encodeState(original);
        const decoded = decodeState(`Some leaderboard text\n${encoded}`);
        assertEqual(decoded.players.length, 2, '2 players');
        assertEqual(decoded.players[0].playerName, 'A', 'player A');
        assertEqual(decoded.players[1].rankCurrent, 'Master', 'player B rank');
    }},

  ]);
}
