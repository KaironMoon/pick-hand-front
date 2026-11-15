// Each duplicate row shares its group's zero-based indices, including its own.
// Compare visual patterns within one strategy, including their P/B inverse.
export function duplicatePatternRowGroups(patterns) {
  const canonical = patterns.map((pattern) => {
    if (!pattern) return "";
    const inverse = [...pattern].map((side) => side === "P" ? "B" : "P").join("");
    return pattern < inverse ? pattern : inverse;
  });
  const groups = new Map();
  for (const [index, key] of canonical.entries()) {
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(index);
  }
  return canonical.map((key) => {
    const group = groups.get(key);
    return group?.length > 1 ? group : undefined;
  });
}

export function duplicatePatternRows(patterns) {
  return duplicatePatternRowGroups(patterns).map(Boolean);
}
