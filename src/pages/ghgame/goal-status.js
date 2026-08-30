export const GOAL_STATUS_ITEMS = [
  { key: "AAR", label: "A" },
  { key: "SSR1", label: "S1" },
  { key: "SSR2", label: "S2" },
  { key: "SSR3", label: "S3" },
  { key: "FOR", label: "F" },
  { key: "FORX", label: "FX" },
  { key: "GOBH", label: "GH" },
  { key: "GOBP", label: "G%" },
  { key: "허니비", label: "H" },
  { key: "W111", label: "W" },
  { key: "M22", label: "M" },
  { key: "D112", label: "D" },
  { key: "PBJ", label: "PJ" },
];

const numberOrZero = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export const formatGoalTarget = (value) => numberOrZero(value).toLocaleString(
  undefined,
  { minimumFractionDigits: 0, maximumFractionDigits: 1 },
);

export const formatGoalIndicator = (item) => (
  item?.reached && numberOrZero(item?.reachedRound) > 0
    ? `${item.label} ${numberOrZero(item.reachedRound)}`
    : item?.label || ""
);

export const buildGoalStatusItems = (
  strategyGoals,
  overallStop,
  autoStatus,
) => {
  const goals = strategyGoals || {};
  const items = GOAL_STATUS_ITEMS.map(({ key, label }) => {
    const goal = goals[key] || {};
    const target = numberOrZero(goal.target);
    return {
      key,
      label,
      target,
      pnl: numberOrZero(goal.pnl),
      reached: target > 0 && Boolean(goal.reached),
      reachedRound: numberOrZero(goal.reached_round),
      dimmed: target <= 0,
    };
  });

  const overallTarget = numberOrZero(
    overallStop?.target ?? autoStatus?.goal_amount,
  );
  const overallPnl = numberOrZero(
    overallStop?.pnl ?? autoStatus?.pnl_actual_p,
  );
  const stopReason = overallStop?.reason || autoStatus?.stop_reason;
  const overallReached = overallTarget > 0 && (
    stopReason === "goal_reached"
    || overallPnl >= overallTarget
  );

  items.push({
    key: "overall-pnl",
    label: "Pnl",
    target: overallTarget,
    pnl: overallPnl,
    reached: overallReached,
    reachedRound: numberOrZero(
      overallStop?.reached_round || (overallReached ? autoStatus?.round_count : 0),
    ),
    dimmed: overallTarget <= 0,
  });
  return items;
};
