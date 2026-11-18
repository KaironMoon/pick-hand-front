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
export function z2WallIndices(pattern, { back = false } = {}) {
  const cells = Array.isArray(pattern) ? pattern : [];
  const indices = [];
  let first;
  for (let offset = 0; offset < cells.length; offset += 1) {
    const index = back ? cells.length - offset - 1 : offset;
    const value = cells[index];
    if (value !== "B" && value !== "P") continue;
    first ??= value;
    if (value !== first) break;
    indices.push(index);
  }
  return back ? indices.reverse() : indices;
}
export const validZ2WallPattern = (pattern, options) => z2WallIndices(pattern, options).length >= 2;
export const validBackWallPattern = (pattern) => {
  const values = Array.isArray(pattern) ? pattern.filter((v) => v === "B" || v === "P") : [];
  return values.length > 2 && values.at(-1) === values.at(-2);
};
export const patchMartinBRule = (rule, patch, { z2 = false } = {}) => {
  const next = { ...rule, ...patch };
  const isValidWall = z2 ? validZ2WallPattern : validWallPattern;
  return { ...next, wall_enabled: Boolean(next.wall_enabled) && isValidWall(next.pattern),
    back_wall_enabled: Boolean(next.back_wall_enabled) && (
      z2 ? validZ2WallPattern(next.pattern, { back: true }) : validBackWallPattern(next.pattern)
    ) };
};
