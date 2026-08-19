export const NC2_KEEP_COUNT_MIN = 2;
export const NC2_KEEP_COUNT_MAX = 100;
export const NC2_KEEP_COUNT_DEFAULT = 20;

export function parseNc2KeepCount(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed)
    && parsed >= NC2_KEEP_COUNT_MIN
    && parsed <= NC2_KEEP_COUNT_MAX
    ? parsed
    : null;
}

export function nc2KeepLabel(configuredCount, autoStatus) {
  if (!autoStatus?.running || autoStatus?.play_mode !== "keep") return "keep";
  const runningRemaining = Number(autoStatus?.keep_shoes_remaining);
  const remaining = Number.isInteger(runningRemaining) && runningRemaining >= 1
    ? runningRemaining
    : parseNc2KeepCount(configuredCount) || NC2_KEEP_COUNT_DEFAULT;
  return `keep(${remaining})`;
}
