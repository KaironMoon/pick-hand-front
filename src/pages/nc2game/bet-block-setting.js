export const normalizeBetBlockAfterRound = (value) => {
  const round = Math.round(Number(value) || 0);
  return Math.max(0, Math.min(60, round));
};

export const normalizeBetAllowedStepRange = (minValue, maxValue) => {
  const min = Math.max(1, Math.min(25, Math.round(Number(minValue) || 1)));
  const max = Math.max(min, Math.min(25, Math.round(Number(maxValue) || 25)));
  return [min, max];
};

export const betStepRangeLabel = (roundValue, minValue, maxValue) => {
  const round = normalizeBetBlockAfterRound(roundValue);
  const [min, max] = normalizeBetAllowedStepRange(minValue, maxValue);
  return round > 0
    ? `${round}회차 이후 ${min}~${max}단계만 배팅 허용`
    : "사용안함";
};
