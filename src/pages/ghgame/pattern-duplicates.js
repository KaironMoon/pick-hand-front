// Compare visual patterns within one strategy, including their P/B inverse.
export function duplicatePatternRows(patterns) {
  const canonical = patterns.map((pattern) => {
    if (!pattern) return "";
    const inverse = [...pattern].map((side) => side === "P" ? "B" : "P").join("");
    return pattern < inverse ? pattern : inverse;
  });
  const counts = new Map();
  for (const key of canonical) {
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return canonical.map((key) => Boolean(key && counts.get(key) > 1));
}
