const SOURCE_TYPES = new Set(["gh", "nc2"]);

export const SHOE_COPY_SOURCE_STORAGE_KEYS = {
  gh: "gh_shoe_copy_source_type",
  nc2: "nc2_shoe_copy_source_type",
};

export function loadShoeCopySourceType(storageKey, fallback, storage = globalThis.localStorage) {
  const saved = storage?.getItem(storageKey);
  return SOURCE_TYPES.has(saved) ? saved : fallback;
}

export function saveShoeCopySourceType(storageKey, sourceType, storage = globalThis.localStorage) {
  if (storage && SOURCE_TYPES.has(sourceType)) storage.setItem(storageKey, sourceType);
}

export function shoeCopyEnterAction({ preview, sourceType, sourceGameInput, busy = false }) {
  if (busy) return "none";
  const sourceGameId = Number(sourceGameInput);
  const previewMatches = (
    Number.isInteger(sourceGameId)
    && sourceGameId > 0
    && preview?.source_game_type === sourceType
    && Number(preview?.source_game_id) === sourceGameId
  );
  return previewMatches ? "execute" : "lookup";
}
