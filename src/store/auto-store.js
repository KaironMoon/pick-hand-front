/**
 * Jotai atoms for pick-aboo 자동 베팅 상태 — mvp-aboo-integration.md §3.0.
 *
 * 권위적 SoT는 백엔드(t9_auto_sessions + t9_rounds). 본 atom은 폴링 결과의 캐시.
 */
import { atom } from "jotai";

// 활성 Auto 세션 ID + 카운터
export const autoSessionAtom = atom({
  running: false,
  autoSessionId: null,
  lastEventAt: null,
  betsAttempted: 0,
  betsSucceeded: 0,
  betsFailed: 0,
});

// 모달 열림 여부
export const autoDialogOpenAtom = atom(false);

// 마지막 JSESSIONID 상태 (모달 진입 시 표시)
export const autoSessionInfoAtom = atom({
  captured: false,
  capturedAt: null,
  ageSeconds: null,
  status: "none",
  activeAutoSession: false,
});
