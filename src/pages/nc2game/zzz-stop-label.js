export function nc2ZzzStopLabel(stopRound, stopStep, lossStopAmount = 0) {
  const round = Math.max(0, Math.trunc(Number(stopRound) || 0));
  const step = Math.max(0, Math.trunc(Number(stopStep) || 0));
  const loss = Math.max(0, Number(lossStopAmount) || 0);
  const lossLabel = loss > 0 ? `${loss.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}P 손실 시 종료` : "";

  if (round === 0) return lossLabel || "종료조건 미사용";
  const roundLabel = step === 0
    ? `${round}회차 종료`
    : `${round}회차 이후 ${step}패 도달 시 종료`;
  return lossLabel ? `${roundLabel} / ${lossLabel}` : roundLabel;
}
