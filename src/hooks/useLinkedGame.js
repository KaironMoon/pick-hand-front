import { useState, useEffect, useRef, useCallback } from "react";
import apiCaller from "@/services/api-caller";
import { USER_BET_SETTINGS_API, LINKED_GAMES_API } from "@/constants/api-url";

/**
 * 연동게임 훅 — 연동 설정 로드 + 롱폴링 + 연동 API 호출 래퍼
 *
 * @param {string} gameType - 현재 게임 타입 (gh, hb, t9, ...)
 * @param {number|null} gameId - 현재 게임 ID
 * @param {number} roundNum - 현재 라운드 수
 * @param {function} onUpdate - 롱폴링으로 변경 감지 시 호출할 콜백 (state 갱신)
 */
export default function useLinkedGame(gameType, gameId, roundNum, onUpdate) {
  const [linkedGames, setLinkedGames] = useState([]);
  const [isLinked, setIsLinked] = useState(false);
  const pollingRef = useRef(false);
  const abortRef = useRef(null);

  // 연동 설정 로드
  useEffect(() => {
    apiCaller.get(USER_BET_SETTINGS_API.GET("common")).then((res) => {
      const games = res.data.config?.linked_games || [];
      setLinkedGames(games);
      setIsLinked(games.length > 0);
    }).catch(() => {});
  }, [gameType]);

  // 롱폴링
  useEffect(() => {
    if (!isLinked || !gameId) return;
    pollingRef.current = true;

    const poll = async () => {
      while (pollingRef.current) {
        try {
          abortRef.current = new AbortController();
          const res = await apiCaller.get(LINKED_GAMES_API.POLL,
            { game_type: gameType, game_id: gameId, round_num: roundNum },
            { signal: abortRef.current.signal, timeout: 35000 },
          );
          if (res.data?.changed && pollingRef.current) {
            const serverRound = res.data.round_num;
            if (serverRound !== undefined && serverRound !== roundNum) {
              if (serverRound < roundNum) {
                alert("연동게임 회차 불일치가 감지되었습니다. 페이지를 리로드합니다.");
                window.location.reload();
                return;
              }
            }
            onUpdate?.();
          }
        } catch (err) {
          if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") break;
          // 네트워크 에러 시 잠시 대기 후 재시도
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    };

    poll();

    return () => {
      pollingRef.current = false;
      abortRef.current?.abort();
    };
  }, [isLinked, gameId, gameType, roundNum, onUpdate]);

  // 연동 API 래퍼들
  const linkedStart = useCallback(async (carryOver, prevGameId) => {
    if (!isLinked) return null;
    try {
      const res = await apiCaller.post(LINKED_GAMES_API.START, {
        game_type: gameType,
        carry_over: carryOver || null,
        prev_game_id: prevGameId || null,
      });
      return res.data;
    } catch { return null; }
  }, [isLinked, gameType]);

  const linkedRound = useCallback(async (gid, actual) => {
    if (!isLinked) return null;
    try {
      const res = await apiCaller.post(LINKED_GAMES_API.ROUND, {
        game_type: gameType,
        game_id: gid,
        actual,
      });
      return res.data;
    } catch { return null; }
  }, [isLinked, gameType]);

  const linkedNext = useCallback(async (gid) => {
    if (!isLinked) return null;
    try {
      const res = await apiCaller.post(LINKED_GAMES_API.NEXT, {
        game_type: gameType,
        game_id: gid,
      });
      return res.data;
    } catch { return null; }
  }, [isLinked, gameType]);

  const linkedEnd = useCallback(async (gid) => {
    if (!isLinked) return null;
    try {
      const res = await apiCaller.post(LINKED_GAMES_API.END, {
        game_type: gameType,
        game_id: gid,
      });
      return res.data;
    } catch { return null; }
  }, [isLinked, gameType]);

  const linkedDeleteLastRound = useCallback(async (gid) => {
    if (!isLinked) return null;
    try {
      const res = await apiCaller.delete(LINKED_GAMES_API.LAST_ROUND, {
        params: { game_type: gameType, game_id: gid },
      });
      return res.data;
    } catch { return null; }
  }, [isLinked, gameType]);

  return {
    isLinked,
    linkedGames,
    linkedStart,
    linkedRound,
    linkedNext,
    linkedEnd,
    linkedDeleteLastRound,
  };
}
