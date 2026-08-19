export const NC2_SLOT_OPERATING_OPTIONS = Object.freeze([
  { key: "auto_goal_amount", label: "전체 목표금액 (P)", step: .1, help: "전체 실 PNL이 목표에 도달하면 다음 회차부터 배팅 중지" },
  { key: "auto_drawdown_start_amount", label: "손실감시 시작 (P)", step: .1, help: "전체 PNL이 이 금액에 도달한 뒤 최고 PNL 대비 손실률 감시" },
  { key: "auto_drawdown_percent", label: "최고PNL 손실률 (%)", step: .1, max: 100, help: "감시 시작 후 최고 PNL에서 이 비율 이상 하락하면 배팅 중지" },
  { key: "auto_end_round", label: "미달 마감 회차", step: 1, help: "설정 회차까지 배팅하고 다음 회차부터 배팅 중지" },
  { key: "profit_stop_after_round", label: "수익보호 시작 회차", step: 1, max: 60, help: "설정 회차까지 허용하고 다음 회차부터 슬롯 전체 PNL과 베팅액 검사" },
  { key: "profit_stop_bet_amount", label: "수익보호 중지액 (P)", step: .1, help: "슬롯 전체 PNL이 수익이고 다음 총 베팅액이 이 금액 이상이면 현재 슈 배팅 종료" },
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
  return `마틴 제외 순수 NC PNL ${formatConditionNumber(amount)} P 손실 시 NC 배팅 정지 · 오토는 PNL/손실금액 모두 실배팅 배율 적용`;
};

export const nc2JModeLabel = (config, state) => {
  if (!config?.j_mode_enabled) return "사용안함";
  return state?.j_mode?.active
    ? `적용중 · ${state.j_mode.direction || "대기"} ${formatConditionNumber(state.j_mode.amount)} P`
    : "사용함 · 21회차부터 NC 금액 + J 방향";
};

export const nc2ProfitStopConditionLabel = (config) => {
  const afterRound = Number(config?.profit_stop_after_round || 0);
  const betAmount = Number(config?.profit_stop_bet_amount || 0);
  if (
    !Number.isFinite(afterRound)
    || !Number.isFinite(betAmount)
    || afterRound <= 0
    || betAmount <= 0
  ) return "사용안함";
  return `${Math.round(afterRound)}회차 이후 ${formatConditionNumber(betAmount)} P 이상 배팅 할 경우 이후 배팅 중지`;
};
