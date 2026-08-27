import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGhAssistExcelRows,
  GH_ASSIST_EXCEL_HEADERS,
  parseGhAssistTsv,
  serializeGhAssistHtml,
  serializeGhAssistTsv,
  writeGhAssistClipboard,
} from "../src/pages/ghgame/assist-excel.js";

function configWithAssistValues() {
  const pasi = Array.from({ length: 19 }, (_, index) => ({
    level: index + 2,
    q_level: index + 2,
    assist1: index === 0 ? "BF6" : "해당진행",
    assist2: index === 1 ? "고정B" : "해당진행",
    assist_h_by_section: { A: index === 0 ? "J" : "해당진행" },
    assist_q_by_section: { A: index === 1 ? "고정P" : "해당진행" },
  }));
  return {
    untouched: { value: 17 },
    AAR: { step_max: 16, miss_threshold: 7, pasi },
    D: { step_max: 9, miss_threshold: 4, pasi },
  };
}

function editTsvCell(tsv, boxKey, section, assistType, level, value) {
  const rows = tsv.split(/\r?\n/).map((row) => row.split("\t"));
  const row = rows.find((cells) => cells[0] === boxKey && cells[2] === section && cells[3] === assistType);
  assert.ok(row, `${boxKey}/${section}/${assistType} row must exist`);
  row[4 + level - 2] = value;
  return rows.map((cells) => cells.join("\t")).join("\r\n");
}

test("GH assist export contains every setup line and stages 2 through 20", () => {
  const config = configWithAssistValues();
  const rows = buildGhAssistExcelRows(config);
  const tsv = serializeGhAssistTsv(config);

  assert.deepEqual(GH_ASSIST_EXCEL_HEADERS.slice(-2), ["19단계", "20단계"]);
  assert.equal(tsv.split(/\r?\n/).length, rows.length + 1);
  assert.match(tsv, /AAR\tA멀티\tA\t회차어시\tJ/);
  assert.match(tsv, /D\tD\tD\t회차어시\t육전/);
});

test("GH assist HTML export includes spreadsheet-friendly round and quarter colors", () => {
  const html = serializeGhAssistHtml(configWithAssistValues());

  assert.match(html, /<table/);
  assert.match(html, /background:#16365c/);
  assert.match(html, /background:#60497b/);
  assert.match(html, /background:#009900/);
  assert.match(html, /육전/);
});

test("GH assist clipboard writes TSV so Excel separates every cell", async () => {
  let writtenText = null;
  const format = await writeGhAssistClipboard(
    { html: "<table><tr><td>색상표</td></tr></table>", text: "색상표\t2단계" },
    {
      clipboard: { writeText: async (text) => { writtenText = text; } },
      doc: null,
    },
  );

  assert.equal(format, "text");
  assert.equal(writtenText, "색상표\t2단계");
});

test("GH assist clipboard falls back to a selected textarea", async () => {
  const textarea = {
    value: "",
    style: {},
    setAttribute() {},
    focus() {},
    select() {},
    remove() {},
  };
  let appended = null;
  const format = await writeGhAssistClipboard(
    { text: "설정판\t2단계" },
    {
      clipboard: null,
      doc: {
        body: { appendChild(node) { appended = node; } },
        createElement() { return textarea; },
        execCommand(command) { return command === "copy"; },
      },
    },
  );

  assert.equal(format, "text");
  assert.equal(appended, textarea);
  assert.equal(textarea.value, "설정판\t2단계");
});

test("GH assist export can be imported without changing highest steps or unrelated settings", () => {
  const current = configWithAssistValues();
  const result = parseGhAssistTsv(serializeGhAssistTsv(current), current);

  assert.deepEqual(result.errors, []);
  assert.equal(result.config.AAR.step_max, 16);
  assert.equal(result.config.D.step_max, 9);
  assert.equal(result.config.AAR.miss_threshold, 7);
  assert.equal(result.config.D.miss_threshold, 4);
  assert.deepEqual(result.config.untouched, { value: 17 });
  assert.equal(result.config.AAR.pasi[0].assist_h_by_section.A, "J");
  assert.equal(result.config.D.pasi[0].assist1, "BF6");
  assert.equal(result.config.D.pasi[1].assist2, "고정B");
});

test("GH assist import rejects unknown values instead of replacing them", () => {
  const current = configWithAssistValues();
  const edited = editTsvCell(serializeGhAssistTsv(current), "D", "D", "회차어시", 4, "없는어시");
  const result = parseGhAssistTsv(edited, current);

  assert.equal(result.config, null);
  assert.ok(result.errors.some((error) => error.includes("4단계") && error.includes("없는어시")));
});

test("GH assist import rebuilds valid six-step 6M bundle metadata", () => {
  const current = configWithAssistValues();
  let edited = serializeGhAssistTsv(current);
  for (let level = 2; level <= 7; level += 1) {
    edited = editTsvCell(edited, "D", "D", "회차어시", level, "6M");
  }
  const result = parseGhAssistTsv(edited, current);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.config.D.pasi.slice(0, 6).map((row) => row.assist1), Array(6).fill("6M"));
  assert.deepEqual(result.config.D.pasi.slice(0, 6).map((row) => row.assist1_6m_bundle_start), Array(6).fill(2));
  assert.equal(result.config.D.step_max, 9);
});

test("GH assist import rejects incomplete or out-of-range 6M bundles", () => {
  const current = configWithAssistValues();
  const incomplete = editTsvCell(serializeGhAssistTsv(current), "D", "D", "회차어시", 2, "6M");
  const incompleteResult = parseGhAssistTsv(incomplete, current);
  assert.ok(incompleteResult.errors.some((error) => error.includes("6칸 단위")));

  let beyondMax = serializeGhAssistTsv(current);
  for (let level = 5; level <= 10; level += 1) {
    beyondMax = editTsvCell(beyondMax, "D", "D", "쿼터어시", level, "6MX");
  }
  const beyondResult = parseGhAssistTsv(beyondMax, current);
  assert.ok(beyondResult.errors.some((error) => error.includes("현재 최고단계 9")));
});

test("GH assist import requires the complete exported table", () => {
  const current = configWithAssistValues();
  const rows = serializeGhAssistTsv(current).split(/\r?\n/);
  const result = parseGhAssistTsv(rows.slice(0, -1).join("\r\n"), current);

  assert.equal(result.config, null);
  assert.ok(result.errors.some((error) => error.includes("행이 없습니다")));
});
