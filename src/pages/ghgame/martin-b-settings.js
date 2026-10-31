export const MARTIN_B_PATTERN_ROW_COUNT = 65;
export const MARTIN_B_PATTERN_COUNT = 30;
export const MARTIN_B_SPECIAL_NUMBER = 31;
export const MARTIN_B_PARTIAL_COUNT = 15;
export const martinBPatternLabel = (index) => index < 40
  ? String(Math.floor(index / 8) + 1) : String(index - 34);

export const defaultMartinBPatternOption = () => ({
  success_limit: 1,
  assist_round: 40,
  assist_losses: 4,
  assist_mode: "all",
  untriggered_round: 0,
  untriggered_action: "stop",
  partial_patterns: Array(MARTIN_B_PARTIAL_COUNT).fill(0),
});

export const martinBPatternOptions = (options) => Array.from(
  { length: MARTIN_B_PATTERN_COUNT },
  (_, index) => ({
    ...defaultMartinBPatternOption(), ...options?.[index],
    partial_patterns: Array.from({ length: MARTIN_B_PARTIAL_COUNT }, (_, i) => options?.[index]?.partial_patterns?.[i] ?? 0),
  }),
);

export const MARTIN_B_VISIBLE_INDICES = [0, 8, 16, 24, 32, ...Array.from({ length: MARTIN_B_PATTERN_COUNT - 5 }, (_, i) => i + 40)];
export const validWallPattern = (pattern) => Array.isArray(pattern) && pattern.filter((v) => v === "B" || v === "P").length > 2
  && ["B", "P"].includes(pattern[0]) && pattern[0] === pattern[1];
export const patchMartinBRule = (rule, patch) => {
  const next = { ...rule, ...patch };
  return { ...next, wall_enabled: Boolean(next.wall_enabled) && validWallPattern(next.pattern) };
};
