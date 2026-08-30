import { GH_FIXED_PASI_LEVELS } from "./strategy-step-capacity.js";

export const GH_ASSIST_OPTIONS = [
  "해당반대", "해당진행", "3회 쉬기", "6회 쉬기", "고정P", "고정B", "이전3회", "J", "BF6", "BF6X", "6M", "6MX",
  "G(H1)", "G(H2)", "G(%1)", "G(%2)",
  "A멀티(H1)", "A멀티(%1)", "S1멀티(H1)", "S1멀티(%1)", "S2멀티(H1)", "S2멀티(%1)", "S3멀티(H1)", "S3멀티(%1)",
  "HB멀티(H1)", "HB멀티(%1)", "WH멀티(H1)", "WH멀티(%1)", "MH멀티(H1)", "MH멀티(%1)", "DH멀티(H1)", "DH멀티(%1)",
];

const ASSIST_DISPLAY_LABELS = {
  BF6: "육전",
  BF6X: "육전X",
};

const ASSIST_DISPLAY_PREFIXES = {
  "A멀티": "A",
  "S1멀티": "S1",
  "S2멀티": "S2",
  "S3멀티": "S3",
  "HB멀티": "허니비",
  "WH멀티": "W111",
  "MH멀티": "M22",
  "DH멀티": "D112",
};

export const assistDisplayLabel = (value) => ASSIST_DISPLAY_LABELS[value] || Object.entries(ASSIST_DISPLAY_PREFIXES)
  .reduce((label, [storedPrefix, displayPrefix]) => label.replace(storedPrefix, displayPrefix), value);

export const GH_ASSIST_SETUP_BOXES = [
  { key: "AAR", variant: "full", aarLabel: "A-AR", label: "A멀티", sections: ["A", "AR"] },
  { key: "SSR1", variant: "full", aarLabel: "S-SR", label: "S1세트", sections: ["S1", "SR1"] },
  { key: "SSR2", variant: "full", aarLabel: "S-SR", label: "S2세트", sections: ["S2", "SR2"] },
  { key: "SSR3", variant: "full", aarLabel: "S-SR", label: "S3세트", sections: ["S3", "SR3"] },
  { key: "FOR", variant: "full", label: "FOR세트", sections: ["FOR1", "FOR2", "FOR3"] },
  { key: "FORX", variant: "full", label: "FORX세트", sections: ["FOR1X", "FOR2X", "FOR3X"] },
  { key: "GOBH", legacyKey: "GOB", variant: "full", label: "GH 시리즈", sections: ["G(H1)", "G(H2)"] },
  { key: "GOBP", legacyKey: "GOB", variant: "full", label: "G% 시리즈", sections: ["G(%1)", "G(%2)"] },
  { key: "허니비", variant: "full", label: "허니비", sections: ["허니비", "허니R2"] },
  { key: "W111", variant: "full", label: "위너히트", sections: ["W111", "위너R2"] },
  { key: "M22", variant: "full", label: "메가히트", sections: ["M22", "메가R2"] },
  { key: "D112", variant: "full", label: "드림히트", sections: ["D112", "드림R2"] },
  { key: "NC", variant: "full", label: "나이스초이스", sections: ["NC", "NCR"] },
  { key: "D", variant: "short" },
  { key: "G", variant: "short" },
  { key: "TN", variant: "short" },
  { key: "ONE", variant: "short" },
  { key: "TWO", variant: "short" },
  { key: "P", variant: "short", targetLabel: "목표금액(PBJ)" },
  { key: "B", variant: "short", targetLabel: "목표금액(PBJ)" },
  { key: "J", variant: "short", targetLabel: "목표금액(PBJ)" },
  { key: "6MX", variant: "full", label: "6MX", sections: ["6M", "6MX"] },
];

const META_HEADERS = ["설정판코드", "설정판명", "섹션", "어시구분"];
export const GH_ASSIST_EXCEL_HEADERS = [
  ...META_HEADERS,
  ...GH_FIXED_PASI_LEVELS.map((level) => `${level}단계`),
];
const ASSIST_TYPES = ["회차어시", "쿼터어시"];
const SIX_M_OPTIONS = new Set(["6M", "6MX"]);
const OPTION_BY_INPUT = new Map(
  GH_ASSIST_OPTIONS.flatMap((option) => [
    [option, option],
    [assistDisplayLabel(option), option],
  ]),
);

function defaultPasiRow(level) {
  return {
    level,
    q_level: level,
    assist1: "해당진행",
    assist2: "해당진행",
    assist_h_by_section: {},
    assist_q_by_section: {},
  };
}

function strategyFor(config, box) {
  return config?.[box.key] || (box.legacyKey ? config?.[box.legacyKey] : null) || {};
}

function strategyRows(strategy) {
  const saved = Array.isArray(strategy?.pasi) ? strategy.pasi : [];
  return GH_FIXED_PASI_LEVELS.map((level, index) => ({
    ...defaultPasiRow(level),
    ...(saved[index] || {}),
    level,
    q_level: level,
  }));
}

function rowKey(boxKey, section, assistType) {
  return `${boxKey}\u0000${section}\u0000${assistType}`;
}

function expectedLines() {
  return GH_ASSIST_SETUP_BOXES.flatMap((box) => {
    const sections = box.sections?.length ? box.sections : [box.key];
    return sections.flatMap((section) => ASSIST_TYPES.map((assistType) => ({
      box,
      section,
      assistType,
      key: rowKey(box.key, section, assistType),
    })));
  });
}

export function buildGhAssistExcelRows(config) {
  return expectedLines().map(({ box, section, assistType }) => {
    const rows = strategyRows(strategyFor(config, box));
    const isRound = assistType === "회차어시";
    const valueField = isRound ? "assist1" : "assist2";
    const sectionField = isRound ? "assist_h_by_section" : "assist_q_by_section";
    const values = rows.map((row) => {
      const value = box.sections?.length
        ? row?.[sectionField]?.[section]
        : row?.[valueField];
      return assistDisplayLabel(GH_ASSIST_OPTIONS.includes(value) ? value : "해당진행");
    });
    return [box.key, box.label || box.key, section, assistType, ...values];
  });
}

function tsvCell(value) {
  return String(value ?? "").replace(/[\t\r\n]+/g, " ");
}

export function serializeGhAssistTsv(config) {
  return [GH_ASSIST_EXCEL_HEADERS, ...buildGhAssistExcelRows(config)]
    .map((row) => row.map(tsvCell).join("\t"))
    .join("\r\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function serializeGhAssistHtml(config) {
  const rows = buildGhAssistExcelRows(config);
  const border = "border:1px solid #c9ccd1;text-align:center;padding:4px;white-space:nowrap;";
  const headerStyle = `${border}background:#009900;color:#ffffff;font-weight:bold;`;
  const metadataStyle = `${border}background:#333333;color:#ffffff;font-weight:bold;`;
  const roundStyle = `${border}background:#16365c;color:#ffffff;`;
  const quarterStyle = `${border}background:#60497b;color:#ffffff;`;
  const header = `<tr>${GH_ASSIST_EXCEL_HEADERS.map((value) => `<th style="${headerStyle}">${escapeHtml(value)}</th>`).join("")}</tr>`;
  const body = rows.map((row) => {
    const valueStyle = row[3] === "쿼터어시" ? quarterStyle : roundStyle;
    return `<tr>${row.map((value, index) => `<td style="${index < META_HEADERS.length ? metadataStyle : valueStyle}">${escapeHtml(value)}</td>`).join("")}</tr>`;
  }).join("");
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:11pt">${header}${body}</table>`;
}

export async function writeGhAssistClipboard(
  payload,
  {
    clipboard = globalThis.navigator?.clipboard,
    doc = globalThis.document,
  } = {},
) {
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(payload.text);
      return "text";
    } catch {
      // 브라우저 권한 문제면 동기식 텍스트 선택 복사로 이어간다.
    }
  }

  if (doc?.body && typeof doc.execCommand === "function") {
    const textarea = doc.createElement("textarea");
    let copied = false;
    try {
      textarea.value = payload.text;
      textarea.setAttribute("aria-hidden", "true");
      textarea.style.position = "fixed";
      textarea.style.top = "-10000px";
      textarea.style.left = "0";
      doc.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      copied = doc.execCommand("copy");
    } finally {
      textarea.remove();
    }
    if (!copied) throw new Error("Clipboard copy failed.");
    return "text";
  }
  throw new Error("Clipboard API is unavailable.");
}

function splitTsv(text) {
  return String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line, index, lines) => line.length > 0 || index < lines.length - 1)
    .map((line) => line.split("\t").map((cell) => cell.trim()));
}

function validateSixMBundles(values, line, stepMax, errors) {
  const bundleStarts = new Map();
  let index = 0;
  while (index < values.length) {
    const option = values[index];
    if (!SIX_M_OPTIONS.has(option)) {
      index += 1;
      continue;
    }
    let end = index + 1;
    while (end < values.length && values[end] === option) end += 1;
    const runLength = end - index;
    if (runLength % 6 !== 0) {
      errors.push(`${line.box.label || line.box.key} / ${line.section} / ${line.assistType}: ${index + 2}단계부터 ${option}가 ${runLength}칸입니다. 6칸 단위로 입력해주세요.`);
      index = end;
      continue;
    }
    for (let startIndex = index; startIndex < end; startIndex += 6) {
      const startLevel = startIndex + 2;
      if (startLevel + 5 > stepMax) {
        errors.push(`${line.box.label || line.box.key} / ${line.section} / ${line.assistType}: ${option} 묶음(${startLevel}~${startLevel + 5}단계)이 현재 최고단계 ${stepMax}를 넘습니다.`);
        continue;
      }
      for (let member = startIndex; member < startIndex + 6; member += 1) {
        bundleStarts.set(member, startLevel);
      }
    }
    index = end;
  }
  return bundleStarts;
}

function setSectionValue(row, field, section, value) {
  row[field] = { ...(row[field] || {}), [section]: value };
}

function clearSectionValue(row, field, section) {
  const values = { ...(row[field] || {}) };
  delete values[section];
  row[field] = values;
}

export function parseGhAssistTsv(text, currentConfig) {
  const table = splitTsv(text);
  const errors = [];
  if (!table.length || table.every((row) => row.every((cell) => !cell))) {
    return { errors: ["엑셀에서 복사한 내용을 붙여넣어주세요."], config: null, rowCount: 0 };
  }

  const header = table[0] || [];
  const expectedColumnCount = GH_ASSIST_EXCEL_HEADERS.length;
  if (header.length !== expectedColumnCount || GH_ASSIST_EXCEL_HEADERS.some((value, index) => header[index] !== value)) {
    return {
      errors: ["표 머리글이 다릅니다. 먼저 ‘어시 설정 엑셀로 복사’로 만든 표를 수정한 뒤 붙여넣어주세요."],
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
    const [boxKey, , section, assistType] = row;
    const key = rowKey(boxKey, section, assistType);
    const line = expectedByKey.get(key);
    if (!line) {
      errors.push(`${excelRow}행: 알 수 없는 설정판·섹션·어시구분입니다.`);
      return;
    }
    if (imported.has(key)) {
      errors.push(`${excelRow}행: ${line.box.label || line.box.key} / ${section} / ${assistType} 행이 중복되었습니다.`);
      return;
    }
    const values = row.slice(META_HEADERS.length).map((raw, levelIndex) => {
      const option = OPTION_BY_INPUT.get(raw);
      if (!option) {
        errors.push(`${excelRow}행 / ${levelIndex + 2}단계: 알 수 없는 어시 값 ‘${raw || "빈칸"}’입니다.`);
        return null;
      }
      return option;
    });
    imported.set(key, { line, values });
  });

  lines.forEach((line) => {
    if (!imported.has(line.key)) {
      errors.push(`${line.box.label || line.box.key} / ${line.section} / ${line.assistType} 행이 없습니다.`);
    }
  });

  const bundleMetadata = new Map();
  imported.forEach(({ line, values }, key) => {
    if (values.some((value) => value == null)) return;
    const strategy = strategyFor(currentConfig, line.box);
    const stepMax = Math.max(1, Math.min(20, Number(strategy.step_max || 16)));
    bundleMetadata.set(key, validateSixMBundles(values, line, stepMax, errors));
  });

  if (errors.length) return { errors, config: null, rowCount: imported.size };

  const nextConfig = { ...(currentConfig || {}) };
  GH_ASSIST_SETUP_BOXES.forEach((box) => {
    const original = strategyFor(currentConfig, box);
    nextConfig[box.key] = { ...original, pasi: strategyRows(original).map((row) => ({ ...row })) };
  });

  imported.forEach(({ line, values }, key) => {
    const strategy = nextConfig[line.box.key];
    const isRound = line.assistType === "회차어시";
    const valueField = isRound ? "assist1" : "assist2";
    const sectionField = isRound ? "assist_h_by_section" : "assist_q_by_section";
    const metaField = isRound ? "assist1_6m_bundle_start" : "assist2_6m_bundle_start";
    const sectionMetaField = isRound ? "assist_h_6m_bundle_by_section" : "assist_q_6m_bundle_by_section";
    const starts = bundleMetadata.get(key);
    strategy.pasi.forEach((row, index) => {
      const value = values[index];
      const start = starts.get(index);
      if (line.box.sections?.length) {
        setSectionValue(row, sectionField, line.section, value);
        if (start == null) clearSectionValue(row, sectionMetaField, line.section);
        else setSectionValue(row, sectionMetaField, line.section, start);
      } else {
        row[valueField] = value;
        if (start == null) delete row[metaField];
        else row[metaField] = start;
      }
    });
  });

  return { errors: [], config: nextConfig, rowCount: imported.size };
}
