export const GH_KEEP_COUNT_MIN = 2;
export const GH_KEEP_COUNT_MAX = 100;
export const GH_KEEP_COUNT_DEFAULT = 20;

export function parseGhKeepCount(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed)
    && parsed >= GH_KEEP_COUNT_MIN
    && parsed <= GH_KEEP_COUNT_MAX
    ? parsed
    : null;
}

export function ghKeepLabel(configuredCount, autoStatus) {
  if (!autoStatus?.running || autoStatus?.play_mode !== "keep") return "keep";
  const runningRemaining = Number(autoStatus?.keep_shoes_remaining);
  const remaining = Number.isInteger(runningRemaining) && runningRemaining >= 1
    ? runningRemaining
    : parseGhKeepCount(configuredCount) || GH_KEEP_COUNT_DEFAULT;
  return `keep(${remaining})`;
}
