export const MAX_MISS_THRESHOLDS = Array.from({ length: 18 }, (_, index) => index + 3);

export function maxMissLabel(track, threshold, always = false) {
  const maxMiss = Number(track?.max_miss_streak || 0);
  if (maxMiss <= 0 || (!always && maxMiss < threshold)) return "";
  return `${maxMiss}M`;
}
