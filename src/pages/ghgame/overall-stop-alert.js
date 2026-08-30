const STOP_ALERTS = {
  goal_reached: {
    title: "목표금액 달성",
    detail: "목표금액을 달성하여 배팅이 정지되었습니다.",
  },
  drawdown_reached: {
    title: "최고 PNL 손실률 도달",
    detail: "최고 PNL 대비 설정 손실률에 도달하여 배팅이 정지되었습니다.",
  },
  end_round_reached: {
    title: "미달마감 도달",
    detail: "미달마감 회차에 도달하여 배팅이 정지되었습니다.",
  },
  active_pot_limit_reached: {
    title: "잔여 POT 종료",
    detail: "활성 배팅 POT 수가 설정값 이하가 되어 배팅이 정지되었습니다.",
  },
  round_bet_loss_streak_reached: {
    title: "배팅액판 연패중지",
    detail: "설정 연패 단계 이후 배팅액이 기준금액에 도달하여 배팅이 정지되었습니다.",
  },
  round_gh_pnl_range_reached: {
    title: "구간 GH PNL 조건 도달",
    detail: "설정 회차 구간의 GH PNL이 기준값 이하가 되어 배팅이 정지되었습니다.",
  },
};

const formatBetAmount = (value) => Number(value).toLocaleString(undefined, {
  maximumFractionDigits: 1,
});

const stopAlertDetail = (alert, reason, mode, stopDetail) => {
  const recoveredMartins = Object.values(stopDetail?.martin_recovery?.targets || {})
    .some((target) => target?.required);
  const recoveryCompleted = stopDetail?.martin_recovery?.completed && recoveredMartins;
  if (reason === "goal_reached") return recoveryCompleted
    ? "전체 목표금액 달성 후 진행 중이던 마틴 회수까지 완료되어 최종 배팅이 정지되었습니다."
    : "전체 목표금액을 달성하여 배팅이 정지되었습니다.";
  if (reason === "drawdown_reached") return recoveryCompleted
    ? "최고 PNL 손실률 도달 후 진행 중이던 마틴 회수까지 완료되어 최종 배팅이 정지되었습니다."
    : "최고 PNL 대비 설정 손실률에 도달하여 배팅이 정지되었습니다.";
  if (reason === "round_gh_pnl_range_reached") {
    const conditionNo = Math.max(1, Number(stopDetail?.round_gh_pnl_trigger_condition || 1));
    const startRound = Math.max(0, Number(stopDetail?.round_gh_pnl_trigger_start_round || 0));
    const endRound = Math.max(0, Number(stopDetail?.round_gh_pnl_trigger_end_round || 0));
    const pnl = formatBetAmount(stopDetail?.round_gh_pnl_trigger_pnl || 0);
    const limit = formatBetAmount(stopDetail?.round_gh_pnl_trigger_effective_pnl_limit || 0);
    const triggerDetail = `${conditionNo}번 조건 ${startRound}~${endRound}회 GH PNL ${pnl} P가 기준 ${limit} P 이하에 도달`;
    return recoveryCompleted
      ? `${triggerDetail}한 후 진행 중이던 마틴 회수까지 완료되어 최종 배팅이 정지되었습니다.`
      : `${triggerDetail}하여 배팅이 정지되었습니다.`;
  }
  if (reason !== "round_bet_loss_streak_reached") return recoveryCompleted
    ? `${alert.title} 조건 발동 후 진행 중이던 마틴 회수까지 완료되어 최종 배팅이 정지되었습니다.`
    : alert.detail;
  const triggerRound = Number(stopDetail?.round_bet_loss_streak_trigger_round || 0);
  const triggerBetAmount = Number(stopDetail?.round_bet_loss_streak_trigger_bet_amount || 0);
  const conditionNo = Number(stopDetail?.round_bet_loss_streak_trigger_condition || 0);
  if (!Number.isInteger(triggerRound) || triggerRound <= 0
      || !Number.isFinite(triggerBetAmount) || triggerBetAmount <= 0) {
    return alert.detail;
  }
  const appliedBetLabel = mode === "auto" ? "실제 GH 배팅액" : "GH 배팅액";
  const conditionLabel = conditionNo > 0 ? `${conditionNo}번 조건이 발동하여 ` : "";
  const triggerDetail = `${conditionLabel}${triggerRound}회차 ${appliedBetLabel} ${formatBetAmount(triggerBetAmount)} P가 기준금액에 도달`;
  return recoveryCompleted
    ? `${triggerDetail}한 후 진행 중이던 마틴 회수까지 완료되어 최종 배팅이 정지되었습니다.`
    : `${triggerDetail}하여 배팅이 정지되었습니다.`;
};

export const claimOverallStopAlert = (
  alertedGameIds,
  gameId,
  reason,
  mode,
  stopDetail,
) => {
  const alert = STOP_ALERTS[reason];
  if (!alert || gameId === null || gameId === undefined) return null;
  const key = String(gameId);
  if (alertedGameIds.has(key)) return null;
  alertedGameIds.add(key);
  return {
    ...alert,
    title: reason === "goal_reached" ? "전체 목표금액 달성" : alert.title,
    detail: stopAlertDetail(alert, reason, mode, stopDetail),
    modeLabel: mode === "auto" ? "오토" : "수동",
  };
};
