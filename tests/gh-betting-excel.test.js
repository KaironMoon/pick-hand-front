import assert from "node:assert/strict";
import test from "node:test";

import { GH_ASSIST_SETUP_BOXES } from "../src/pages/ghgame/assist-excel.js";
import {
  buildGhBettingExcelRows,
  GH_BETTING_EXCEL_HEADERS,
  parseGhBettingTsv,
  serializeGhBettingTsv,
  writeGhBettingClipboard,
} from "../src/pages/ghgame/betting-excel.js";

function configWithBettingValues() {
  return {
    untouched: { value: 17 },
    AAR: {
      enabled: true,
      bet_type: "martin",
      step_min: 2,
      step_max: 16,
      cond_lo: 35,
      cond_hi: 68,
      amounts_white: Array.from({ length: 20 }, (_, index) => index + 1),
      amounts_red: Array.from({ length: 20 }, (_, index) => (index + 1) * 2),
      amounts_blue: Array.from({ length: 20 }, (_, index) => (index + 1) / 10),
      miss_threshold: 7,
    },
  };
}

function editRows(tsv, boxKey, updater) {
  const rows = tsv.split(/\r?\n/).map((row) => row.split("\t"));
  rows.forEach((row) => {
    if (row[0] === boxKey) updater(row);
  });
  return rows.map((row) => row.join("\t")).join("\r\n");
}

test("GH betting export contains white, red, and blue amounts for every setup box", () => {
  const config = configWithBettingValues();
  const rows = buildGhBettingExcelRows(config);
  const tsv = serializeGhBettingTsv(config);

  assert.equal(rows.length, GH_ASSIST_SETUP_BOXES.length * 3);
  assert.deepEqual(GH_BETTING_EXCEL_HEADERS.slice(-2), ["19단계", "20단계"]);
  assert.match(tsv, /AAR\tA멀티\t35\t68\t흰색\t1\t2/);
  assert.match(tsv, /AAR\tA멀티\t35\t68\t빨강\t2\t4/);
  assert.match(tsv, /AAR\tA멀티\t35\t68\t파랑\t0.1\t0.2/);
});

test("GH betting import updates thresholds and all colors, switches to manual, and preserves unrelated settings", () => {
  const current = configWithBettingValues();
  let edited = editRows(serializeGhBettingTsv(current), "AAR", (row) => {
    row[2] = "40";
    row[3] = "75";
  });
  edited = editRows(edited, "AAR", (row) => {
    if (row[4] === "흰색") row[5] = "11.5";
    if (row[4] === "빨강") row[5] = "22.5";
    if (row[4] === "파랑") row[5] = "3.5";
  });

  const result = parseGhBettingTsv(edited, current);

  assert.deepEqual(result.errors, []);
  assert.equal(result.config.AAR.bet_type, "manual");
  assert.equal(result.config.AAR.cond_lo, 40);
  assert.equal(result.config.AAR.cond_hi, 75);
  assert.equal(result.config.AAR.amounts_white[0], 11.5);
  assert.equal(result.config.AAR.amounts_red[0], 22.5);
  assert.equal(result.config.AAR.amounts_blue[0], 3.5);
  assert.equal(result.config.AAR.step_min, 2);
  assert.equal(result.config.AAR.step_max, 16);
  assert.equal(result.config.AAR.miss_threshold, 7);
  assert.deepEqual(result.config.untouched, { value: 17 });
  assert.ok(GH_ASSIST_SETUP_BOXES.every((box) => result.config[box.key].bet_type === "manual"));
});

test("GH betting import rejects inconsistent color thresholds", () => {
  const current = configWithBettingValues();
  const edited = editRows(serializeGhBettingTsv(current), "AAR", (row) => {
    if (row[4] === "빨강") row[2] = "36";
  });
  const result = parseGhBettingTsv(edited, current);

  assert.equal(result.config, null);
  assert.ok(result.errors.some((error) => error.includes("흰색·빨강·파랑") && error.includes("서로 다릅니다")));
});

test("GH betting import rejects reversed thresholds and invalid amounts", () => {
  const current = configWithBettingValues();
  const edited = editRows(serializeGhBettingTsv(current), "AAR", (row) => {
    row[2] = "80";
    row[3] = "70";
    if (row[4] === "파랑") row[5] = "-1";
  });
  const result = parseGhBettingTsv(edited, current);

  assert.equal(result.config, null);
  assert.ok(result.errors.some((error) => error.includes("흰색하한 80%") && error.includes("클 수 없습니다")));
  assert.ok(result.errors.some((error) => error.includes("배팅액 '-1'") && error.includes("0 이상의 숫자")));
});

test("GH betting import requires the complete exported table", () => {
  const current = configWithBettingValues();
  const rows = serializeGhBettingTsv(current).split(/\r?\n/);
  const result = parseGhBettingTsv(rows.slice(0, -1).join("\r\n"), current);

  assert.equal(result.config, null);
  assert.ok(result.errors.some((error) => error.includes("행이 없습니다")));
});

test("GH betting clipboard uses the same spreadsheet text fallback", async () => {
  let writtenText = null;
  const format = await writeGhBettingClipboard(
    { text: "설정판\t흰색하한(%)\t1단계" },
    { clipboard: { writeText: async (text) => { writtenText = text; } }, doc: null },
  );

  assert.equal(format, "text");
  assert.equal(writtenText, "설정판\t흰색하한(%)\t1단계");
});
