export const HIGH_STEP_OVERLAP_WAIT_REASON = "high_step_overlap_wait";

export const isBigRoadWaitRow = (row = {}) => (
  (row.pick === "W" || row.status === "wait") && !row.result
);

export const bigRoadCurrentStatus = (track) => (
  track?.bet_unavailable_reason === HIGH_STEP_OVERLAP_WAIT_REASON
    ? "wait"
    : track?.status
);
