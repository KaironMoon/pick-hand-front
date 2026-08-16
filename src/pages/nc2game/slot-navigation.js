const validNc2SlotNo = (value) => {
  const slotNo = Number(value);
  return Number.isInteger(slotNo) && slotNo >= 1 && slotNo <= 6 ? slotNo : null;
};

export const nc2SelectedSlotNo = (value) => validNc2SlotNo(value) || 1;

export const updateNc2GameSearchParams = (current, { slotNo, gameId } = {}) => {
  const next = new URLSearchParams(current);
  const validSlotNo = validNc2SlotNo(slotNo);
  if (validSlotNo) next.set("slot", String(validSlotNo));
  if (gameId === null) next.delete("gameId");
  else if (Number.isInteger(Number(gameId)) && Number(gameId) > 0) next.set("gameId", String(gameId));
  return next;
};

export const nc2SetupPath = (slotNo) => {
  const validSlotNo = validNc2SlotNo(slotNo);
  return validSlotNo ? `/nc2game/user-setup?slot=${validSlotNo}` : "/nc2game/user-setup";
};

export const nc2GameReturnPath = (slotNo) => {
  const validSlotNo = validNc2SlotNo(slotNo);
  return validSlotNo ? `/nc2game/user?slot=${validSlotNo}` : "/nc2game/user";
};
