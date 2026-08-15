import assert from "node:assert/strict";
import test from "node:test";

import { emergencyStopResultMessage } from "../src/utils/emergency-stop-result.js";

test("emergency stop reports when no GH or NC2 Auto is running", () => {
  assert.equal(
    emergencyStopResultMessage({ targeted: 0, stopped: 0, failed: 0 }),
    "현재 실행 중인 글로벌히트·나이스초이스 오토가 없습니다.",
  );
});

test("emergency stop reports complete and partial results", () => {
  assert.equal(
    emergencyStopResultMessage({ targeted: 6, stopped: 6, failed: 0 }),
    "실행 중인 오토 6개를 모두 정지했습니다.",
  );
  assert.equal(
    emergencyStopResultMessage({ targeted: 6, stopped: 4, failed: 2 }),
    "총 6개 중 4개 정지, 2개 정지 실패했습니다.",
  );
});

test("emergency stop reports worker sweep failures", () => {
  assert.equal(
    emergencyStopResultMessage({ targeted: 0, stopped: 0, failed: 0, worker_failed: 1 }),
    "오토 실행 서버 1대의 상태를 확인하지 못했습니다. 다시 시도해 주세요.",
  );
  assert.equal(
    emergencyStopResultMessage({ targeted: 6, stopped: 4, failed: 2, worker_failed: 1 }),
    "확인된 6개 중 4개를 정지했지만, 오토 실행 서버 1대가 응답하지 않았습니다.",
  );
  assert.equal(
    emergencyStopResultMessage({ targeted: 1, stopped: 1, discovery_failed: true }),
    "확인된 1개 중 1개를 정지했지만, 다른 오토 실행 서버가 있는지 확인하지 못했습니다.",
  );
});
