export const GOAL_STATUS_ITEMS = [
  { key: "AAR", label: "A" },
  { key: "SSR1", label: "S1" },
  { key: "SSR2", label: "S2" },
  { key: "SSR3", label: "S3" },
  { key: "FOR", label: "F" },
  { key: "FORX", label: "FX" },
  { key: "SQ", label: "SQ" },
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

  const isAuto = Boolean(autoStatus?.running);
  const overallTarget = numberOrZero(
    isAuto ? autoStatus?.goal_amount : overallStop?.target,
  );
  const overallPnl = numberOrZero(
    isAuto ? autoStatus?.pnl_actual_p : overallStop?.pnl,
  );
  const overallReached = overallTarget > 0 && (
    (isAuto ? autoStatus?.stop_reason : overallStop?.reason) === "goal_reached"
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
