const formatConditionNumber = (value) => Number(value || 0).toLocaleString(
  "ko-KR",
  { maximumFractionDigits: 1 },
);

export const ghSlotLossStatusLabel = (status) => {
  const currentLimit = Number(status?.configured_limit || 0);
  const projectedLimit = Number(status?.configured_projected_limit || 0);
  if (currentLimit <= 0 && projectedLimit <= 0) return "사용안함";
  const trigger = status?.trigger === "projected_loss" ? "패배예상손실" : "현재손실";
  const scaleDetail = status?.mode === "auto" && Number(status?.pnl_scale || 1) !== 1
    ? ` (원값 PNL ${formatConditionNumber(status?.globalhit_pnl)} P ×${formatConditionNumber(status?.pnl_scale)})`
    : "";
  return `현재손실 ${currentLimit > 0 ? `${formatConditionNumber(currentLimit)} P` : "미사용"}`
    + ` · 패배예상손실 ${projectedLimit > 0 ? `${formatConditionNumber(projectedLimit)} P` : "미사용"}`
    + ` · GH PNL ${formatConditionNumber(status?.pnl)} P`
    + ` · 다음 GH ${formatConditionNumber(status?.bet_amount)} P`
    + ` · 패배예상 PNL ${formatConditionNumber(status?.projected_pnl)} P`
    + scaleDetail
    + (status?.stopped ? ` · ${trigger} 중지` : " · 정상");
};

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
  if (afterRound <= 0) return "사용안함";
  const state = status?.stopped
    ? ` · GH PNL ${formatConditionNumber(status.trigger_pnl)} P / GH 배팅 ${formatConditionNumber(status.trigger_bet_amount)} P · 중지`
    : " · 정상";
  return `${Math.round(afterRound)}회차 이후 GH PNL이 +인 경우 현재 GH PNL 이상 배팅 금지${state}`;
};

export const martinGoalStatusLabel = (status) => {
  const target = Number(status?.configured_target || 0);
  if (target <= 0) return "사용안함";
  const state = status?.reason === "martin_c_goal_reached" ? " · 중지" : " · 정상";
  return `목표 ${formatConditionNumber(target)} P · 마틴C PNL ${formatConditionNumber(status?.pnl)} P${state}`;
};

export const martinSlotLossStatusLabel = (status) => {
  const currentLimit = Number(status?.configured_loss_limit || 0);
  const projectedLimit = Number(status?.configured_projected_loss_limit || 0);
  if (currentLimit <= 0 && projectedLimit <= 0) return "사용안함";
  const stopped = ["martin_c_current_loss_reached", "martin_c_projected_loss_reached"].includes(status?.reason);
  return `현재손실 ${currentLimit > 0 ? `${formatConditionNumber(currentLimit)} P` : "미사용"}`
    + ` · 패배예상손실 ${projectedLimit > 0 ? `${formatConditionNumber(projectedLimit)} P` : "미사용"}`
    + ` · 마틴C PNL ${formatConditionNumber(status?.pnl)} P`
    + ` · 다음 마틴C ${formatConditionNumber(status?.bet_amount)} P`
    + ` · 패배예상 PNL ${formatConditionNumber(status?.projected_pnl)} P`
    + (stopped ? " · 중지" : " · 정상");
};

export const martinDrawdownStatusLabel = (status) => {
  const start = Number(status?.configured_drawdown_start || 0);
  const percent = Number(status?.drawdown_percent || 0);
  if (start <= 0 || percent <= 0) return "사용안함";
  const state = status?.reason === "martin_c_drawdown_reached"
    ? " · 중지"
    : status?.drawdown_armed
      ? ` · 감시중 (최고 ${formatConditionNumber(status?.drawdown_peak)} P)`
      : " · 대기";
  return `${formatConditionNumber(start)} P 이상 달성 시 최고 마틴C PNL에서 ${formatConditionNumber(percent)}% 이상 손실 나면 배팅 정지${state}`;
};

export const martinProfitStopStatusLabel = (status) => {
  const afterRound = Number(status?.profit_after_round || 0);
  if (afterRound <= 0) return "사용안함";
  const state = status?.reason === "martin_c_profit_bet_limit_reached"
    ? ` · 마틴C PNL ${formatConditionNumber(status?.trigger_pnl)} P / 마틴C 배팅 ${formatConditionNumber(status?.trigger_bet_amount)} P · 중지`
    : " · 정상";
  return `${Math.round(afterRound)}회차 이후 마틴C PNL이 +인 경우 현재 마틴C PNL 이상 배팅 금지${state}`;
};

export const martinBetStopReasonLabel = (status) => {
  if (!status?.stopped) return null;
  if (status.reason === "martin_c_goal_reached") {
    return `마틴C PNL ${formatConditionNumber(status.trigger_pnl)} P가 목표 ${formatConditionNumber(status.target)} P에 도달`;
  }
  if (status.reason === "martin_c_current_loss_reached") {
    return `마틴C PNL ${formatConditionNumber(status.trigger_pnl)} P가 종료 기준 -${formatConditionNumber(status.configured_loss_limit)} P 이하에 도달`;
  }
  if (status.reason === "martin_c_projected_loss_reached") {
    return `마틴C PNL ${formatConditionNumber(status.trigger_pnl)} P에서 다음 마틴C 배팅 ${formatConditionNumber(status.trigger_bet_amount)} P 패배 시 예상손실 기준에 도달`;
  }
  if (status.reason === "martin_c_drawdown_reached") {
    return `마틴C PNL ${formatConditionNumber(status.trigger_pnl)} P가 최고 ${formatConditionNumber(status.drawdown_peak)} P 대비 종료 기준 ${formatConditionNumber(status.drawdown_threshold)} P 이하에 도달`;
  }
  if (status.reason === "martin_c_profit_bet_limit_reached") {
    return `마틴C PNL ${formatConditionNumber(status.trigger_pnl)} P 상태에서 다음 마틴C 배팅 ${formatConditionNumber(status.trigger_bet_amount)} P가 현재 마틴C PNL 이상에 도달`;
  }
  return "마틴C 운영조건에 도달";
};

export const martinCBetAdjustmentStatusLabel = (status) => {
  if (!status) return "사용안함";
  const original = formatConditionNumber(status.original_net_amount);
  const adjusted = formatConditionNumber(status.adjusted_net_amount);
  if (status.mode === "fixed" && Number(status.fixed_amount || 0) > 0) {
    return `C 합산 ${original} P → 고정 ${adjusted} P`;
  }
  const applied = Object.entries(status.items || {})
    .filter(([, item]) => item?.applied_condition)
    .map(([key, item]) => {
      const cNo = key === "martin_c" ? 1 : Number(key.replace("martin_c", ""));
      return `C${cNo} ${formatConditionNumber(item.net_amount)}→${formatConditionNumber(item.adjusted_net_amount)} P (`
        + `${formatConditionNumber(item.applied_condition.start_amount)} P 초과~${formatConditionNumber(item.applied_condition.end_amount)} P 이하, `
        + `${formatConditionNumber(item.applied_condition.bet_percent)}%)`;
    });
  return applied.length > 0 ? applied.join(" / ") : "적용 없음";
};

export const ghRoundPnlStopStatusLabel = (overallStop) => {
  const conditions = Array.isArray(overallStop?.round_gh_pnl_conditions)
    ? overallStop.round_gh_pnl_conditions.filter((condition) => condition?.enabled)
    : [];
  if (conditions.length === 0) return "사용안함";
  const configured = conditions.map((condition) => (
    `${condition.condition_no}번 ${condition.start_round}~${condition.end_round}회 `
    + `GH PNL ${formatConditionNumber(condition.pnl_limit)} P 이하`
  )).join(" / ");
  if (overallStop?.reason !== "round_gh_pnl_range_reached") {
    return `${configured} · 대기`;
  }
  return `${configured} · ${overallStop.round_gh_pnl_trigger_condition}번 구간 `
    + `GH PNL ${formatConditionNumber(overallStop.round_gh_pnl_trigger_pnl)} P · 중지`;
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
  if (reason === "round_gh_pnl_range_reached") {
    return `${Math.max(0, Number(overallStop?.round_gh_pnl_trigger_start_round || 0))}~${Math.max(0, Number(overallStop?.round_gh_pnl_trigger_end_round || 0))}회 `
      + `GH PNL ${formatConditionNumber(overallStop?.round_gh_pnl_trigger_pnl)} P가 종료 기준 `
      + `${formatConditionNumber(overallStop?.round_gh_pnl_trigger_effective_pnl_limit)} P 이하에 도달 `
      + `(구간 GH PNL 중지 ${Math.max(1, Number(overallStop?.round_gh_pnl_trigger_condition || 1))}번)`;
  }
  const slotLossStop = roundState?.globalhit_loss_stop;
  if (slotLossStop?.stopped) {
    const pnl = formatConditionNumber(slotLossStop.pnl);
    if (slotLossStop.trigger === "projected_loss") {
      return `GH PNL ${pnl} P에서 다음 GH 배팅 ${formatConditionNumber(slotLossStop.bet_amount)} P 패배 시 예상 PNL ${formatConditionNumber(slotLossStop.projected_pnl)} P가 종료 기준 -${formatConditionNumber(slotLossStop.configured_projected_limit)} P 이하에 도달 (패배예상손실)`;
    }
    return `GH PNL ${pnl} P가 종료 기준 -${formatConditionNumber(slotLossStop.configured_limit)} P 이하에 도달 (현재손실)`;
  }
  if (roundState?.profit_stop?.stopped) {
    const profitStop = roundState.profit_stop;
    return `GH PNL ${formatConditionNumber(profitStop.trigger_pnl)} P 상태에서 ${Math.max(0, Number(profitStop.stopped_at_round || 0))}회차 GH 배팅액 ${formatConditionNumber(profitStop.trigger_bet_amount)} P가 현재 GH PNL 이상에 도달 (수익보호)`;
  }
  return null;
};
