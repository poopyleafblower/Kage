import { playableItemId } from "./watch";

const storageKey = "vidstack_settings";

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    return {};
  }
}

function progressKey(titleId, itemId) {
  return JSON.stringify([String(titleId), String(itemId)]);
}

export function readItemProgress(titleId, itemId) {
  const history = readHistory();
  const legacy = history[titleId];
  return history[progressKey(titleId, itemId)] ||
    (legacy && playableItemId(legacy.epNum) === itemId ? legacy : null);
}

export function writeItemProgress(record) {
  try {
    const history = readHistory();
    const itemId = playableItemId(record.epNum);
    history[progressKey(record.aniId, itemId)] = { ...record, itemId };
    localStorage.setItem(storageKey, JSON.stringify(history));
  } catch {
    // Playback can continue with storage disabled.
  }
}

export function readLocalWatchHistory() {
  const latestByTitle = new Map();
  const records = Object.values(readHistory()).filter((record) => record?.aniId && record.epNum);
  records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  for (const record of records) {
    const titleId = String(record.aniId);
    if (!latestByTitle.has(titleId)) latestByTitle.set(titleId, record);
  }
  return [...latestByTitle.values()];
}

export function removeLocalWatchHistory(titleId) {
  try {
    const history = readHistory();
    for (const [key, record] of Object.entries(history)) {
      if (String(record?.aniId || key) === String(titleId)) delete history[key];
    }
    localStorage.setItem(storageKey, JSON.stringify(history));
  } catch {
    // Storage may be disabled.
  }
}
