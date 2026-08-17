const formatAmount = (value) => Number(value || 0).toFixed(1);

export function nc2BetCellAmountDisplay({
  amount,
  martinZIncluded = false,
  martinZAmount = 0,
}) {
  return martinZIncluded
    ? `${formatAmount(amount)}(${formatAmount(martinZAmount)})`
    : formatAmount(amount);
}
