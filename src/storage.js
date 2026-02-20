// ============================================================
// storage.js — Encode & decode leaderboard state
//
// Strategy: State is stored as a JSON block inside the webhook
// message, hidden inside an HTML comment that Discord renders
// invisibly, after the human-readable leaderboard text.
//
// Format (full webhook message content):
//   <human readable leaderboard>
//   <!--STATE:{"players":[...]}-->
// ============================================================

const STATE_OPEN = '<!--STATE:';
const STATE_CLOSE = '-->';

/**
 * Encode a state object into the hidden JSON block.
 * @param {object} state  e.g. { players: [...] }
 * @returns {string}
 */
export function encodeState(state) {
  const json = JSON.stringify(state, null, 0);
  return `${STATE_OPEN}${json}${STATE_CLOSE}`;
}

/**
 * Decode state from a full webhook message string.
 * Returns { players: [] } if no state block is found (fresh start).
 * @param {string} messageContent
 * @returns {object}
 */
export function decodeState(messageContent) {
  if (!messageContent || typeof messageContent !== 'string') {
    return { players: [] };
  }

  const start = messageContent.indexOf(STATE_OPEN);
  if (start === -1) return { players: [] };

  const jsonStart = start + STATE_OPEN.length;
  const end = messageContent.indexOf(STATE_CLOSE, jsonStart);
  if (end === -1) return { players: [] };

  const json = messageContent.slice(jsonStart, end);
  try {
    const parsed = JSON.parse(json);
    // Restore Date objects (stored as ISO strings)
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

/**
 * Upsert a player record into the state's players array.
 * If a player with the same name already exists:
 *   - Only update if the incoming data is NEWER than existing
 * @param {object[]} players  mutable array from state
 * @param {object}   data     parsed player update
 * @returns {boolean} true if the record was updated/inserted
 */
export function upsertPlayer(players, data) {
  const idx = players.findIndex(
    p => p.playerName.toLowerCase() === data.playerName.toLowerCase()
  );

  if (idx === -1) {
    // New player — insert
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

  // Update in-place
  players[idx] = serialisePlayer(data);
  return true;
}

/** Normalise a parsed data object for storage (Date → ISO string) */
function serialisePlayer(data) {
  return {
    ...data,
    date: data.date instanceof Date ? data.date.toISOString() : new Date().toISOString(),
  };
}
