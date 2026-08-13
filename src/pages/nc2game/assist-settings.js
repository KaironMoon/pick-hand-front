export const FIXED_NC2_ASSIST_PASI = Array.from({ length: 19 }, (_, index) => index + 2);

export function buildFixedNc2AssistRules(savedRules) {
  const savedAssistByPasi = new Map(
    (Array.isArray(savedRules) ? savedRules : [])
      .map((rule) => [Number(rule?.pasi), rule?.assist]),
  );
  return FIXED_NC2_ASSIST_PASI.map((pasi) => ({
    pasi,
    assist: savedAssistByPasi.get(pasi) || "회차진행",
  }));
}

export function visibleNc2AssistRows(rules, stepMax) {
  const highestPasi = Number(stepMax || 0);
  const visibleByPasi = new Map(
    rules
      .filter((rule) => rule.pasi <= highestPasi)
      .map((rule) => [rule.pasi, rule]),
  );
  const columns = [
    FIXED_NC2_ASSIST_PASI.slice(0, 5),
    FIXED_NC2_ASSIST_PASI.slice(5, 10),
    FIXED_NC2_ASSIST_PASI.slice(10, 15),
    FIXED_NC2_ASSIST_PASI.slice(15, 19),
  ];
  const rows = Array.from({ length: 5 }, (_, row) =>
    columns.map((column) => visibleByPasi.get(column[row]) || null));
  while (rows.length > 1 && rows.at(-1).every((rule) => rule == null)) rows.pop();
  return rows;
}
