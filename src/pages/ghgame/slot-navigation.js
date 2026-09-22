const validGhSlotNo = (value) => {
  const slotNo = Number(value);
  return Number.isInteger(slotNo) && slotNo >= 1 && slotNo <= 6 ? slotNo : null;
};

export const ghSelectedSlotNo = (value) => validGhSlotNo(value) || 1;

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
