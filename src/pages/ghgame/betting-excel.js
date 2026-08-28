import { GH_ASSIST_SETUP_BOXES, writeGhAssistClipboard } from "./assist-excel.js";
import { GH_STRATEGY_MAX_STEP } from "./strategy-step-capacity.js";

const META_HEADERS = ["설정판코드", "설정판명", "흰색하한(%)", "흰색상한(%)", "색상"];
export const GH_BETTING_EXCEL_HEADERS = [
  ...META_HEADERS,
  ...Array.from({ length: GH_STRATEGY_MAX_STEP }, (_, index) => `${index + 1}단계`),
];

const COLOR_LINES = [
  { label: "흰색", field: "amounts_white" },
  { label: "빨강", field: "amounts_red" },
  { label: "파랑", field: "amounts_blue" },
];
const COLOR_BY_LABEL = new Map(COLOR_LINES.map((line) => [line.label, line]));

function strategyFor(config, box) {
  return config?.[box.key] || (box.legacyKey ? config?.[box.legacyKey] : null) || {};
}

function normalizedAmounts(values) {
  return Array.from({ length: GH_STRATEGY_MAX_STEP }, (_, index) => {
    const value = Number(values?.[index] ?? 0);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  });
}

function rowKey(boxKey, color) {
  return `${boxKey}\u0000${color}`;
}

function expectedLines() {
  return GH_ASSIST_SETUP_BOXES.flatMap((box) => COLOR_LINES.map((color) => ({
    box,
    color,
    key: rowKey(box.key, color.label),
  })));
}

export function buildGhBettingExcelRows(config) {
  return expectedLines().map(({ box, color }) => {
    const strategy = strategyFor(config, box);
    const condLo = Number(strategy.cond_lo ?? 0);
    const condHi = Number(strategy.cond_hi ?? 100);
    return [
      box.key,
      box.label || box.key,
      Number.isFinite(condLo) ? condLo : 0,
      Number.isFinite(condHi) ? condHi : 100,
      color.label,
      ...normalizedAmounts(strategy[color.field]),
    ];
  });
}

function tsvCell(value) {
  return String(value ?? "").replace(/[\t\r\n]+/g, " ");
}

export function serializeGhBettingTsv(config) {
  return [GH_BETTING_EXCEL_HEADERS, ...buildGhBettingExcelRows(config)]
    .map((row) => row.map(tsvCell).join("\t"))
    .join("\r\n");
}

export function writeGhBettingClipboard(payload, options) {
  return writeGhAssistClipboard(payload, options);
}

function splitTsv(text) {
  return String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line, index, lines) => line.length > 0 || index < lines.length - 1)
    .map((line) => line.split("\t").map((cell) => cell.trim()));
}

function parsePercent(raw, label, excelRow, errors) {
  if (raw === "") {
    errors.push(`${excelRow}행: ${label}을 입력해주세요.`);
    return null;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    errors.push(`${excelRow}행: ${label} '${raw}'은 0~100 사이 정수여야 합니다.`);
    return null;
  }
  return value;
}

function parseAmount(raw, level, excelRow, errors) {
  if (raw === "") {
    errors.push(`${excelRow}행 / ${level}단계: 배팅액을 입력해주세요.`);
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    errors.push(`${excelRow}행 / ${level}단계: 배팅액 '${raw}'은 0 이상의 숫자여야 합니다.`);
    return null;
  }
  return value;
}

export function parseGhBettingTsv(text, currentConfig) {
  const table = splitTsv(text);
  const errors = [];
  if (!table.length || table.every((row) => row.every((cell) => !cell))) {
    return { errors: ["엑셀에서 복사한 내용을 붙여넣어주세요."], config: null, rowCount: 0 };
  }

  const header = table[0] || [];
  const expectedColumnCount = GH_BETTING_EXCEL_HEADERS.length;
  if (header.length !== expectedColumnCount || GH_BETTING_EXCEL_HEADERS.some((value, index) => header[index] !== value)) {
    return {
      errors: ["표 머리글이 다릅니다. 먼저 ‘배팅 설정 엑셀로 복사’로 만든 표를 수정한 뒤 붙여넣어주세요."],
      config: null,
      rowCount: Math.max(0, table.length - 1),
    };
  }

  const lines = expectedLines();
  const expectedByKey = new Map(lines.map((line) => [line.key, line]));
  const imported = new Map();
  table.slice(1).forEach((row, dataIndex) => {
    const excelRow = dataIndex + 2;
    if (row.every((cell) => !cell)) return;
    if (row.length !== expectedColumnCount) {
      errors.push(`${excelRow}행: 열 개수가 ${row.length}개입니다. ${expectedColumnCount}개가 필요합니다.`);
      return;
    }

    const [boxKey, , rawCondLo, rawCondHi, colorLabel] = row;
    const key = rowKey(boxKey, colorLabel);
    const line = expectedByKey.get(key);
    if (!line || !COLOR_BY_LABEL.has(colorLabel)) {
      errors.push(`${excelRow}행: 알 수 없는 설정판 또는 색상입니다.`);
      return;
    }
    if (imported.has(key)) {
      errors.push(`${excelRow}행: ${line.box.label || line.box.key} / ${colorLabel} 행이 중복되었습니다.`);
      return;
    }

    const condLo = parsePercent(rawCondLo, "흰색하한(%)", excelRow, errors);
    const condHi = parsePercent(rawCondHi, "흰색상한(%)", excelRow, errors);
    if (condLo != null && condHi != null && condLo > condHi) {
      errors.push(`${excelRow}행: 흰색하한 ${condLo}%가 흰색상한 ${condHi}%보다 클 수 없습니다.`);
    }
    const amounts = row.slice(META_HEADERS.length).map((raw, index) => (
      parseAmount(raw, index + 1, excelRow, errors)
    ));
    imported.set(key, { line, condLo, condHi, amounts });
  });

  lines.forEach((line) => {
    if (!imported.has(line.key)) {
      errors.push(`${line.box.label || line.box.key} / ${line.color.label} 행이 없습니다.`);
    }
  });

  GH_ASSIST_SETUP_BOXES.forEach((box) => {
    const importedRows = COLOR_LINES
      .map((color) => imported.get(rowKey(box.key, color.label)))
      .filter(Boolean);
    if (importedRows.length !== COLOR_LINES.length) return;
    const [{ condLo, condHi }] = importedRows;
    if (importedRows.some((row) => row.condLo !== condLo || row.condHi !== condHi)) {
      errors.push(`${box.label || box.key}: 흰색·빨강·파랑 행의 흰색하한·상한 값이 서로 다릅니다.`);
    }
  });

  if (errors.length) return { errors, config: null, rowCount: imported.size };

  const nextConfig = { ...(currentConfig || {}) };
  GH_ASSIST_SETUP_BOXES.forEach((box) => {
    const original = strategyFor(currentConfig, box);
    const rows = COLOR_LINES.map((color) => imported.get(rowKey(box.key, color.label)));
    const nextStrategy = {
      ...original,
      bet_type: "manual",
      cond_lo: rows[0].condLo,
      cond_hi: rows[0].condHi,
    };
    rows.forEach((row) => {
      nextStrategy[row.line.color.field] = row.amounts;
    });
    nextConfig[box.key] = nextStrategy;
  });

  return { errors: [], config: nextConfig, rowCount: imported.size };
}
