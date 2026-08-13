export const NC2_KEEP_COMBINATION_KEY = "nc2_keep_combination";
const NC2_COMBINATION_COUNTS = new Set([32, 64, 96, 128]);

export function loadNc2KeepCombination(storage = globalThis.localStorage) {
  const raw = storage?.getItem(NC2_KEEP_COMBINATION_KEY);
  if (!raw) return null;
  try {
    const values = JSON.parse(raw);
    if (!Array.isArray(values) || !NC2_COMBINATION_COUNTS.has(values.length)) return null;
    const gameSeqs = values.map(Number);
    if (gameSeqs.some((value) => !Number.isInteger(value) || value <= 0)) return null;
    if (new Set(gameSeqs).size !== gameSeqs.length) return null;
    return gameSeqs;
  } catch {
    return null;
  }
}

export function saveNc2KeepCombination(gameSeqs, storage = globalThis.localStorage) {
  if (!storage) return;
  storage.setItem(NC2_KEEP_COMBINATION_KEY, JSON.stringify(gameSeqs));
}

export function clearNc2KeepCombination(storage = globalThis.localStorage) {
  storage?.removeItem(NC2_KEEP_COMBINATION_KEY);
}
