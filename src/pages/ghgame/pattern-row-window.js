export const PATTERN_ROW_HEIGHT = 44;
const OVERSCAN_ROWS = 8;

export function patternRowWindow(rowCount, top, viewportHeight) {
  const start = Math.max(1, Math.min(rowCount, Math.floor(-top / PATTERN_ROW_HEIGHT) - OVERSCAN_ROWS));
  const end = Math.max(start, Math.min(rowCount, Math.ceil((viewportHeight - top) / PATTERN_ROW_HEIGHT) + OVERSCAN_ROWS));
  return { start, end };
}
