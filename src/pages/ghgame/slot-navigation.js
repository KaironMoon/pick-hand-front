const validGhSlotNo = (value) => {
  const slotNo = Number(value);
  return Number.isInteger(slotNo) && slotNo >= 1 && slotNo <= 6 ? slotNo : null;
};

export const ghSelectedSlotNo = (value) => validGhSlotNo(value) || 1;

// A game ID is usable only when it is mapped to one of the current user slots.
export const ghEntrySlot = (slots, { gameId, slotNo } = {}) => {
  const items = Array.isArray(slots) ? slots : [];
  const id = Number(gameId);
  const mapped = Number.isSafeInteger(id) && id > 0
    ? items.find((slot) => slot.occupied && Number(slot.game_id) === id)
    : null;
  if (mapped) return mapped;
  const selected = ghSelectedSlotNo(slotNo);
  return items.find((slot) => Number(slot.slot_no) === selected)
    || { slot_no: selected, occupied: false };
};

export const ghSetupsArray = (raw) => Array.from({ length: 6 }, (_, index) => {
  const saved = Array.isArray(raw?.gh_setups) ? raw.gh_setups[index] : null;
  return saved || raw || null;
});

export const replaceGhSlotSetup = (setups, slotNo, nextSetup) => (
  setups.map((setup, index) => (index === slotNo - 1 ? nextSetup : setup))
);

export const updateGhGameSearchParams = (current, { slotNo, gameId } = {}) => {
  const next = new URLSearchParams(current);
  const validSlotNo = validGhSlotNo(slotNo);
  if (validSlotNo) next.set("slot", String(validSlotNo));
  if (gameId === null) next.delete("gameId");
  else if (Number.isInteger(Number(gameId)) && Number(gameId) > 0) next.set("gameId", String(gameId));
  return next;
};
