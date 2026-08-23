export const MAX_MISS_THRESHOLDS = Array.from({ length: 18 }, (_, index) => index + 3);
export const MAX_MISS_CAPTURE_PIXEL_RATIO = 1;
export const MAX_MISS_PNG_QUANTIZE_STEP = 16;
export const MAX_MISS_CAPTURE_SECTION_ORDER = [
  "max-miss",
  "pot-status",
  "round-amount-table",
];

export function includeInMaxMissImage(node) {
  return node?.dataset?.imageCaptureExclude !== "true";
}

export function quantizeRgba(data, step = MAX_MISS_PNG_QUANTIZE_STEP) {
  if (!data || step <= 1) return data;
  for (let index = 0; index < data.length; index += 4) {
    data[index] = Math.min(255, Math.round(data[index] / step) * step);
    data[index + 1] = Math.min(255, Math.round(data[index + 1] / step) * step);
    data[index + 2] = Math.min(255, Math.round(data[index + 2] / step) * step);
  }
  return data;
}

export async function compressPngBlob(
  blob,
  {
    documentRef = globalThis.document,
    createImageBitmapFn = globalThis.createImageBitmap,
    quantizeStep = MAX_MISS_PNG_QUANTIZE_STEP,
  } = {},
) {
  if (!blob || !documentRef?.createElement || typeof createImageBitmapFn !== "function") return blob;
  let bitmap;
  try {
    bitmap = await createImageBitmapFn(blob);
    const canvas = documentRef.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context || typeof canvas.toBlob !== "function") return blob;
    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    quantizeRgba(imageData.data, quantizeStep);
    context.putImageData(imageData, 0, 0);
    const compressed = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!compressed) return blob;
    if (Number(blob.size) > 0 && Number(compressed.size) >= Number(blob.size)) return blob;
    return compressed;
  } catch {
    return blob;
  } finally {
    bitmap?.close?.();
  }
}

const MAX_MISS_SECTION_KEY_ALIASES = {
  AARN: "AAR",
  SSRN1: "SSR1",
  SSRN2: "SSR2",
  SSRN3: "SSR3",
};

export function maxMissTrackForSection(sections, sectionKey, trackKey) {
  const stateKey = MAX_MISS_SECTION_KEY_ALIASES[sectionKey] || sectionKey;
  const section = sections?.[stateKey] || sections?.[sectionKey];
  return section?.[trackKey];
}

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const clipboardCell = (content, style) => `<td style="${style}">${escapeHtml(content)}</td>`;

export function maxMissTitle({ threshold, gameId = null, roundNum = null, replay = false }) {
  const parts = [`고연패 현황(${threshold}M 이상)`];
  if (gameId) parts.push(`#${gameId}`);
  if (roundNum) parts.push(`${roundNum}회차`);
  if (replay) parts.push("리플레이");
  return parts.join(" ");
}

export function buildMaxMissClipboardPayload({
  sections,
  sectionRows,
  threshold,
  gameId = null,
  roundNum = null,
  replay = false,
}) {
  const heading = maxMissTitle({ threshold, gameId, roundNum, replay });
  const labelStyle = (color) => [
    "border:1px solid #747474",
    "background-color:#181a1d",
    `color:${color}`,
    "font-weight:800",
    "font-size:13px",
    "text-align:center",
    "vertical-align:middle",
    "height:31px",
    "width:76px",
    "white-space:nowrap",
  ].join(";");
  const valueStyle = [
    "border:1px solid #747474",
    "background-color:#101214",
    "color:#ffeb3b",
    "font-weight:900",
    "font-size:14px",
    "text-align:center",
    "vertical-align:middle",
    "height:31px",
    "width:43px",
  ].join(";");
  const titleStyle = [
    "border:1px solid #b39b5d",
    "background-color:#111111",
    "color:#ffffff",
    "font-weight:900",
    "font-size:14px",
    "text-align:center",
    "height:31px",
  ].join(";");
  const headingStyle = `${titleStyle};font-size:16px;text-align:left`;
  const spacerStyle = "border:none;background-color:#111111;width:12px";

  const cellsFor = (row, trackKey, color) => row.flatMap((section) => {
    if (!section) {
      return [
        clipboardCell("", labelStyle("#555555")),
        clipboardCell("", valueStyle),
      ];
    }
    const track = maxMissTrackForSection(sections, section.key, trackKey);
    const value = maxMissLabel(track, threshold, section.always);
    return [
      clipboardCell(section.label, labelStyle(color)),
      clipboardCell(value, valueStyle),
    ];
  });

  const htmlRows = sectionRows.map((row) => (
    `<tr>${cellsFor(row, "assist_h", "#20c9e8").join("")}${clipboardCell("", spacerStyle)}${cellsFor(row, "assist_q", "#ff74df").join("")}</tr>`
  ));
  const headingCells = [
    clipboardCell(heading, headingStyle),
    ...Array.from({ length: 16 }, () => clipboardCell("", headingStyle)),
  ];
  const trackHeadingCells = [
    clipboardCell("회차어시 H", `${titleStyle};color:#20c9e8`),
    ...Array.from({ length: 7 }, () => clipboardCell("", titleStyle)),
    clipboardCell("", spacerStyle),
    clipboardCell("쿼터어시 Q", `${titleStyle};color:#ff74df`),
    ...Array.from({ length: 7 }, () => clipboardCell("", titleStyle)),
  ];
  const tableHtml = [
    '<table style="border-collapse:collapse;background-color:#111111;font-family:Arial,sans-serif">',
    `<tr>${headingCells.join("")}</tr>`,
    `<tr>${trackHeadingCells.join("")}</tr>`,
    ...htmlRows,
    "</table>",
  ].join("");
  const html = [
    '<html><head><meta charset="utf-8"></head><body>',
    tableHtml,
    "</body></html>",
  ].join("");

  const textRows = sectionRows.map((row) => {
    const cellsForText = (trackKey) => row.flatMap((section) => {
      if (!section) return ["", ""];
      const track = maxMissTrackForSection(sections, section.key, trackKey);
      return [section.label, maxMissLabel(track, threshold, section.always)];
    });
    return [...cellsForText("assist_h"), "", ...cellsForText("assist_q")].join("\t");
  });
  const text = [
    heading,
    ["회차어시 H", ...Array(7).fill(""), "", "쿼터어시 Q", ...Array(7).fill("")].join("\t"),
    ...textRows,
  ].join("\n");

  return { html, tableHtml, text };
}

export async function writeMaxMissClipboard(
  payload,
  doc = globalThis.document,
  clipboard = globalThis.navigator?.clipboard,
) {
  if (doc?.body && typeof doc.execCommand === "function") {
    const container = doc.createElement("div");
    const selection = doc.getSelection?.();
    const savedRanges = selection
      ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
      : [];
    let copied = false;
    try {
      container.setAttribute("aria-hidden", "true");
      container.contentEditable = "true";
      container.style.position = "fixed";
      container.style.left = "0";
      container.style.top = "-10000px";
      container.style.userSelect = "text";
      container.innerHTML = payload.tableHtml || payload.html;
      doc.body.appendChild(container);

      const range = doc.createRange();
      range.selectNodeContents(container);
      selection?.removeAllRanges();
      selection?.addRange(range);
      copied = doc.execCommand("copy");
    } catch {
      copied = false;
    } finally {
      selection?.removeAllRanges();
      savedRanges.forEach((range) => selection?.addRange(range));
      container.remove();
    }
    if (copied) return "html";
  }
  if (clipboard?.writeText) {
    await clipboard.writeText(payload.text);
    return "text";
  }
  throw new Error("Clipboard API is unavailable.");
}

export async function writePngToClipboard(
  blobOrPromise,
  clipboard = globalThis.navigator?.clipboard,
  ClipboardItemType = globalThis.ClipboardItem,
) {
  if (!clipboard?.write || !ClipboardItemType) {
    throw new Error("Image clipboard API is unavailable.");
  }
  const pngPromise = Promise.resolve(blobOrPromise).then((blob) => {
    if (!blob) throw new Error("PNG capture returned no data.");
    return blob;
  });
  const item = new ClipboardItemType({ "image/png": pngPromise });
  await clipboard.write([item]);
  await pngPromise;
  return "image";
}

export function maxMissLabel(track, threshold, always = false) {
  const maxMiss = Number(track?.max_miss_streak || 0);
  if (maxMiss <= 0 || (!always && maxMiss < threshold)) return "";
  return `${maxMiss}M`;
}
