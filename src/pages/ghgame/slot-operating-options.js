const formatConditionNumber = (value) => Number(value || 0).toLocaleString(
  "ko-KR",
  { maximumFractionDigits: 1 },
);

export const ghDrawdownStatusLabel = (status) => {
  const start = Number(status?.configured_drawdown_start ?? status?.drawdown_start ?? 0);
  const effectiveStart = Number(status?.effective_drawdown_start ?? status?.drawdown_start ?? 0);
  const percent = Number(status?.drawdown_percent || 0);
  if (start <= 0 || percent <= 0) return "사용안함";
  const state = status?.reason === "drawdown_reached"
    ? " · 중지"
    : status?.drawdown_armed
      ? ` · 감시중 (최고 ${formatConditionNumber(status.drawdown_peak)} P)`
      : " · 대기";
  const scaleDetail = effectiveStart > 0 && effectiveStart !== start
    ? ` · 판정 시작 ${formatConditionNumber(effectiveStart)} P`
    : "";
  return `${formatConditionNumber(start)} P 이상 달성 시 최고 PNL에서 ${formatConditionNumber(percent)}% 이상 손실 나면 배팅 정지${scaleDetail}${state}`;
};

export const ghProfitStopStatusLabel = (status) => {
  const afterRound = Number(status?.after_round || 0);
  const betLimit = Number(status?.bet_limit || 0);
  if (afterRound <= 0 || betLimit <= 0) return "사용안함";
  const state = status?.stopped
    ? ` · ${status.mode === "actual" ? "실PNL" : "계산PNL"} ${formatConditionNumber(status.trigger_pnl)} P / 배팅 ${formatConditionNumber(status.trigger_bet_amount)} P · 중지`
    : " · 정상";
  return `${Math.round(afterRound)}회차 이후 ${formatConditionNumber(betLimit)} P 이상 배팅 할 경우 이후 배팅 중지${state}`;
};
