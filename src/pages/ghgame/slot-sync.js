export function findGhSlotReplacement(slots, currentGameId, selectedSlotNo) {
  const items = Array.isArray(slots) ? slots : [];
  const currentId = Number(currentGameId);
  if (!Number.isFinite(currentId) || currentId <= 0) return null;
  if (items.some((slot) => Number(slot.game_id) === currentId)) return null;

  const linked = items.find(
    (slot) => slot.occupied && Number(slot.previous_game_id) === currentId,
  );
  if (linked) return linked;

  const slotNo = Number(selectedSlotNo);
  if (!Number.isInteger(slotNo) || slotNo < 1 || slotNo > 6) return null;
  const selected = items.find((slot) => slot.slot_no === slotNo && slot.occupied);
  return selected && Number(selected.game_id) !== currentId ? selected : null;
}

export function findGhSlotByNumber(slots, slotNo) {
  const selected = Number(slotNo);
  if (!Number.isInteger(selected) || selected < 1 || selected > 6) return null;
  const items = Array.isArray(slots) ? slots : [];
  return items.find((slot) => Number(slot.slot_no) === selected) || null;
}
