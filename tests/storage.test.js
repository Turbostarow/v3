// ============================================================
// tests/storage.test.js
// ============================================================

import { encodeState, decodeState, stateMarker } from '../src/storage.js';
import { upsertPlayer } from '../src/storage.js';
import { runSuite, assertEqual, assert } from './helpers.js';

export async function runStorageTests() {
  return runSuite('Storage', [

    { name: 'stateMarker: correct format', fn: () => {
        assertEqual(stateMarker('MARVEL_RIVALS'), 'LB_STATE:MARVEL_RIVALS:', 'marker');
    }},

    { name: 'encodeState: contains marker and JSON', fn: () => {
        const encoded = encodeState('OVERWATCH', { players: [{ playerName: 'Alpha' }] });
        assert(encoded.startsWith('LB_STATE:OVERWATCH:'), 'starts with marker');
        assert(encoded.includes('Alpha'), 'has player name');
    }},

    { name: 'decodeState: round-trip from encoded string', fn: () => {
        const encoded = encodeState('DEADLOCK', { players: [{ playerName: 'X', date: new Date().toISOString() }] });
        const decoded = decodeState(encoded);
        assertEqual(decoded.players.length, 1, '1 player');
        assertEqual(decoded.players[0].playerName, 'X', 'player name');
    }},

    { name: 'decodeState: returns empty state on null input', fn: () => {
        const result = decodeState(null);
        assertEqual(result.players, [], 'empty players');
    }},

    { name: 'decodeState: returns empty state on missing marker', fn: () => {
        const result = decodeState('Just some random text');
        assertEqual(result.players, [], 'empty players');
    }},

    { name: 'decodeState: restores Date objects from ISO strings', fn: () => {
        const iso = '2026-01-15T10:00:00.000Z';
        const encoded = encodeState('MARVEL_RIVALS', { players: [{ playerName: 'X', date: iso }] });
        const decoded = decodeState(encoded);
        assert(decoded.players[0].date instanceof Date, 'date is Date object');
        assertEqual(decoded.players[0].date.toISOString(), iso, 'ISO round-trip');
    }},

    { name: 'decodeState: corrupted JSON returns empty state', fn: () => {
        const bad = 'LB_STATE:DEADLOCK:{broken json';
        const result = decodeState(bad);
        assertEqual(result.players, [], 'graceful fallback');
    }},

    { name: 'upsertPlayer: inserts new player', fn: () => {
        const players = [];
        const data = { playerName: 'NewGuy', rankCurrent: 'Gold', date: new Date() };
        const updated = upsertPlayer(players, data);
        assert(updated, 'should return true');
        assertEqual(players.length, 1, 'one player');
    }},

    { name: 'upsertPlayer: updates existing player with newer date', fn: () => {
        const oldDate = new Date(Date.now() - 86_400_000);
        const players = [{ playerName: 'Turbo', rankCurrent: 'Diamond', date: oldDate.toISOString() }];
        const data = { playerName: 'Turbo', rankCurrent: 'Grandmaster', date: new Date() };
        const updated = upsertPlayer(players, data);
        assert(updated, 'should return true');
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

    { name: 'full round-trip with multiple players', fn: () => {
        const original = {
            players: [
                { playerName: 'A', game: 'MARVEL_RIVALS', rankCurrent: 'Diamond', date: new Date().toISOString() },
                { playerName: 'B', game: 'MARVEL_RIVALS', rankCurrent: 'Grandmaster', date: new Date().toISOString() },
            ]
        };
        const encoded = encodeState('MARVEL_RIVALS', original);
        const decoded = decodeState(encoded);
        assertEqual(decoded.players.length, 2, '2 players');
        assertEqual(decoded.players[0].playerName, 'A', 'player A');
        assertEqual(decoded.players[1].rankCurrent, 'Grandmaster', 'player B rank');
    }},

  ]);
}
