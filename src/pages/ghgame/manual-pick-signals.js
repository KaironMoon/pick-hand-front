const COLORS = { 1: "#ef5350", 2: "#42a5f5", 3: "#ba68c8" };

export function manualPickSignalStyle(grade) {
  const color = COLORS[grade];
  return color ? { boxShadow: `inset 0 0 0 2px ${color}` } : {};
}
