/**
 * pick-aboo 통합 자동 베팅 서비스 — mvp-aboo-integration.md §6.2 wrapper.
 *
 * 모든 호출은 백엔드 AUTO_BETTING_ENABLED 플래그에 따라 503 가능.
 * UI 측에서 503은 "기능 미활성" 안내로 처리.
 *
 * 세션과 자동 베팅 API에는 Pick Hand 로그인 아이디를 caller_user_id로 전달한다.
 */
import apiCaller from "./api-caller";
import { ABOO_API } from "@/constants/api-url";

const autoService = {
  async getSessionStatus(pickhandId) {
    const resp = await apiCaller.get(ABOO_API.SESSION_STATUS, { caller_user_id: pickhandId });
    return resp.data;
  },

  async startAuto({ gameId, pickhandId, tableId, server, gameType = "gh", playMode = "keep", keepCount = null, startMode = "first_round" }) {
    const resp = await apiCaller.post(ABOO_API.AUTO_START, {
      game_id: gameId,
      caller_user_id: pickhandId,
      table_id: tableId,
      server: server || null,
      game_type: gameType,
      play_mode: playMode,
      start_mode: startMode,
      keep_count: playMode === "keep" ? keepCount : null,
    });
    return resp.data;
  },

  async stopAuto(autoSessionId) {
    const resp = await apiCaller.post(ABOO_API.AUTO_STOP, { auto_session_id: autoSessionId });
    return resp.data;
  },

  async emergencyStop() {
    const resp = await apiCaller.post(ABOO_API.AUTO_EMERGENCY_STOP);
    return resp.data;
  },

  async stopRepeatAfterCycle() {
    const resp = await apiCaller.post(ABOO_API.AUTO_REPEAT_STOP);
    return resp.data;
  },

  async getAutoStatus(gameId, gameType = "gh") {
    const resp = await apiCaller.get(ABOO_API.AUTO_STATUS, { game_id: gameId, game_type: gameType });
    return resp.data;
  },

  async getAutoHistory(params) {
    const resp = await apiCaller.get(ABOO_API.AUTO_HISTORY, params);
    return resp.data;
  },

  async hideAutoHistory(sessionId) {
    await apiCaller.put(ABOO_API.AUTO_HISTORY_HIDE(sessionId));
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
