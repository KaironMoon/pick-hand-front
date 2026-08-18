export const normalizeBetBlockAfterRound = (value) => {
  const round = Math.round(Number(value) || 0);
  return Math.max(0, Math.min(60, round));
};

export const betStopRoundLabel = (roundValue) => {
  const round = normalizeBetBlockAfterRound(roundValue);
  return round > 0
    ? `${round}회차부터 배팅 중지`
    : "사용안함";
};
