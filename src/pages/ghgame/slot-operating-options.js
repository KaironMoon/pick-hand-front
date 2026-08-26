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
    ? ` · GH PNL ${formatConditionNumber(status.trigger_pnl)} P / GH 배팅 ${formatConditionNumber(status.trigger_bet_amount)} P · 중지`
    : " · 정상";
  return `${Math.round(afterRound)}회차 이후 GH ${formatConditionNumber(betLimit)} P 이상 배팅 시 이후 배팅 중지${state}`;
};

export const ghBetStopReasonLabel = (roundState) => {
  const overallStop = roundState?.overall_stop;
  const reason = overallStop?.reason;
  if (reason === "goal_reached") {
    return `현재 PNL ${formatConditionNumber(overallStop?.pnl)} P가 목표 ${formatConditionNumber(overallStop?.target)} P에 도달 (전체 목표금액 달성)`;
  }
  if (reason === "drawdown_reached") {
    return `현재 PNL ${formatConditionNumber(overallStop?.pnl)} P가 최고 PNL ${formatConditionNumber(overallStop?.drawdown_peak)} P 대비 종료 기준 ${formatConditionNumber(overallStop?.drawdown_threshold)} P 이하에 도달 (최고 PNL 손실률)`;
  }
  if (reason === "end_round_reached") {
    return `현재 ${Math.max(0, Number(roundState?.round_num || 0))}회차가 마감 ${Math.max(0, Number(overallStop?.end_round || 0))}회차에 도달 (미달 마감)`;
  }
  if (reason === "active_pot_limit_reached") {
    return `활성 POT ${Math.max(0, Number(overallStop?.active_pot_count || 0))}개가 종료 기준 ${Math.max(0, Number(overallStop?.pot_stop_count || 0))}개 이하에 도달 (잔여 POT 종료)`;
  }
  if (reason === "round_bet_loss_streak_reached") {
    const conditionNo = Number(overallStop?.round_bet_loss_streak_trigger_condition || 0);
    const lossStreakStop = Number(overallStop?.round_bet_loss_streak_stop || 0);
    const triggerRound = Number(overallStop?.round_bet_loss_streak_trigger_round || 0);
    const triggerBetAmount = Number(overallStop?.round_bet_loss_streak_trigger_bet_amount || 0);
    const betLimit = Number(overallStop?.round_bet_loss_streak_compared_bet_limit || 0);
    const conditionLabel = conditionNo > 0 ? ` ${conditionNo}번` : "";
    return `${Math.max(0, lossStreakStop)}연패 이후 ${Math.max(0, triggerRound)}회차 GH 배팅액 ${formatConditionNumber(triggerBetAmount)} P가 종료 기준 ${formatConditionNumber(betLimit)} P 이상에 도달 (배팅액판 연패중지${conditionLabel})`;
  }
  if (roundState?.profit_stop?.stopped) {
    const profitStop = roundState.profit_stop;
    return `GH PNL ${formatConditionNumber(profitStop.trigger_pnl)} P 상태에서 ${Math.max(0, Number(profitStop.stopped_at_round || 0))}회차 GH 배팅액 ${formatConditionNumber(profitStop.trigger_bet_amount)} P가 종료 기준 ${formatConditionNumber(profitStop.bet_limit)} P 이상에 도달 (수익보호)`;
  }
  return null;
};
