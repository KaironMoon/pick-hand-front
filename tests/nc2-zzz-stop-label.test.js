import assert from "node:assert/strict";
import test from "node:test";

import { nc2ZzzStopLabel } from "../src/pages/nc2game/zzz-stop-label.js";

test("NC2 ZZZ stop label explains disabled, immediate, and step conditions", () => {
  assert.equal(nc2ZzzStopLabel(0, 5), "종료조건 미사용");
  assert.equal(nc2ZzzStopLabel(40, 0), "40회차 종료");
  assert.equal(nc2ZzzStopLabel(40, 5), "40회차 이후 5패 도달 시 종료");
  assert.equal(nc2ZzzStopLabel(0, 0, 100.5), "100.5P 손실 시 종료");
  assert.equal(
    nc2ZzzStopLabel(40, 5, 100),
    "40회차 이후 5패 도달 시 종료 / 100P 손실 시 종료",
  );
});
