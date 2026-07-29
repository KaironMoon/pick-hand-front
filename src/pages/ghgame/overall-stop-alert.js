const STOP_ALERTS = {
  goal_reached: {
    title: "전체 목표금액 달성",
    detail: "전체 목표금액을 달성하여 배팅이 정지되었습니다.",
  },
  end_round_reached: {
    title: "미달마감 도달",
    detail: "미달마감 회차에 도달하여 배팅이 정지되었습니다.",
  },
};

export const claimOverallStopAlert = (
  alertedGameIds,
  gameId,
  reason,
  mode,
) => {
  const alert = STOP_ALERTS[reason];
  if (!alert || gameId === null || gameId === undefined) return null;
  const key = String(gameId);
  if (alertedGameIds.has(key)) return null;
  alertedGameIds.add(key);
  return {
    ...alert,
    modeLabel: mode === "auto" ? "오토" : "수동",
  };
};
