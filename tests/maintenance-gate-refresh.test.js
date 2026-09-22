// MaintenanceGate.jsx의 inFlightRef 가드 로직 검증.
// 실제 JSX/React를 마운트하지 않고, refresh()와 동일한 패턴(동시 재진입 차단)을
// 순수 함수로 뽑아 테스트한다 — 이 저장소엔 @testing-library/react 등이 없어서
// node --test로 돌릴 수 있는 이 방식을 택했다.
import test from "node:test";
import assert from "node:assert/strict";

function makeGuardedRefresh(getStatus) {
  let inFlight = false;
  let callCount = 0;
  const refresh = async () => {
    if (inFlight) return;
    inFlight = true;
    callCount += 1;
    try {
      await getStatus();
    } finally {
      inFlight = false;
    }
  };
  refresh.callCount = () => callCount;
  return refresh;
}

test("두 번째 refresh는 첫 번째가 끝나기 전엔 실제 요청을 쏘지 않는다", async () => {
  let inFlightCalls = 0;
  const getStatus = () => {
    inFlightCalls += 1;
    return new Promise((resolve) => setTimeout(resolve, 50));
  };
  const refresh = makeGuardedRefresh(getStatus);

  const p1 = refresh();
  const p2 = refresh(); // 첫 응답 오기 전에 다시 호출 (setInterval 5초 폴링 상황 재현)
  await Promise.all([p1, p2]);

  assert.equal(inFlightCalls, 1, "in-flight 상태에서 두 번째 호출은 getStatus를 다시 부르면 안 된다");
});

test("첫 요청이 끝난 뒤엔 다음 refresh가 정상적으로 다시 호출된다", async () => {
  let inFlightCalls = 0;
  const getStatus = () => {
    inFlightCalls += 1;
    return Promise.resolve({ enabled: false });
  };
  const refresh = makeGuardedRefresh(getStatus);

  await refresh();
  await refresh();

  assert.equal(inFlightCalls, 2, "이전 요청이 끝났으면 다음 refresh는 정상적으로 호출되어야 한다");
});
