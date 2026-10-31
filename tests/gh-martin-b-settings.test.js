import assert from "node:assert/strict";
import test from "node:test";
import { MARTIN_B_PATTERN_ROW_COUNT, MARTIN_B_PATTERN_COUNT, martinBPatternLabel, martinBPatternOptions } from "../src/pages/ghgame/martin-b-settings.js";

test("마틴B의 기존 저장 인덱스와 번호 매핑을 유지한다", () => {
  assert.equal(MARTIN_B_PATTERN_COUNT, 25);
  assert.equal(MARTIN_B_PATTERN_ROW_COUNT, 60);
  const labels = Array.from({ length: 60 }, (_, i) => martinBPatternLabel(i));
  assert.deepEqual(labels.slice(0, 8), Array(8).fill("1"));
  assert.equal(labels[8], "2");
  assert.equal(labels[39], "5");
  assert.deepEqual(labels.slice(50), Array.from({ length: 10 }, (_, i) => String(i + 16)));
  assert.deepEqual(labels.slice(40, 50), ["6", "7", "8", "9", "10", "11", "12", "13", "14", "15"]);
});

test("번호별 미발동 설정을 보존하고 다른 번호에 전파하지 않는다", () => {
  const options = martinBPatternOptions([{ untriggered_round: 12, untriggered_action: "assist" }]);
  assert.equal(options.length, 25);
  assert.equal(options[0].untriggered_round, 12);
  assert.equal(options[0].untriggered_action, "assist");
  assert.equal(options[1].untriggered_round, 0);
  options[0].partial_patterns[0] = 2;
  assert.equal(options[1].partial_patterns[0], 0);
});


test("마틴B는 하위 패턴 없이 1~25번만 표시한다", async () => {
  const { MARTIN_B_VISIBLE_INDICES } = await import("../src/pages/ghgame/martin-b-settings.js");
  assert.deepEqual(MARTIN_B_VISIBLE_INDICES.map(martinBPatternLabel),
    Array.from({ length: 25 }, (_, i) => String(i + 1)));
});

test("벽치기 체크 조건과 패턴 수정 시 자동 해제", async () => {
  const { validWallPattern, patchMartinBRule } = await import("../src/pages/ghgame/martin-b-settings.js");
  for (const pattern of [[], ["P"], ["P", "P"], ["B", "P", "B"], ["P", "B", "P"]]) {
    assert.equal(validWallPattern(pattern), false);
  }
  const rule = { pattern: ["P", "P", "B", "P", "B"], wall_enabled: true };
  assert.equal(validWallPattern(rule.pattern), true);
  assert.equal(validWallPattern(["B", "B", "P"]), true);
  assert.equal(patchMartinBRule(rule, { pattern: ["B", "P", "B"] }).wall_enabled, false);
  assert.equal(patchMartinBRule(rule, { pattern: ["P", "P", ""] }).wall_enabled, false);
  assert.equal(patchMartinBRule(rule, { direction: "B" }).wall_enabled, true);
  assert.equal(patchMartinBRule(rule, { pattern: ["P", "P", "B"] }).wall_enabled, true);
});
