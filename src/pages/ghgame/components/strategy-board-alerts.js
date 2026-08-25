export const isMissStreakAtLeast = (value, threshold) => {
  const match = String(value || "").match(/^(\d+)M$/);
  return Boolean(match && Number(match[1]) >= threshold);
};

export const isMaxMissAtLeast = (value, threshold) => {
  const match = String(value || "").match(/^\d+-(\d+)$/);
  return Boolean(match && Number(match[1]) >= threshold);
};

export const isHighStepOverlapWait = (value, source) => (
  (value === "P(W)" || value === "B(W)")
  && source === "(고단계 중첩정지)"
);
