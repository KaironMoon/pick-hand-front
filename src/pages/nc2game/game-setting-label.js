export function nc2ItemWinLimitLabel(config) {
  const value = Number(config?.item_win_limit);
  return Number.isInteger(value) && value >= 1 && value <= 60 ? `${value}승` : "-";
}
