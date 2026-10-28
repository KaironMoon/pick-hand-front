export const MARTIN_B_PATTERN_ROW_COUNT = 39;
export const MARTIN_B_PATTERN_COUNT = 30;
export const martinBPatternLabel = (index) => index < 10 ? `1-${index + 1}` : String(index - 8);

export const defaultMartinBPatternOption = () => ({
  success_limit: 1,
  assist_round: 40,
  assist_losses: 4,
  assist_mode: "all",
  partial_patterns: [0, 0, 0, 0, 0],
});

export const martinBPatternOptions = (options) => Array.from(
  { length: MARTIN_B_PATTERN_COUNT },
  (_, index) => ({ ...defaultMartinBPatternOption(), ...options?.[index] }),
);
