import assert from "node:assert/strict";
import test from "node:test";
import { MARTIN_B_PATTERN_ROW_COUNT, MARTIN_B_PATTERN_COUNT, martinBPatternLabel, martinBPatternOptions } from "../src/pages/ghgame/martin-b-settings.js";

test("마틴B는 1~5번 각 8개, 6~15번 각 1개로 표시한다", () => {
  assert.equal(MARTIN_B_PATTERN_COUNT, 15);
  assert.equal(MARTIN_B_PATTERN_ROW_COUNT, 50);
  const labels = Array.from({ length: 50 }, (_, i) => martinBPatternLabel(i));
  assert.deepEqual(labels.slice(0, 8), ["1-1", "1-2", "1-3", "1-4", "1-5", "1-6", "1-7", "1-8"]);
  assert.equal(labels[8], "2-1");
  assert.equal(labels[39], "5-8");
  assert.deepEqual(labels.slice(40), ["6", "7", "8", "9", "10", "11", "12", "13", "14", "15"]);
});

test("번호별 미발동 설정을 보존하고 다른 번호에 전파하지 않는다", () => {
  const options = martinBPatternOptions([{ untriggered_round: 12, untriggered_action: "assist" }]);
  assert.equal(options.length, 15);
  assert.equal(options[0].untriggered_round, 12);
  assert.equal(options[0].untriggered_action, "assist");
  assert.equal(options[1].untriggered_round, 0);
  options[0].partial_patterns[0] = 2;
  assert.equal(options[1].partial_patterns[0], 0);
});
