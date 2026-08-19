const VALID_DIRECTIONS = new Set(["P", "B"]);

export function nc2AggregateDisplay(aggregate) {
  const direction = VALID_DIRECTIONS.has(aggregate?.direction) ? aggregate.direction : null;
  const parsedAmount = Number(aggregate?.amount);
  const amount = direction && Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;

  return {
    direction,
    directionLabel: direction || "대기",
    amount,
    amountLabel: `${amount.toFixed(1)}P`,
    color: direction === "P" ? "#1565d8" : direction === "B" ? "#e53935" : "#555",
  };
}
