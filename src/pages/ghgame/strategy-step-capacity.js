export const GH_STRATEGY_MAX_STEP = 20;
export const GH_FIXED_PASI_LEVELS = Array.from(
  { length: GH_STRATEGY_MAX_STEP - 1 },
  (_, index) => index + 2,
);

export function extendMartinAmounts(amounts, previousStepMax, nextStepMax) {
  const next = [...(Array.isArray(amounts) ? amounts : []), ...Array(GH_STRATEGY_MAX_STEP).fill(0)]
    .slice(0, GH_STRATEGY_MAX_STEP);
  const start = Math.max(1, Math.min(GH_STRATEGY_MAX_STEP, Number(previousStepMax || 1)));
  const end = Math.max(start, Math.min(GH_STRATEGY_MAX_STEP, Number(nextStepMax || start)));
  for (let index = start; index < end; index += 1) {
    if (Number(next[index] || 0) > 0) continue;
    next[index] = Math.round(Number(next[index - 1] || 0) * 20) / 10;
  }
  return next;
}
