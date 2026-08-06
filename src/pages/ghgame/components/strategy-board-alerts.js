export const isMissStreakAtLeast = (value, threshold) => {
  const match = String(value || "").match(/^(\d+)M$/);
  return Boolean(match && Number(match[1]) >= threshold);
};

export const isMaxMissAtLeast = (value, threshold) => {
  const match = String(value || "").match(/^\d+-(\d+)$/);
  return Boolean(match && Number(match[1]) >= threshold);
};
