export const MARTIN_B_PATTERN_ROW_COUNT = 50;
export const MARTIN_B_PATTERN_COUNT = 15;
export const martinBPatternLabel = (index) => index < 40
  ? `${Math.floor(index / 8) + 1}-${index % 8 + 1}` : String(index - 34);

export const defaultMartinBPatternOption = () => ({
  success_limit: 1,
  assist_round: 40,
  assist_losses: 4,
  assist_mode: "all",
  untriggered_round: 0,
  untriggered_action: "stop",
  partial_patterns: [0, 0, 0, 0, 0],
});

export const martinBPatternOptions = (options) => Array.from(
  { length: MARTIN_B_PATTERN_COUNT },
  (_, index) => ({ ...defaultMartinBPatternOption(), ...options?.[index] }),
);
