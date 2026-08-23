import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMaxMissClipboardPayload,
  compressPngBlob,
  includeInMaxMissImage,
  MAX_MISS_CAPTURE_PIXEL_RATIO,
  MAX_MISS_CAPTURE_SECTION_ORDER,
  MAX_MISS_THRESHOLDS,
  MAX_MISS_PNG_QUANTIZE_STEP,
  maxMissLabel,
  maxMissTitle,
  maxMissTrackForSection,
  quantizeRgba,
  writeMaxMissClipboard,
  writePngToClipboard,
} from "../src/pages/ghgame/components/max-miss-dialog.js";

test("combined image keeps the requested section order at native size", () => {
  assert.deepEqual(MAX_MISS_CAPTURE_SECTION_ORDER, ["max-miss", "pot-status", "round-amount-table"]);
  assert.equal(MAX_MISS_CAPTURE_PIXEL_RATIO, 1);
});

test("PNG quantization reduces color precision without changing alpha", () => {
  const pixels = new Uint8ClampedArray([7, 23, 250, 123, 255, 129, 64, 45]);
  assert.equal(MAX_MISS_PNG_QUANTIZE_STEP, 16);
  assert.deepEqual(
    [...quantizeRgba(pixels)],
    [0, 16, 255, 123, 255, 128, 64, 45],
  );
});

test("PNG compression safely keeps the original blob when browser APIs are unavailable", async () => {
  const blob = { type: "image/png", size: 100 };
  assert.equal(await compressPngBlob(blob, { documentRef: null, createImageBitmapFn: null }), blob);
});

test("image capture excludes only explicitly marked controls", () => {
  assert.equal(includeInMaxMissImage({ dataset: { imageCaptureExclude: "true" } }), false);
  assert.equal(includeInMaxMissImage({ dataset: { imageCaptureExclude: "false" } }), true);
  assert.equal(includeInMaxMissImage({ dataset: {} }), true);
  assert.equal(includeInMaxMissImage(null), true);
});

test("maximum miss thresholds cover 3M through 20M", () => {
  assert.deepEqual(MAX_MISS_THRESHOLDS, Array.from({ length: 18 }, (_, index) => index + 3));
});

test("maximum miss values below the selected threshold stay hidden", () => {
  assert.equal(maxMissLabel({ max_miss_streak: 8 }, 9), "");
  assert.equal(maxMissLabel({ max_miss_streak: 9 }, 9), "9M");
  assert.equal(maxMissLabel({ max_miss_streak: 11 }, 9), "11M");
});

test("J can always show its positive maximum miss value", () => {
  assert.equal(maxMissLabel({ max_miss_streak: 4 }, 9, true), "4M");
  assert.equal(maxMissLabel({ max_miss_streak: 0 }, 9, true), "");
});

test("display aliases resolve to their round state section keys", () => {
  const sections = {
    AAR: { assist_h: { max_miss_streak: 9 } },
    SSR1: {
      assist_h: { max_miss_streak: 10 },
      assist_q: { max_miss_streak: 8 },
    },
    SSR2: { assist_h: { max_miss_streak: 11 } },
    SSR3: { assist_h: { max_miss_streak: 12 } },
  };

  assert.equal(maxMissTrackForSection(sections, "AARN", "assist_h")?.max_miss_streak, 9);
  assert.equal(maxMissTrackForSection(sections, "SSRN1", "assist_h")?.max_miss_streak, 10);
  assert.equal(maxMissTrackForSection(sections, "SSRN1", "assist_q")?.max_miss_streak, 8);
  assert.equal(maxMissTrackForSection(sections, "SSRN2", "assist_h")?.max_miss_streak, 11);
  assert.equal(maxMissTrackForSection(sections, "SSRN3", "assist_h")?.max_miss_streak, 12);
});

test("sections without aliases keep using their original keys", () => {
  const sections = { S1: { assist_q: { max_miss_streak: 7 } } };
  assert.equal(maxMissTrackForSection(sections, "S1", "assist_q")?.max_miss_streak, 7);
});

test("maximum miss title shows threshold, game, and round in the requested order", () => {
  assert.equal(
    maxMissTitle({ threshold: 9, gameId: 123, roundNum: 45 }),
    "고연패 현황(9M 이상) #123 45회차",
  );
  assert.equal(
    maxMissTitle({ threshold: 9, gameId: 123, roundNum: 45, replay: true }),
    "고연패 현황(9M 이상) #123 45회차 리플레이",
  );
});

test("Excel clipboard payload keeps layout, colors, threshold, and aliased values", () => {
  const payload = buildMaxMissClipboardPayload({
    sections: {
      SSR1: {
        assist_h: { max_miss_streak: 10 },
        assist_q: { max_miss_streak: 8 },
      },
    },
    sectionRows: [[
      { key: "SSRN1", label: "SSRN1" },
      null,
      null,
      null,
    ]],
    threshold: 9,
    gameId: 123,
    roundNum: 45,
  });

  assert.match(payload.html, /고연패 현황\(9M 이상\) #123 45회차/);
  assert.match(payload.html, /회차어시 H/);
  assert.match(payload.html, /쿼터어시 Q/);
  assert.match(payload.html, /background-color:#181a1d/);
  assert.match(payload.html, /SSRN1/);
  assert.match(payload.html, /10M/);
  assert.doesNotMatch(payload.html, />8M</);
  assert.doesNotMatch(payload.html, /colspan=/i);
  assert.deepEqual(
    [...payload.tableHtml.matchAll(/<tr>(.*?)<\/tr>/g)].map(([, row]) => (row.match(/<td /g) || []).length),
    [17, 17, 17],
  );
  assert.match(payload.text, /^고연패 현황\(9M 이상\) #123 45회차/);
  assert.match(payload.text, /SSRN1\t10M/);
  assert.deepEqual(payload.text.split("\n").slice(1).map((row) => row.split("\t").length), [17, 17]);
});

test("clipboard writer falls back to tab-separated text", async () => {
  let copied = "";
  const clipboard = {
    writeText: async (value) => { copied = value; },
  };
  const format = await writeMaxMissClipboard(
    { html: "<table></table>", text: "A\tB" },
    null,
    clipboard,
  );

  assert.equal(format, "text");
  assert.equal(copied, "A\tB");
});

test("clipboard writer selects a real DOM table for native copy", async () => {
  let copied = false;
  let appended = null;
  const selection = {
    rangeCount: 0,
    removeAllRanges() {},
    addRange() {},
  };
  const container = {
    style: {},
    setAttribute() {},
    remove() { appended = null; },
  };
  const doc = {
    body: { appendChild(node) { appended = node; } },
    createElement() { return container; },
    createRange() { return { selectNodeContents(node) { assert.equal(node, container); } }; },
    getSelection() { return selection; },
    execCommand(command) {
      assert.equal(command, "copy");
      copied = true;
      return true;
    },
  };
  const format = await writeMaxMissClipboard(
    { html: "<html></html>", tableHtml: "<table><tr><td>A</td></tr></table>", text: "A" },
    doc,
    null,
  );

  assert.equal(format, "html");
  assert.equal(copied, true);
  assert.equal(container.innerHTML, "<table><tr><td>A</td></tr></table>");
  assert.equal(appended, null);
});

test("clipboard writer uses TSV when native copy fails", async () => {
  let copied = "";
  const container = {
    style: {},
    setAttribute() {},
    remove() {},
  };
  const doc = {
    body: { appendChild() {} },
    createElement() { return container; },
    createRange() { return { selectNodeContents() {} }; },
    getSelection() { return { rangeCount: 0, removeAllRanges() {}, addRange() {} }; },
    execCommand() { throw new Error("copy rejected"); },
  };
  const clipboard = {
    writeText: async (value) => { copied = value; },
  };
  const format = await writeMaxMissClipboard(
    { html: "<html></html>", tableHtml: "<table></table>", text: "A\tB" },
    doc,
    clipboard,
  );

  assert.equal(format, "text");
  assert.equal(copied, "A\tB");
});

test("PNG clipboard writer records a promised image blob", async () => {
  let writtenItems = [];
  class TestClipboardItem {
    constructor(data) { this.data = data; }
  }
  const clipboard = {
    write: async (items) => { writtenItems = items; },
  };
  const blob = { type: "image/png" };
  const format = await writePngToClipboard(Promise.resolve(blob), clipboard, TestClipboardItem);

  assert.equal(format, "image");
  assert.equal(writtenItems.length, 1);
  assert.equal(await writtenItems[0].data["image/png"], blob);
});

test("PNG clipboard writer rejects unsupported browsers and empty captures", async () => {
  await assert.rejects(() => writePngToClipboard({}, null, null), /unavailable/);
  class TestClipboardItem {
    constructor(data) { this.data = data; }
  }
  await assert.rejects(
    () => writePngToClipboard(null, { write: async () => {} }, TestClipboardItem),
    /no data/,
  );
});
