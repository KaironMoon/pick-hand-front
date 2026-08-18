export const NC2_SLOT_OPERATING_OPTIONS = Object.freeze([
  { key: "auto_goal_amount", label: "전체 목표금액 (P)", step: .1, help: "전체 실 PNL이 목표에 도달하면 다음 회차부터 배팅 중지" },
  { key: "auto_drawdown_start_amount", label: "손실감시 시작 (P)", step: .1, help: "전체 PNL이 이 금액에 도달한 뒤 최고 PNL 대비 손실률 감시" },
  { key: "auto_drawdown_percent", label: "최고PNL 손실률 (%)", step: .1, max: 100, help: "감시 시작 후 최고 PNL에서 이 비율 이상 하락하면 배팅 중지" },
  { key: "auto_end_round", label: "미달 마감 회차", step: 1, help: "설정 회차까지 배팅하고 다음 회차부터 배팅 중지" },
]);

export const replaceNc2SlotSetup = (setups, slotNo, nextSetup) => (
  setups.map((setup, index) => (index === slotNo - 1 ? nextSetup : setup))
);

const formatConditionNumber = (value) => Number(value || 0).toLocaleString(
  "ko-KR",
  { maximumFractionDigits: 1 },
);

export const nc2DrawdownConditionLabel = (config) => {
  const startAmount = Number(config?.auto_drawdown_start_amount || 0);
  const lossPercent = Number(config?.auto_drawdown_percent || 0);
  if (
    !Number.isFinite(startAmount)
    || !Number.isFinite(lossPercent)
    || startAmount <= 0
    || lossPercent <= 0
  ) return "사용안함";
  return `${formatConditionNumber(startAmount)} P 이상 달성 시 최고 PNL에서 ${formatConditionNumber(lossPercent)}% 이상 손실 나면 배팅 정지`;
};

export const nc2SlotLossStopLabel = (config) => {
  const amount = Number(config?.slot_loss_stop_amount ?? config?.item_loss_stop_amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return "사용안함";
  return `슬롯 NC 합산 누적 ${formatConditionNumber(amount)} P 손실 시 NC 배팅 전체 정지`;
};
