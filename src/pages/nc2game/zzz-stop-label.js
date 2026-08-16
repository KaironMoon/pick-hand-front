export function nc2ZzzStopLabel(stopRound, stopStep) {
  const round = Math.max(0, Math.trunc(Number(stopRound) || 0));
  const step = Math.max(0, Math.trunc(Number(stopStep) || 0));

  if (round === 0) return "종료조건 미사용";
  if (step === 0) return `${round}회차 종료`;
  return `${round}회차 이후 ${step}패 도달 시 종료`;
}
