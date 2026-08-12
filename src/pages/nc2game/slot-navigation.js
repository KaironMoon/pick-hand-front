const validNc2SlotNo = (value) => {
  const slotNo = Number(value);
  return Number.isInteger(slotNo) && slotNo >= 1 && slotNo <= 6 ? slotNo : null;
};

export const nc2SetupPath = (slotNo) => {
  const validSlotNo = validNc2SlotNo(slotNo);
  return validSlotNo ? `/nc2game/user-setup?slot=${validSlotNo}` : "/nc2game/user-setup";
};

export const nc2GameReturnPath = (slotNo) => {
  const validSlotNo = validNc2SlotNo(slotNo);
  return validSlotNo ? `/nc2game/user?slot=${validSlotNo}` : "/nc2game/user";
};
