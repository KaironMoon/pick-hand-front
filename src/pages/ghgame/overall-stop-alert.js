const STOP_ALERTS = {
  goal_reached: {
    title: "전체 목표금액 달성",
    detail: "전체 목표금액을 달성하여 배팅이 정지되었습니다.",
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
    detail: "설정 연패 단계 이후 실제 주문액이 기준금액에 도달하여 배팅이 정지되었습니다.",
  },
};

const formatBetAmount = (value) => Number(value).toLocaleString(undefined, {
  maximumFractionDigits: 1,
});

const stopAlertDetail = (alert, reason, mode, stopDetail) => {
  if (reason !== "round_bet_loss_streak_reached") return alert.detail;
  const triggerRound = Number(stopDetail?.round_bet_loss_streak_trigger_round || 0);
  const triggerBetAmount = Number(stopDetail?.round_bet_loss_streak_trigger_bet_amount || 0);
  if (!Number.isInteger(triggerRound) || triggerRound <= 0
      || !Number.isFinite(triggerBetAmount) || triggerBetAmount <= 0) {
    return alert.detail;
  }
  const betLabel = mode === "auto" ? "실제 주문액" : "배팅액";
  return `${triggerRound}회차 ${betLabel} ${formatBetAmount(triggerBetAmount)} P가 기준금액에 도달하여 배팅이 정지되었습니다.`;
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
    detail: stopAlertDetail(alert, reason, mode, stopDetail),
    modeLabel: mode === "auto" ? "오토" : "수동",
  };
};
