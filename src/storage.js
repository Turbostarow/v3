// ============================================================
// storage.js — Encode & decode leaderboard state
//
// State is stored as pinned messages in the PRIVATE listening
// channel (#lb-update), NOT in the public leaderboard messages.
// Each game gets one pinned state message identified by a marker.
//
// Pinned state message format:
//   LB_STATE:MARVEL_RIVALS:{"players":[...]}
// ============================================================

const STATE_PREFIX = 'LB_STATE:';

export function stateMarker(game) {
  return `${STATE_PREFIX}${game}:`;
}

export function encodeState(game, state) {
  const json = JSON.stringify(state, null, 0);
  return `${stateMarker(game)}${json}`;
}

export function decodeState(messageContent) {
  if (!messageContent || typeof messageContent !== 'string') {
    return { players: [] };
  }
  // Format: LB_STATE:GAME:{...}  — find second colon
  const firstColon = messageContent.indexOf(':');
  if (firstColon === -1) return { players: [] };
  const secondColon = messageContent.indexOf(':', firstColon + 1);
  if (secondColon === -1) return { players: [] };

  const json = messageContent.slice(secondColon + 1);
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed.players)) {
      parsed.players = parsed.players.map(p => ({
        ...p,
        date: p.date ? new Date(p.date) : new Date(),
      }));
    }
    return parsed;
  } catch (err) {
    console.error('[storage] Failed to parse state JSON:', err.message);
    return { players: [] };
  }
}

export function upsertPlayer(players, data) {
  const idx = players.findIndex(
    p => p.playerName.toLowerCase() === data.playerName.toLowerCase()
  );

  if (idx === -1) {
    players.push(serialisePlayer(data));
    return true;
  }

  const existing = players[idx];
  const existingDate = existing.date ? new Date(existing.date) : new Date(0);
  const incomingDate = data.date instanceof Date ? data.date : new Date(data.date);

  if (incomingDate < existingDate) {
    console.log(
      `[storage] Skipping stale update for ${data.playerName}: ` +
      `incoming ${incomingDate.toISOString()} < existing ${existingDate.toISOString()}`
    );
    return false;
  }

  players[idx] = serialisePlayer(data);
  return true;
}

function serialisePlayer(data) {
  return {
    ...data,
    date: data.date instanceof Date ? data.date.toISOString() : new Date().toISOString(),
  };
}
