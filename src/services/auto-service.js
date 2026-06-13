/**
 * pick-aboo 통합 자동 베팅 서비스 — mvp-aboo-integration.md §6.2 wrapper.
 *
 * 모든 호출은 백엔드 AUTO_BETTING_ENABLED 플래그에 따라 503 가능.
 * UI 측에서 503은 "기능 미활성" 안내로 처리.
 *
 * 식별자 키 규칙:
 *   - /users/profile/pickhand-id : pick-hand 자체 유저 ID → JSON 키 pickhand_id
 *   - auto/session/discover 계열 : 호출자(프론트) 관점 → 쿼리/바디 키 caller_user_id
 *   (둘 다 실제로는 같은 값 = pick-hand 로그인 username)
 */
import apiCaller from "./api-caller";
import { ABOO_API } from "@/constants/api-url";

const autoService = {
  async getSessionStatus(pickhandId) {
    const resp = await apiCaller.get(ABOO_API.SESSION_STATUS, { caller_user_id: pickhandId });
    return resp.data;
  },

  async updatePickhandId(pickhandId) {
    const resp = await apiCaller.put(ABOO_API.PICKHAND_ID, { pickhand_id: pickhandId });
    return resp.data;
  },

  async startAuto({ gameId, pickhandId, tableId, server, gameType = "gh" }) {
    const resp = await apiCaller.post(ABOO_API.AUTO_START, {
      game_id: gameId,
      caller_user_id: pickhandId,
      table_id: tableId,
      server: server || null,
      game_type: gameType,
    });
    return resp.data;
  },

  async stopAuto(autoSessionId) {
    const resp = await apiCaller.post(ABOO_API.AUTO_STOP, { auto_session_id: autoSessionId });
    return resp.data;
  },

  async getAutoStatus(gameId) {
    const resp = await apiCaller.get(ABOO_API.AUTO_STATUS, { game_id: gameId });
    return resp.data;
  },

  async discoverTables(pickhandId, refresh = false) {
    const resp = await apiCaller.get(ABOO_API.DISCOVER_TABLES, {
      caller_user_id: pickhandId,
      refresh,
    });
    return resp.data; // { tables: [...], count, refresh_cooldown }
  },
};

export default autoService;
