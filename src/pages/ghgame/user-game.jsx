import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Typography, useMediaQuery, useTheme, Dialog, DialogTitle, DialogContent, DialogActions, Button, Tooltip, Snackbar, Alert } from "@mui/material";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/auth-store";
import apiCaller from "@/services/api-caller";
import autoService from "@/services/auto-service";
import AutoStartDialog from "../t9game/components/AutoStartDialog";
import GhStrategyBoard from "./components/GhStrategyBoard";
import GhBigRoad2 from "./components/GhBigRoad2";
import { GH_GAMES_API, USER_BET_SETTINGS_API } from "@/constants/api-url";

// blink 애니메이션
const blinkKeyframes = `@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }`;
if (typeof document !== "undefined" && !document.getElementById("gh-blink-style")) {
  const style = document.createElement("style");
  style.id = "gh-blink-style";
  style.textContent = blinkKeyframes;
  document.head.appendChild(style);
}

const PC_COLOR = "#e040fb";   // 픽체인지: 보라
const LSC_COLOR = "#000000";  // LSC: 검정 (모든 배경에서 고대비)
const DS_COLOR = "#FF6600";   // 데칼/그림자: 형광 주황

const GRID_ROWS = 6;
const GRID_COLS = 40;

const CELL_BG = {
  hit: "#00e676",
  miss: "#ffeb3b",
  wait: "#ffffff",
};

const Circle = ({ type, filled = true, size = 24, label }) => {
  const colors = { P: "#1565c0", B: "#f44336" };
  const display = label != null ? label : type;
  return (
    <Box
      sx={{
        width: size, height: size, borderRadius: "50%",
        backgroundColor: filled ? colors[type] : "#fff",
        border: "1px solid", borderColor: colors[type],
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: label != null ? size * 0.4 : size * 0.5,
        fontWeight: "bold", color: filled ? "#fff" : colors[type],
      }}
    >{display}</Box>
  );
};

const calculateCircleGrid = (results) => {
  const grid = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
  if (!results || results.length === 0) return grid;

  let col = 0, row = 0, prevValue = null, verticalStartCol = 0, isBent = false;
  for (let i = 0; i < results.length; i++) {
    const current = results[i].value;
    const status = results[i].status || "wait";
    const pickChanged = !!results[i].pickChanged;
    const decalShadow = !!results[i].decalShadow;
    if (prevValue === null) {
      grid[row][col] = { type: current, status, idx: i, pickChanged, decalShadow };
      verticalStartCol = col;
    } else if (current === prevValue) {
      if (isBent) { col++; }
      else if (row >= GRID_ROWS - 1) { col++; isBent = true; }
      else if (grid[row + 1][col]) { col++; isBent = true; }
      else { row++; }
      if (col >= GRID_COLS) break;
      grid[row][col] = { type: current, status, idx: i, pickChanged, decalShadow };
    } else {
      verticalStartCol++;
      col = verticalStartCol;
      row = 0;
      isBent = false;
      if (col >= GRID_COLS) break;
      grid[row][col] = { type: current, status, idx: i, pickChanged, decalShadow };
    }
    prevValue = current;
  }
  return grid;
};

const toggleBtnSx = {
  border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1,
  px: 1, py: 0.3, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", minWidth: 40,
  "&:hover": { opacity: 0.8 },
};

const controlBtnSx = {
  border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1,
  px: 1.5, py: 0.5, backgroundColor: "background.paper",
  "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" },
};

function RoundAmountTable({ roundState }) {
  const table = roundState?.round_amount_table || {};
  const cellCount = 64;
  const cells = table.cells || Array.from({ length: cellCount }, (_, idx) => ({ round: idx + 1, amount: 0, pnl: 0, status: null, actual: null, pick: null }));
  const fmt = (v) => Number(v || 0).toFixed(1);
  const finalSide = table.total_side;
  const finalSideColor = finalSide === "P" ? "#1565d8" : finalSide === "B" ? "#e53935" : "#555";
  const cellSx = (idx) => {
    const cell = cells[idx] || {};
    const hasResult = !!cell.actual;
    const hasBet = Number(cell.amount || 0) > 0;
    return {
      width: 86,
      height: 30,
      border: "1px solid #3f4650",
      backgroundColor: hasResult && hasBet ? (cell.status === "hit" ? "#2e9e5b" : "#5b6068") : "#101318",
      display: "grid",
      gridTemplateColumns: "22px 1fr",
      alignItems: "center",
      overflow: "hidden",
    };
  };
  const roundColor = (idx) => {
    const v = cells[idx]?.pick ?? cells[idx]?.side;
    if (v === "P") return "#1565d8";
    if (v === "B") return "#e53935";
    return "#777";
  };
  return (
    <Box sx={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 0.4, p: 0.5, backgroundColor: "#0d1014", borderRadius: 1 }}>
      <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end", width: "100%" }}>
        <Box sx={{ width: 30, border: "1px solid #3f4650", backgroundColor: finalSideColor, color: "#fff", fontSize: 13, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {finalSide || "-"}
        </Box>
        <Box sx={{ width: 150, border: "1px solid #3f4650", backgroundColor: "#111821", color: "#fff", fontSize: 11, fontWeight: "bold", px: 1, py: 0.35, display: "flex", justifyContent: "space-between" }}>
          <span>합산</span><span>{fmt(table.total_amount)}</span>
        </Box>
        <Box sx={{ width: 150, border: "1px solid #3f4650", backgroundColor: "#111821", color: Number(table.total_pnl || 0) >= 0 ? "#00e676" : "#ef5350", fontSize: 11, fontWeight: "bold", px: 1, py: 0.35, display: "flex", justifyContent: "space-between" }}>
          <span>PnL</span><span>{fmt(table.total_pnl)}</span>
        </Box>
      </Box>
      <Box sx={{ display: "grid", gridTemplateRows: "repeat(8, 30px)", gridAutoFlow: "column", gridAutoColumns: "86px", gap: "2px" }}>
        {Array.from({ length: cellCount }, (_, idx) => (
          <Box key={idx} sx={cellSx(idx)} title={`${idx + 1}회차 / ${fmt(cells[idx]?.amount)} / PnL ${fmt(cells[idx]?.pnl)}`}>
            <Box sx={{ color: roundColor(idx), fontSize: 10, fontWeight: "bold", textAlign: "center" }}>{idx + 1}</Box>
            <Box sx={{ color: "#fff", fontSize: 11, fontWeight: "bold", textAlign: "right", pr: 0.4 }}>{fmt(cells[idx]?.amount)}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function GhUserGamePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const user = useAtomValue(userAtom);
  const isAdmin = user?.role === "admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const [collapsedPatterns, setCollapsedPatterns] = useState({});
  const [results, setResults] = useState([]);
  const [globalhitData, setGlobalhitData] = useState([]);
  const [topGhSections, setTopGhSections] = useState([]);
  const [topNextRound, setTopNextRound] = useState(null);
  const [pickChangePick, setPickChangePick] = useState(null);
  const [lscMatches, setLscMatches] = useState([]);
  const [decalPick, setDecalPick] = useState(null);
  const [shadowPick, setShadowPick] = useState(null);
  const [decalAxis, setDecalAxis] = useState(null);
  const [shadowAxis, setShadowAxis] = useState(null);
  const [roundDsList, setRoundDsList] = useState([]);
  const [lscPick, setLscPick] = useState(null);
  const [roundLscList, setRoundLscList] = useState([]);
  const [twoPick, setTwoPick] = useState(null);
  const [roundTwoList, setRoundTwoList] = useState([]);
  // DO NOT USE FOR NEW UI: picks_snapshot은 서버 roundState 갱신 입력 전용 레거시 payload다.
  // 화면 표시/빅로드/전략보드/API 표시 기준 데이터는 반드시 roundState만 사용한다.
  // 기존 보조 컴포넌트가 아직 남아 있어 state로 보관하지만, 신규 참조를 추가하지 말 것.
  const [picksSnapshot, setPicksSnapshot] = useState(null);
  const [roundState, setRoundState] = useState(null);
  const [batExpanded, setBatExpanded] = useState({}); // {`gi-ri`: true} — Bat 셀 전체 표시 토글
  const [trackStreakHidden, setTrackStreakHidden] = useState({}); // {sckey: true} — 트랙 연승/연패 셀 숨김 토글
  const [chartGroup, setChartGroup] = useState("A"); // 빅로드2 누적 그래프 표시 그룹
  const [betData, setBetData] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [config, setConfig] = useState(null);
  const [cumPnL, setCumPnL] = useState({ gh: 0, user_a: 0, user_z: 0, user_s: 0, allp: 0, allb: 0, fail: 0, hnh: 0, one: 0, two: 0, labouchere: 0 });
  const [showNextConfirm, setShowNextConfirm] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [endingMode, setEndingMode] = useState(false);
  const [endingSnapshot, setEndingSnapshot] = useState(null);
  const [endingDone, setEndingDone] = useState(false);
  const [resumeGame, setResumeGame] = useState(null);
  const [userSummary, setUserSummary] = useState(null);
  const [userMartinDashboard, setUserMartinDashboard] = useState(null);
  const [labSeqOpen, setLabSeqOpen] = useState(false);
  const [labHmPressed, setLabHmPressed] = useState(null); // "H" | "M" | null
  const processingRef = useRef(false);
  const skipRestoreGameIdRef = useRef(null);
  const [processing, setProcessing] = useState(false);
  const goalAlertedRef = useRef({ a: false, z: false });

  const [goalDialog, setGoalDialog] = useState({ open: false, msgs: [] });

  // Auto 모드 (pick-aboo 통합) — t9game/index.jsx에서 포팅
  const [autoFeatureAvailable, setAutoFeatureAvailable] = useState(true);
  const [autoDialogOpen, setAutoDialogOpen] = useState(false);
  const [autoStatus, setAutoStatus] = useState({ running: false, autoSessionId: null });
  const [rejectMsg, setRejectMsg] = useState(null);  // 베팅 거부 레이어 팝업
  const [myPickhandId, setMyPickhandId] = useState(null);

  const currentTurn = results.length + 1;
  const inputLocked = processing;
  // LEGACY COMPAT ONLY: displaySnapshot 별칭은 남은 레거시 보조표용이다.
  // 새 화면/상태 판단/픽 표시/닷 표시에는 사용 금지. 필요한 데이터는 서버에서 roundState에 추가한다.
  const displaySnapshot = picksSnapshot;
  const roundAmountCells = roundState?.round_amount_table?.cells || [];
  const amountTableStatusFor = (idx) => {
    const cell = roundAmountCells[idx] || {};
    const pick = cell.pick ?? cell.side;
    const actual = cell.actual ?? results[idx]?.value;
    if (cell.status === "hit" || cell.status === "miss") return cell.status;
    if ((pick === "P" || pick === "B") && (actual === "P" || actual === "B")) {
      return pick === actual ? "hit" : "miss";
    }
    return "wait";
  };
  // 빅로드1: 지난 회차의 실제 결과 P/B를 표시하고, 배경색은 금액 합산표의 적/미적으로 결정한다.
  const gridResults = results.map((r, i) => ({ ...r, status: amountTableStatusFor(i) }));
  const grid = calculateCircleGrid(gridResults);

  // LEGACY COMPAT ONLY: 하단 보조 표시용. 현재 판/전략보드/빅로드 표시는 roundState 사용.
  const roundArList = displaySnapshot?.round_picks?.AR || [];
  const roundJList = displaySnapshot?.round_picks?.J || [];

  const checkGoalAlert = useCallback((summary) => {
    if (!summary) return;
    const ref = goalAlertedRef.current;
    const aReached = summary.martin_a?.goal_reached;
    const zReached = summary.martin_z?.goal_reached;
    const msgs = [];
    if (aReached && !ref.a) msgs.push("마틴 A");
    if (zReached && !ref.z) msgs.push("마틴 Z");
    ref.a = !!aReached;
    ref.z = !!zReached;
    if (msgs.length > 0) setGoalDialog({ open: true, msgs });
  }, []);

  const displayPick = (() => {
    const umComb = betData?.user_martin?.combined?.direction;
    if (umComb && umComb !== "wait") return umComb;
    const adComb = betData?.combined?.direction;
    return adComb && adComb !== "wait" ? adComb : null;
  })();
  const pickImage = displayPick === "P" ? "/player.png" : displayPick === "B" ? "/banker.png" : "/wait.png";

  const startGame = useCallback(async () => {
    try {
      const res = await apiCaller.post(GH_GAMES_API.START + "?mode=user");
      setGameId(res.data.game_id);
      setConfig(res.data.config);
      setGlobalhitData(res.data.globalhit || []);
      setTopGhSections(res.data.top_gh_sections || []); setTopNextRound(res.data.top_next_round ?? null); setPickChangePick(res.data.pick_change_pick ?? null);
      setPicksSnapshot(res.data.picks_snapshot || null); setRoundState(res.data.round_state || null);
      skipRestoreGameIdRef.current = res.data.game_id;
      setSearchParams({ gameId: res.data.game_id }, { replace: true });
    } catch (err) {
      console.error("Failed to start game:", err);
      if (err.response?.status === 400) {
        alert(err.response.data?.detail || "배팅 설정이 필요합니다.");
        navigate("/ghgame/user-setup");
        return;
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const isNew = searchParams.get("new");
    const urlGameId = searchParams.get("gameId");
    if (isNew) {
      setResults([]); setCumPnL({ gh: 0, user_a: 0, user_z: 0, user_s: 0, allp: 0, allb: 0, fail: 0, hnh: 0, one: 0, two: 0, labouchere: 0 }); setBetData(null); setUserSummary(null); setUserMartinDashboard(null);
      setGlobalhitData([]);
      setTopGhSections([]); setTopNextRound(null); setPickChangePick(null);
      setPicksSnapshot(null); setRoundState(null);
      startGame();
    } else if (urlGameId) {
      const gid = parseInt(urlGameId);
      if (skipRestoreGameIdRef.current === gid) {
        skipRestoreGameIdRef.current = null;
      } else {
        restoreGame(gid);
      }
    } else {
      // 직전 게임이 active면 복원 여부 확인
      apiCaller.get(GH_GAMES_API.LAST_ACTIVE + "?mode=user").then(async (res) => {
        if (cancelled) return;
        const game = res.data?.game;
        if (game && game.round_count > 0) {
          setResumeGame(game);
        } else {
          if (game) {
            try { await apiCaller.post(GH_GAMES_API.END, null, { params: { game_id: game.game_id } }); } catch {}
          }
          if (!cancelled) startGame();
        }
      }).catch(() => { if (!cancelled) startGame(); });
    }
    return () => { cancelled = true; };
  }, [searchParams.get("new"), searchParams.get("gameId")]); // eslint-disable-line react-hooks/exhaustive-deps

  const restoreGame = async (gid) => {
    try {
      const res = await apiCaller.get(GH_GAMES_API.STATE(gid) + "?mode=user");
      const data = res.data;
      setGameId(data.game_id);
      setConfig(data.config);
      setCumPnL(data.cum_pnl || { gh: 0, user_a: 0, user_z: 0, user_s: 0, allp: 0, allb: 0, fail: 0, hnh: 0, one: 0, two: 0, labouchere: 0 });
      const seq = data.seq || "";
      const picks = data.round_picks || [];
      const statuses = data.round_status || [];
      const statusesAr = data.round_status_ar || [];
      const pcMarks = data.round_pick_change || [];
      const dsMarks = data.round_decal_shadow || [];
      setResults(seq.split("").map((v, i) => {
        const pick = picks[i];
        // hit/miss 여부는 서버가 내려준 round_status를 그대로 사용 (프론트는 색상만 결정)
        const status = statuses[i] || "wait";
        const statusAr = statusesAr[i] || "wait";
        return { value: v, status, statusAr, aPick: pick || null, pickChanged: !!pcMarks[i], decalShadow: !!(dsMarks[i]?.decal_pick || dsMarks[i]?.shadow_pick) };
      }));
      setGlobalhitData(data.globalhit || []);
      setTopGhSections(data.top_gh_sections || []); setTopNextRound(data.top_next_round ?? null); setPickChangePick(data.pick_change_pick ?? null); setLscMatches(data.lsc_matches || []); setLscPick(data.lsc_pick ?? null); setRoundLscList(data.round_lsc_picks || []); setTwoPick(data.two_pick ?? null); setRoundTwoList(data.round_two_picks || []); setPicksSnapshot(data.picks_snapshot || null); setRoundState(data.round_state || null); setDecalPick(data.decal_pick ?? null); setShadowPick(data.shadow_pick ?? null); setDecalAxis(data.decal_axis ?? null); setShadowAxis(data.shadow_axis ?? null); setRoundDsList(data.round_decal_shadow || []);
      setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
      setUserSummary(data.user_summary || null);
      setUserMartinDashboard(data.user_martin_dashboard || null);      if (data.status === "ending" && data.ending_snapshot) {
        setEndingMode(true);
        setEndingSnapshot(data.ending_snapshot);
      }
    } catch (err) {
      console.error("Failed to restore, starting new:", err);
      startGame();
    }
  };

  // ─── Auto 모드 (pick-aboo 통합) — t9game/index.jsx 패턴 동일 ───
  // pickhand_id: userAtom에서 직접. fallback으로 username 사용
  // (auth-store.js가 로그인 시 username을 pickhand_id로 자동 등록한다는 가정)
  useEffect(() => {
    setMyPickhandId(user?.pickhand_id || user?.username || null);
  }, [user]);

  // Auto 상태 폴링 (1초)
  useEffect(() => {
    if (!gameId || !autoFeatureAvailable) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const st = await autoService.getAutoStatus(gameId);
        if (!cancelled) {
          setAutoStatus((prev) => ({
            ...prev,
            running: !!st.running,
            autoSessionId: st.auto_session_id || null,
            lastEventAt: st.last_event_at,
            betsAttempted: st.bets_attempted,
            betsSucceeded: st.bets_succeeded,
            betsFailed: st.bets_failed,
            phase: st.phase ?? prev.phase,
            goal_amount: st.goal_amount ?? prev.goal_amount,
            end_round: st.end_round ?? prev.end_round,
            clear_stage: st.clear_stage ?? prev.clear_stage,
            pnl_total: st.pnl_total ?? prev.pnl_total,
            pnl_actual: st.pnl_actual ?? prev.pnl_actual,
            round_count: st.round_count ?? prev.round_count,
            table_name: st.table_name ?? prev.table_name,
          }));
        }
      } catch (e) {
        if (e?.response?.status === 503) {
          setAutoFeatureAvailable(false);
        }
      }
    };
    tick();
    const id = setInterval(tick, 5000);  // auto-status 폴링 1s → 5s로 완화 (호출량 감소 260603)
    return () => { cancelled = true; clearInterval(id); };
  }, [gameId, autoFeatureAvailable]);

  // ── Auto WebSocket 구독 (실시간 이벤트 푸시) ───────────
  useEffect(() => {
    if (!autoFeatureAvailable) return undefined;
    if (!autoStatus.running) return undefined;
    const token = sessionStorage.getItem("pick_hand_token");
    if (!token) return undefined;

    const base = import.meta.env.VITE_API_BASE_URL || window.location.origin;
    // base가 http://x:9001 → ws://x:9001/ws/auto
    const wsBase = base.replace(/^http/, "ws");
    const wsUrl = `${wsBase}/ws/auto?token=${encodeURIComponent(token)}`;

    let ws;
    let pingTimer;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        // keepalive ping 30초마다
        pingTimer = setInterval(() => {
          try { ws.send("ping"); } catch (_) {}
        }, 30000);
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          const t = msg.type;
          const data = msg.data || {};
          if (t === "round_committed") {
            // 라운드 추가 → restoreGame 호출이 가장 안전 (전체 state 동기화)
            if (data.game_id) restoreGame(data.game_id);
            // autoStatus 동기화 — phase / round_count / pnl_total / pnl_actual
            setAutoStatus((prev) => ({
              ...prev,
              phase: data.phase ?? prev.phase,
              round_count: data.round_count ?? prev.round_count,
              pnl_total: data.pnl_total ?? prev.pnl_total,
              pnl_actual: data.pnl_actual ?? prev.pnl_actual,
            }));
          } else if (t === "phase_changed") {
            setAutoStatus((prev) => ({
              ...prev,
              phase: data.phase,
              pnl_total: data.pnl_total ?? prev.pnl_total,
              pnl_actual: data.pnl_actual ?? prev.pnl_actual,
              goal_amount: data.goal_amount ?? prev.goal_amount,
              end_round: data.end_round ?? prev.end_round,
              clear_stage: data.clear_stage ?? prev.clear_stage,
              round_count: data.round_count ?? prev.round_count,
            }));
            if (data.game_id && data.game_id !== gameId) {
              setGameId(data.game_id);
              setSearchParams({ gameId: data.game_id }, { replace: true });
            }
            if (data.phase === "clearing") {
              console.info("[Auto] 단계해소 모드 진입 — 적중까지 연장");
            }
          } else if (t === "game_switched") {
            setGameId(data.new_game_id);
            setSearchParams({ gameId: data.new_game_id }, { replace: true });
            restoreGame(data.new_game_id);
          } else if (t === "auto_restarted") {
            // 새 슈에서 Auto 자동 재시작 — 새 session_id로 갱신, running 유지
            setAutoStatus((prev) => ({
              ...prev,
              running: true,
              autoSessionId: data.auto_session_id,
              phase: "betting",
              round_count: 0,
              pnl_total: 0,
              pnl_actual: 0,
            }));
            console.info(`[Auto] 재시작: new_session=${data.auto_session_id} game=${data.game_id}`);
          } else if (t === "goal_reached") {
            console.info(`[Auto] 목표 달성: 실 PnL ${data.final_pnl_actual} / 목표 ${data.goal_amount}`);
          } else if (t === "session_ended") {
            const reasonMap = {
              goal_reached: "목표액 도달",
              end_round_reached: "종료회차 도달",
              stage_cleared: "단계해소 완료",
              casino_shoe_ended: "카지노 슈 종료",
            };
            console.info(
              `[Auto] 종료: ${reasonMap[data.reason] || data.reason} | 실 PnL=${data.final_pnl_actual} | 라운드=${data.round_count} | 새 게임=${data.new_game_id ?? '생성 실패'}`,
            );
            // running 유지 — 자동 재시작이 따라올 수 있음. 진짜 정지는 status poll(5s)이 잡거나 stop 버튼이 처리.
          } else if (t === "bet_rejected") {
            // 카지노가 베팅을 받지 않음(미체결) → 실 PnL 보정됨. 레이어 팝업 안내.
            setRejectMsg("베팅이 거부되었습니다 (카지노 미체결)");
          }
          // bet_attempt 는 별도 UI 없으면 생략
        } catch (e) {
          // ignore
        }
      };
      ws.onclose = () => {
        clearInterval(pingTimer);
        if (!cancelled && autoStatus.running) {
          // 자동 재연결 5초
          setTimeout(connect, 5000);
        }
      };
      ws.onerror = () => {
        try { ws.close(); } catch (_) {}
      };
    };
    connect();

    return () => {
      cancelled = true;
      clearInterval(pingTimer);
      try { ws && ws.close(); } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFeatureAvailable, autoStatus.running]);

  const handleAutoToggle = async () => {
    if (!autoFeatureAvailable) return;
    if (autoStatus.running && autoStatus.autoSessionId) {
      try {
        await autoService.stopAuto(autoStatus.autoSessionId);
        setAutoStatus({ running: false, autoSessionId: null });
      } catch (e) {
        console.warn("auto stop failed", e);
      }
    } else {
      // 새 게임에서 시작하는 게 안전 — 진행 중인 게임이면 경고
      const hasRounds = (results?.length || 0) > 0;
      if (hasRounds) {
        const ok = window.confirm(
          "현재 게임에 이미 진행된 라운드가 있습니다.\n\n" +
          "Auto는 새 게임에서 시작하는 것을 권장합니다.\n" +
          "취소 후 [new] 버튼으로 새 게임을 만든 뒤 다시 시작하세요.\n\n" +
          "그래도 현재 게임에서 진행하시겠습니까?"
        );
        if (!ok) return;
      }
      setAutoDialogOpen(true);
    }
  };

  const handleInput = async (inputValue) => {
    if (!gameId || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    // hit/miss 여부는 서버가 판정해 내려준다(응답의 round_status_current). 입력 직후엔 미정(wait)으로 낙관적 추가 후 응답으로 확정.
    const normalPick = betData?.user_martin?.combined?.direction || betData?.combined?.direction;
    const effectivePick = pickChangePick || normalPick;
    setResults((prev) => [...prev, { value: inputValue, status: "wait", statusAr: "wait", aPick: effectivePick && effectivePick !== "wait" ? effectivePick : null, pickChanged: !!pickChangePick, decalShadow: decalPick !== null || shadowPick !== null }]);
    setBetData(null);

    try {
      const res = await apiCaller.post(GH_GAMES_API.ROUND, { game_id: gameId, actual: inputValue });
      const data = res.data;
      if (data.round_num !== undefined && data.round_num !== results.length + 1) {
        alert("서버/클라이언트 불일치가 감지되어 페이지를 리로드합니다.");
        window.location.reload();
        return;
      }
      // 방금 입력한 라운드의 hit/miss를 서버 판정값으로 확정 (프론트 자체 계산 안 함)
      if (data.round_status_current) {
        setResults((prev) => prev.map((r, i) => (i === prev.length - 1
          ? { ...r, status: data.round_status_current, statusAr: data.round_status_ar_current || r.statusAr }
          : r)));
      }
      setCumPnL({ gh: data.cum_pnl.gh, user_a: data.cum_pnl.user_a || 0, user_z: data.cum_pnl.user_z || 0, user_s: data.cum_pnl.user_s || 0, allp: data.cum_pnl.allp || 0, allb: data.cum_pnl.allb || 0, fail: data.cum_pnl.fail || 0, hnh: data.cum_pnl.hnh || 0, one: data.cum_pnl.one || 0, two: data.cum_pnl.two || 0, labouchere: data.cum_pnl.labouchere || 0 });
      setGlobalhitData(data.globalhit || []);
      setTopGhSections(data.top_gh_sections || []); setTopNextRound(data.top_next_round ?? null); setPickChangePick(data.pick_change_pick ?? null); setLscMatches(data.lsc_matches || []); setLscPick(data.lsc_pick ?? null); setRoundLscList(data.round_lsc_picks || []); setTwoPick(data.two_pick ?? null); setRoundTwoList(data.round_two_picks || []); setPicksSnapshot(data.picks_snapshot || null); setRoundState(data.round_state || null); setDecalPick(data.decal_pick ?? null); setShadowPick(data.shadow_pick ?? null); setDecalAxis(data.decal_axis ?? null); setShadowAxis(data.shadow_axis ?? null); setRoundDsList(data.round_decal_shadow || []);
      setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
      setUserSummary(data.user_summary || null);
      setUserMartinDashboard(data.user_martin_dashboard || null);      checkGoalAlert(data.user_summary);

      if (endingMode && endingSnapshot && checkEndingComplete(data)) {
        setEndingDone(true);
        setBetData(null); setUserSummary(null);
      }
    } catch (err) {
      console.error("Failed to record round:", err);
      setResults((prev) => prev.slice(0, -1));
      if (err.response?.status === 404) {
        alert("게임이 종료되었거나 존재하지 않습니다.");
        navigate("/");
        return;
      }
      alert("서버 오류로 입력이 반영되지 않았습니다. 다시 시도해주세요.");
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  const handleDeleteOne = useCallback(async () => {
    if (results.length === 0 || !gameId || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    try {
      const res = await apiCaller.delete(GH_GAMES_API.LAST_ROUND(gameId));
      const data = res.data;
      setResults(results.slice(0, -1));
      setCumPnL(data.cum_pnl || { gh: 0, user_a: 0, user_z: 0, user_s: 0, allp: 0, allb: 0, fail: 0, hnh: 0, one: 0, two: 0, labouchere: 0 });
      setGlobalhitData(data.globalhit || []);
      setTopGhSections(data.top_gh_sections || []); setTopNextRound(data.top_next_round ?? null); setPickChangePick(data.pick_change_pick ?? null); setLscMatches(data.lsc_matches || []); setLscPick(data.lsc_pick ?? null); setRoundLscList(data.round_lsc_picks || []); setTwoPick(data.two_pick ?? null); setRoundTwoList(data.round_two_picks || []); setPicksSnapshot(data.picks_snapshot || null); setRoundState(data.round_state || null); setDecalPick(data.decal_pick ?? null); setShadowPick(data.shadow_pick ?? null); setDecalAxis(data.decal_axis ?? null); setShadowAxis(data.shadow_axis ?? null); setRoundDsList(data.round_decal_shadow || []);
      setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
      setUserSummary(data.user_summary || null);
      setUserMartinDashboard(data.user_martin_dashboard || null);      if (data.status === "ending" && data.ending_snapshot) {
        setEndingMode(true); setEndingSnapshot(data.ending_snapshot);
      } else {
        setEndingMode(false); setEndingSnapshot(null); setEndingDone(false);
      }
    } catch (err) {
      console.error("Failed to delete last round:", err);
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [gameId, results]);

  const handleNextGame = async () => {
    if (!gameId || results.length === 0) return;
    setProcessing(true);
    try {
      const res = await apiCaller.post(GH_GAMES_API.NEXT + "?game_id=" + gameId);
      setResults([]); setBetData(null); setUserSummary(null); setPicksSnapshot(null); setRoundState(null);
      setRoundDsList(res.data.round_decal_shadow || []);
      setGlobalhitData(res.data.globalhit || []);
      setTopGhSections(res.data.top_gh_sections || []); setTopNextRound(res.data.top_next_round ?? null); setPickChangePick(res.data.pick_change_pick ?? null);
      setGameId(res.data.game_id);
      setSearchParams({ gameId: res.data.game_id }, { replace: true });
      if (res.data.carry_pnl) {
        setCumPnL({ gh: res.data.carry_pnl.gh || 0, user_a: res.data.carry_pnl.user_a || 0, user_z: res.data.carry_pnl.user_z || 0, user_s: res.data.carry_pnl.user_s || 0, allp: res.data.carry_pnl.allp || 0, allb: res.data.carry_pnl.allb || 0, fail: res.data.carry_pnl.fail || 0, hnh: res.data.carry_pnl.hnh || 0, one: res.data.carry_pnl.one || 0, two: res.data.carry_pnl.two || 0, labouchere: res.data.carry_pnl.labouchere || 0 });
      } else {
        setCumPnL({ gh: 0, user_a: 0, user_z: 0, user_s: 0, allp: 0, allb: 0, fail: 0, hnh: 0, one: 0, two: 0, labouchere: 0 });
      }
      if (res.data.status === "ending" && res.data.ending_snapshot) {
        setEndingMode(true); setEndingSnapshot(res.data.ending_snapshot);
      } else {
        setEndingMode(false); setEndingSnapshot(null);
      }
    } catch (err) {
      console.error("Failed to next game:", err);
    } finally {
      setProcessing(false);
    }
  };

  // ED: 종료 모드 진입
  const handleEndingMode = async () => {
    if (endingMode || !gameId) return;
    const snapshot = { gh: [] };
    if (globalhitData) {
      globalhitData.forEach((pat) => {
        pat.groups.forEach((g) => {
          if (g.step > 1) snapshot.gh.push(`${pat.pattern}-${g.group + 1}`);
        });
      });
    }

    if (snapshot.gh.length === 0) {
      try {
        await apiCaller.post(GH_GAMES_API.ENDING, { game_id: gameId, snapshot });
      } catch {}
      setEndingMode(true); setEndingSnapshot(snapshot); setEndingDone(true);
      return;
    }

    try {
      const res = await apiCaller.post(GH_GAMES_API.ENDING, { game_id: gameId, snapshot });
      const data = res.data;
      setGlobalhitData(data.globalhit || []);
      setTopGhSections(data.top_gh_sections || []); setTopNextRound(data.top_next_round ?? null); setPickChangePick(data.pick_change_pick ?? null); setLscMatches(data.lsc_matches || []); setLscPick(data.lsc_pick ?? null); setRoundLscList(data.round_lsc_picks || []); setTwoPick(data.two_pick ?? null); setRoundTwoList(data.round_two_picks || []); setPicksSnapshot(data.picks_snapshot || null); setRoundState(data.round_state || null); setDecalPick(data.decal_pick ?? null); setShadowPick(data.shadow_pick ?? null); setDecalAxis(data.decal_axis ?? null); setShadowAxis(data.shadow_axis ?? null); setRoundDsList(data.round_decal_shadow || []);
      setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
      setUserSummary(data.user_summary || null);
      setUserMartinDashboard(data.user_martin_dashboard || null);    } catch (err) {
      console.error("Failed to start ending:", err);
    }
    setEndingMode(true); setEndingSnapshot(snapshot);
  };

  const checkEndingComplete = (data) => {
    if (!endingSnapshot) return false;
    const ghTracked = endingSnapshot.gh || [];
    if (data.globalhit) {
      for (const key of ghTracked) {
        const [pat, grp] = key.split("-");
        const grpNum = parseInt(grp);
        for (const patData of data.globalhit) {
          if (patData.pattern === pat) {
            const g = patData.groups.find((x) => x.group === grpNum - 1);
            if (g && g.step > 1) return false;
          }
        }
      }
    }
    return true;
  };

  const handleFinishGame = async () => {
    if (gameId) {
      try {
        await apiCaller.post(GH_GAMES_API.END, null, { params: { game_id: gameId } });
      } catch {}
    }
    setEndingMode(false); setEndingSnapshot(null); setEndingDone(false);
    setResults([]); setCumPnL({ gh: 0, user_a: 0, user_z: 0, user_s: 0, allp: 0, allb: 0, fail: 0, hnh: 0, one: 0, two: 0, labouchere: 0 }); setBetData(null); setUserSummary(null); setUserMartinDashboard(null);
    setGlobalhitData([]);
    setTopGhSections([]); setTopNextRound(null); setPickChangePick(null);
    setPicksSnapshot(null); setRoundState(null);
    setSearchParams({}, { replace: true });
    startGame();
  };

  // new game: carry-over 없이 새 게임 시작
  const handleNewGameConfirm = async () => {
    setShowNewConfirm(false);
    setProcessing(true);
    try {
      if (gameId && results.length > 0) {
        try {
          await apiCaller.post(GH_GAMES_API.END, null, { params: { game_id: gameId } });
        } catch {}
      }
      setEndingMode(false); setEndingSnapshot(null); setEndingDone(false);
      setResults([]); setCumPnL({ gh: 0, user_a: 0, user_z: 0, user_s: 0, allp: 0, allb: 0, fail: 0, hnh: 0, one: 0, two: 0, labouchere: 0 }); setBetData(null); setUserSummary(null); setUserMartinDashboard(null);
      setGlobalhitData([]);
      setTopGhSections([]); setTopNextRound(null); setPickChangePick(null);
      await startGame();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Box sx={{ p: isMobile ? 0.5 : 2 }}>
      <Box sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
        <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>글로벌히트</span>
        {gameId && <span style={{ fontSize: 11, color: "#888" }}>#{gameId}</span>}
        {autoStatus.running && autoStatus.table_name && (
          <span style={{ fontSize: 11, color: "#66bb6a", fontWeight: "bold", marginLeft: 8 }}>
            {autoStatus.table_name}
          </span>
        )}
      </Box>
      {/* ===== 상단: 6x40 빅로드 격자 ===== */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_COLS}, ${isMobile ? 16 : 26}px)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, ${isMobile ? 16 : 26}px)`,
          gap: "1px", mb: 2, backgroundColor: "#616161",
          border: "1px solid #616161", width: "fit-content",
        }}
      >
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isMiddleRow = rowIndex === 3;
            const isLscMatch = cell && Array.isArray(lscMatches) && lscMatches.some(
              (m) => cell.idx >= m.start && cell.idx < m.end
            );
            const isAxis = cell && (
              (decalAxis && cell.idx >= decalAxis[0] && cell.idx < decalAxis[1]) ||
              (shadowAxis && cell.idx >= shadowAxis[0] && cell.idx < shadowAxis[1])
            );
            const triSize = isMobile ? 7 : 10;
            return (
              <Box
                key={`${rowIndex}-${colIndex}`}
                sx={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  backgroundColor: cell ? (CELL_BG[cell.status] || "background.default") : "background.default",
                  ...(isMiddleRow && { borderTop: "2px solid #87ceeb" }),
                  position: "relative",
                }}
              >
                {cell?.pickChanged && (
                  <Box sx={{
                    position: "absolute", top: 0, right: 0,
                    width: 0, height: 0,
                    borderTop: `${triSize}px solid ${PC_COLOR}`,
                    borderLeft: `${triSize}px solid transparent`,
                  }} />
                )}
                {isLscMatch && (
                  <Box sx={{
                    position: "absolute", top: 0, left: 0,
                    width: 0, height: 0,
                    borderTop: `${triSize}px solid ${LSC_COLOR}`,
                    borderRight: `${triSize}px solid transparent`,
                  }} />
                )}
                {isAxis && (
                  <Box sx={{
                    position: "absolute", bottom: 0, left: 0,
                    width: 0, height: 0,
                    borderBottom: `${triSize}px solid ${DS_COLOR}`,
                    borderRight: `${triSize}px solid transparent`,
                  }} />
                )}
                {cell && <Circle type={cell.type} filled={true} size={isMobile ? 12 : 22} label={cell.idx + 1} />}
              </Box>
            );
          })
        )}
      </Box>

      {/* ===== 새 레이아웃 (자리만, 정적 HTML — 기능 미연결) =====
           [ 1 ][ 2 ]
           [   3   ]
      */}
      {(() => {
        // 3번: S1/S2/S3 78셀 그리드 (39열 × 2행 = 78셀, 1~39 / 40~78)
        const COLS = 39;
        const buildRow = (start) => Array.from({ length: COLS }, (_, k) => start + k);
        const HIT_BG = "#01e676";   // 초록
        const MISS_BG = "#ffeb3b";  // 노랑
        const WAIT_BG = "#ffffff";  // 흰색 (현재 회차)
        const resBg = (r) => r === "hit" ? HIT_BG : r === "miss" ? MISS_BG : WAIT_BG;

        // s_tracks 데이터 (sc1/sc2/sc3) — S 로드 + 누적 그래프용 (260628 SQ→S 리네임)
        const sqTracks = picksSnapshot?.s_tracks?.tracks;
        const srTracks = picksSnapshot?.sr_tracks?.tracks;
        const ssrTracks = picksSnapshot?.ssr_tracks?.tracks;
        const ssroTracks = picksSnapshot?.ssro_tracks?.tracks;
        const sxTracks = picksSnapshot?.sx_tracks?.tracks;
        const forTracks = picksSnapshot?.for_tracks?.tracks;
        const quarterTracks = picksSnapshot?.quarter_tracks?.tracks;

        return (
          <>
          {/* 1|2 row */}
          <Box sx={{ display: "flex", flexDirection: "row", gap: 1, alignItems: "flex-start", mb: 2 }}>

          {/* ===== 1: 배팅부 (구 디자인 스타일에 맞춰 정적 자리만) ===== */}
          {(() => {
            // 구 디자인 토큰
            const tagSx = (bg) => ({ borderRadius: 1, px: 0.5, py: 0, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 44, height: 20 });
            const fieldSx = { border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1, px: 1, py: 0.2, minWidth: 102, height: 24, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 };
            const turnBoxSx = { width: 40, height: 40, border: "2px solid rgba(255,255,255,0.3)", borderRadius: 1, backgroundColor: "#333", display: "flex", alignItems: "center", justifyContent: "center" };
            const pbBtnSx = (bg) => ({
              width: 48, height: 48, borderRadius: 2, backgroundColor: bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 24, fontWeight: "bold",
              cursor: inputLocked ? "not-allowed" : "pointer",
              opacity: inputLocked ? 0.4 : 1, pointerEvents: inputLocked ? "none" : "auto",
              "&:hover": { opacity: inputLocked ? 0.4 : 0.85 },
              "&:active": { transform: "scale(0.95)" },
            });
            const ctrlBtnSx = (borderColor, fg) => ({ ...controlBtnSx, border: `2px solid ${borderColor}`, color: fg || "#fff", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 50 });
            const uniBtnSx = (borderColor, fg) => ({ ...controlBtnSx, border: `2px solid ${borderColor}`, color: fg || "#fff", display: "flex", alignItems: "center", justifyContent: "center", width: 50, height: 32, minWidth: 50, px: 0, py: 0 });

            return (
              <Box sx={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 1, px: 0, py: 0.5 }}>
                {/* 행1: 마틴A + (마틴Z 또는 크루즈) */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                  {/* 마틴A */}
                  {(() => {
                    const td = betData?.user_martin?.martin_a;
                    const amt = td?.amount || 0;
                    return (
                      <React.Fragment>
                        <Box sx={tagSx("#1565c0")}>
                          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>마틴A</Typography>
                        </Box>
                        <Box sx={{ ...fieldSx, minWidth: 55 }}>
                          <Typography variant="caption" sx={{ fontSize: 12, fontWeight: "bold", color: amt > 0 ? "#4caf50" : "#666" }}>
                            {amt > 0 ? amt.toLocaleString() : "0"}
                          </Typography>
                        </Box>
                      </React.Fragment>
                    );
                  })()}
                  {/* 라보쉐르 활성이면 크루즈/마틴Z 대신 라보쉐르 표시 */}
                  {betData?.user_martin?.labouchere?.enabled ? (() => {
                    const lb = betData.user_martin.labouchere;
                    const lbAmt = lb?.amount || 0;
                    const lbPaused = !!lb?.paused;
                    const lbSeq = Array.isArray(lb?.sequence) ? lb.sequence : [];
                    const refreshState = async () => {
                      const res = await apiCaller.get(GH_GAMES_API.STATE(gameId) + "?mode=user");
                      const data = res.data;
                      setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
                      if (data.cum_pnl) {
                        setCumPnL((prev) => ({ ...prev, ...data.cum_pnl }));
                      }
                    };
                    const handleResetClick = async () => {
                      if (!gameId) return;
                      if (!window.confirm("초기 시퀀스로 리셋합니까?")) return;
                      try {
                        await apiCaller.post(GH_GAMES_API.LABOUCHERE_RESET(gameId));
                        await refreshState();
                      } catch (err) {
                        console.error("Labouchere reset failed:", err);
                      }
                    };
                    const handlePauseToggle = async () => {
                      if (!gameId) return;
                      try {
                        await apiCaller.post(GH_GAMES_API.LABOUCHERE_PAUSE_TOGGLE(gameId));
                        await refreshState();
                      } catch (err) {
                        console.error("Labouchere pause toggle failed:", err);
                      }
                    };
                    const tagBg = lbPaused ? "#555" : "#8e24aa";
                    const amtColor = lbPaused ? "#666" : "#4caf50";
                    const hmBusy = labHmPressed !== null;
                    const hmDisabled = lbPaused || lbSeq.length === 0 || lbAmt <= 0 || processing || hmBusy;
                    const trigger = async (which, url) => {
                      console.log(`[LAB ${which}] click gameId=${gameId} disabled=${hmDisabled} amt=${lbAmt} paused=${lbPaused} seqLen=${lbSeq.length} processing=${processing} busy=${hmBusy}`);
                      if (!gameId || hmDisabled) return;
                      setLabHmPressed(which);
                      try {
                        const res = await apiCaller.post(url);
                        console.log(`[LAB ${which}] response`, res.data);
                        await refreshState();
                      } catch (err) {
                        console.error(`Labouchere ${which} failed:`, err);
                      } finally {
                        setTimeout(() => setLabHmPressed(null), 500);
                      }
                    };
                    const handleHit = () => trigger("H", GH_GAMES_API.LABOUCHERE_HIT(gameId));
                    const handleMiss = () => trigger("M", GH_GAMES_API.LABOUCHERE_MISS(gameId));
                    const hmBtnSx = (bg, which) => {
                      const pressed = labHmPressed === which;
                      return {
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        minWidth: 26, height: 24, borderRadius: 1,
                        backgroundColor: pressed ? "#ffeb3b" : bg,
                        color: pressed ? "#1b1b1b" : "#fff",
                        boxShadow: pressed ? "0 0 8px #ffeb3b, 0 0 16px rgba(255,235,59,0.6)" : "none",
                        transform: pressed ? "scale(0.95)" : "none",
                        transition: "background-color 0.15s, box-shadow 0.15s, transform 0.15s, color 0.15s",
                        fontSize: 12, fontWeight: "bold",
                        cursor: hmDisabled ? "not-allowed" : "pointer",
                        opacity: hmDisabled && !pressed ? 0.4 : 1,
                        pointerEvents: hmDisabled ? "none" : "auto",
                        "&:hover": { opacity: hmDisabled ? 0.4 : 0.85 },
                      };
                    };
                    return (
                      <React.Fragment>
                        <Box sx={{ ...tagSx(tagBg), cursor: "pointer" }} onClick={handlePauseToggle} title={lbPaused ? "다시 활성화" : "라보쉐르 일시정지"}>
                          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>라보</Typography>
                        </Box>
                        <Box sx={{ ...fieldSx, cursor: "pointer", opacity: lbPaused ? 0.5 : 1, minWidth: 55 }} onClick={handleResetClick} title="클릭하여 초기 시퀀스로 리셋">
                          <Typography variant="caption" sx={{ fontSize: 12, fontWeight: "bold", color: amtColor }}>
                            {lbAmt.toLocaleString()}
                          </Typography>
                        </Box>
                        <Box sx={hmBtnSx("#2e7d32", "H")} onClick={handleHit} title="라보 H: 양끝 제거, PnL +베팅액">H</Box>
                        <Box sx={hmBtnSx("#c62828", "M")} onClick={handleMiss} title="라보 M: 끝 추가, PnL -베팅액">M</Box>
                        <Box
                          onClick={() => setLabSeqOpen(true)}
                          sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 33, height: 24, border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1, px: 0.6, py: 0.3, cursor: "pointer", "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" } }}
                          title="전체 시퀀스 보기"
                        >
                          <Typography variant="caption" sx={{ fontSize: 11, color: "#bbb" }}>≡{lbSeq.length}</Typography>
                        </Box>
                      </React.Fragment>
                    );
                  })() : betData?.user_martin?.cruise?.enabled ? (() => {
                    const cr = betData.user_martin.cruise;
                    const cStep = cr?.step || 1;
                    const cAmt = cr?.amount || 0;
                    const cPaused = !!cr?.paused;
                    const cruiseLabel = (idx) => {
                      if (idx === 0) return "1";
                      if (idx === 1) return "2";
                      if (idx % 2 === 0) return `${idx / 2 + 1}-2`;
                      return `${(idx + 1) / 2 + 1}`;
                    };
                    const refreshState = async () => {
                      const res = await apiCaller.get(GH_GAMES_API.STATE(gameId) + "?mode=user");
                      const data = res.data;
                      setBetData(data.bet ? { ...data.bet, user_martin: data.user_martin } : null);
                      if (data.cum_pnl) {
                        setCumPnL((prev) => ({ ...prev, ...data.cum_pnl }));
                      }
                    };
                    const handleResetClick = async () => {
                      if (!gameId) return;
                      if (!window.confirm("1단계로 돌아갑니까?")) return;
                      try {
                        await apiCaller.post(GH_GAMES_API.CRUISE_RESET(gameId));
                        await refreshState();
                      } catch (err) {
                        console.error("Cruise reset failed:", err);
                      }
                    };
                    const handlePauseToggle = async () => {
                      if (!gameId) return;
                      try {
                        await apiCaller.post(GH_GAMES_API.CRUISE_PAUSE_TOGGLE(gameId));
                        await refreshState();
                      } catch (err) {
                        console.error("Cruise pause toggle failed:", err);
                      }
                    };
                    const tagBg = cPaused ? "#555" : "#0097a7";
                    const amtColor = cPaused ? "#666" : "#4caf50";
                    return (
                      <React.Fragment>
                        <Box sx={{ ...tagSx(tagBg), cursor: "pointer" }} onClick={handlePauseToggle} title={cPaused ? "다시 활성화" : "단계 증가 일시정지"}>
                          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>크루즈</Typography>
                        </Box>
                        <Box sx={{ ...fieldSx, cursor: "pointer", opacity: cPaused ? 0.5 : 1 }} onClick={handleResetClick} title="클릭하여 1단계로 리셋">
                          <Typography variant="caption" sx={{ fontSize: 10, color: "#888" }}>{cruiseLabel(cStep - 1)}</Typography>
                          <Typography variant="caption" sx={{ fontSize: 12, fontWeight: "bold", color: amtColor }}>
                            {cAmt.toLocaleString()}
                          </Typography>
                        </Box>
                      </React.Fragment>
                    );
                  })() : (() => {
                    const td = betData?.user_martin?.martin_z;
                    const amt = td?.amount || 0;
                    const dir = td?.direction || "";
                    const step = td?.step || 1;
                    return (
                      <React.Fragment>
                        <Box sx={tagSx("#c62828")}>
                          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>마틴Z</Typography>
                        </Box>
                        <Box sx={fieldSx}>
                          <Typography variant="caption" sx={{ fontSize: 10, color: "#888" }}>{step}S</Typography>
                          <Typography variant="caption" sx={{ fontSize: 12, fontWeight: "bold", color: amt > 0 ? "#4caf50" : "#666" }}>
                            {amt > 0 ? `${amt.toLocaleString()}${dir}` : "0"}
                          </Typography>
                        </Box>
                      </React.Fragment>
                    );
                  })()}
                </Box>

                {/* 행2: 회차 + P + step+ + B + step+ + del */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={turnBoxSx}>
                    <Typography variant="body2" sx={{ fontWeight: "bold", fontSize: 16 }}>{currentTurn}</Typography>
                  </Box>
                  {(() => {
                    const pCount = results.filter((r) => r.value === "P").length;
                    const bCount = results.filter((r) => r.value === "B").length;
                    const tot = pCount + bCount;
                    const pBlink = tot > 0 && pCount / tot >= 0.6;
                    const bBlink = tot > 0 && bCount / tot >= 0.6;
                    const blinkSx = { animation: "pbBlink 0.8s infinite", "@keyframes pbBlink": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.3 } } };
                    return (
                      <>
                        <Box sx={pbBtnSx("#1565c0")} onClick={() => handleInput("P")}>P</Box>
                        <Box sx={{ ...turnBoxSx, width: 38, height: 38, ...(pBlink ? blinkSx : {}) }}>
                          <Typography variant="body2" sx={{ fontWeight: "bold", fontSize: 14 }}>{pCount}</Typography>
                        </Box>
                        <Box sx={pbBtnSx("#f44336")} onClick={() => handleInput("B")}>B</Box>
                        <Box sx={{ ...turnBoxSx, width: 38, height: 38, ...(bBlink ? blinkSx : {}) }}>
                          <Typography variant="body2" sx={{ fontWeight: "bold", fontSize: 14 }}>{bCount}</Typography>
                        </Box>
                      </>
                    );
                  })()}
                  {(() => {
                    const enabled = results.length > 0 && !processing;
                    return (
                      <Box
                        onClick={enabled ? handleDeleteOne : undefined}
                        sx={{ ...ctrlBtnSx("rgba(255,255,255,0.3)", "#666"), cursor: processing ? "not-allowed" : enabled ? "pointer" : "default", opacity: processing ? 0.4 : enabled ? 1 : 0.4, pointerEvents: processing ? "none" : "auto" }}
                      >
                        <Typography variant="caption" sx={{ fontSize: 13 }}>del</Typography>
                      </Box>
                    );
                  })()}
                </Box>

                {/* 행3: next + new + P 박스 + 1S 0 필드 */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {(() => {
                    const enabled = results.length > 0 && !processing;
                    return (
                      <Box
                        onClick={enabled ? () => setShowNextConfirm(true) : undefined}
                        sx={{ ...uniBtnSx("rgba(255,255,255,0.3)", "#666"), cursor: processing ? "not-allowed" : enabled ? "pointer" : "default", opacity: processing ? 0.4 : enabled ? 1 : 0.4, pointerEvents: processing ? "none" : "auto" }}
                      >
                        <Typography variant="caption" sx={{ fontSize: 12 }}>next</Typography>
                      </Box>
                    );
                  })()}
                  <Box
                    onClick={!processing ? () => setShowNewConfirm(true) : undefined}
                    sx={{ ...uniBtnSx("#2196f3"), cursor: processing ? "not-allowed" : "pointer", opacity: processing ? 0.4 : 1, pointerEvents: processing ? "none" : "auto" }}
                  >
                    <Typography variant="caption" sx={{ fontSize: 12, color: "#2196f3" }}>new</Typography>
	                  </Box>
	                  {(() => {
	                    const center = roundState?.round_amount_table?.total_side || "W";
	                    const centerColor = center === "P" ? "#1565c0" : center === "B" ? "#f44336" : "#fff";
	                    return (
	                      <Box sx={uniBtnSx("#67f431")}>
                        <Typography variant="body2" sx={{ fontWeight: "bold", fontSize: 16, color: centerColor }}>{center}</Typography>
                      </Box>
                    );
                  })()}
                  {(() => {
                    const mz = betData?.user_martin?.martin_z;
                    // raw_amount: 라보/크루즈 활성, 방향 없음 등과 무관한 단계별 원본 금액
                    const mzAmt = mz?.raw_amount ?? mz?.amount ?? 0;
                    const mzStep = mz?.step || 1;
                    return (
                      <Box sx={{ ...fieldSx, width: 128, minWidth: 128, height: 32, border: "2px solid #67f431" }}>
                        <Typography variant="caption" sx={{ fontSize: 10, color: "#888" }}>{mzStep}S</Typography>
                        <Typography variant="caption" sx={{ fontSize: 12, fontWeight: "bold", color: mzAmt > 0 ? "#4caf50" : "#666" }}>
                          {mzAmt > 0 ? mzAmt.toLocaleString() : "0"}
                        </Typography>
                      </Box>
                    );
                  })()}
                </Box>

                {/* 행4: 셋업 + 픽체인지 + auto + HitPoint */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box
                    onClick={() => navigate(`/ghgame/user-setup${gameId ? `?gameId=${gameId}` : ""}`)}
                    sx={{ ...uniBtnSx("#ff9800"), cursor: "pointer" }}
                  >
                    <Typography variant="caption" sx={{ fontSize: 12, color: "#ff9800", fontWeight: "bold" }}>셋업</Typography>
                  </Box>
                  <Box
                    onClick={() => navigate(`/ghgame/pick-change${gameId ? `?gameId=${gameId}` : ""}`)}
                    sx={{ ...uniBtnSx("#ab47bc"), cursor: "pointer" }}
                  >
                    <Typography variant="caption" sx={{ fontSize: 12, color: "#ab47bc", fontWeight: "bold" }}>픽체인지</Typography>
                  </Box>
                  {autoFeatureAvailable && (
                    <Box
                      onClick={handleAutoToggle}
                      sx={{
                        ...uniBtnSx(autoStatus.running ? "#66bb6a" : "#cc3499"),
                        cursor: "pointer",
                        backgroundColor: autoStatus.running ? "#2e7d32" : undefined,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ fontSize: 12, color: autoStatus.running ? "#fff" : "#cc3499", fontWeight: "bold" }}
                      >
                        {autoStatus.running ? "auto●" : "auto"}
                      </Typography>
                    </Box>
                  )}
                  {autoFeatureAvailable ? (() => {
                    const phaseAbbr = {
                      monitoring: "MON",
                      betting: "BET",
                      clearing: "CLR",
                      completed: "DONE",
                      error: "ERR",
                      stopped: "STOP",
                    };
                    const abbr = phaseAbbr[autoStatus.phase] || "—";
                    const pa = autoStatus.pnl_actual ?? 0;
                    return (
                      <Box sx={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0.5,
                        width: 128, minWidth: 128, px: 1, height: 32, borderRadius: 1,
                        border: autoStatus.running ? "2px solid #66bb6a" : "2px solid #7f7f7f",
                        backgroundColor: autoStatus.running ? "rgba(102,187,106,0.1)" : "transparent",
                        opacity: autoStatus.running ? 1 : 0.75,
                        whiteSpace: "nowrap", overflow: "hidden",
                      }}>
                        <Typography variant="caption" sx={{ fontSize: 11, color: autoStatus.running ? "#66bb6a" : "#888", fontWeight: "bold" }}>
                          {abbr}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: 11,
                            color: pa > 0 ? "#66bb6a" : pa < 0 ? "#ef5350" : "#ccc",
                            fontWeight: "bold",
                          }}
                        >
                          {pa.toLocaleString()}
                          {autoStatus.goal_amount ? `/${Number(autoStatus.goal_amount).toLocaleString()}` : ""}
                        </Typography>
                      </Box>
                    );
                  })() : (
                    <Box sx={{ ...fieldSx, width: 128, minWidth: 128, justifyContent: "flex-start", height: 32, border: "2px solid #7f7f7f", whiteSpace: "nowrap", overflow: "hidden" }}>
                      <Typography variant="caption" sx={{ fontSize: 11, color: "#fff", whiteSpace: "nowrap" }}>HP:&nbsp;&nbsp;220000 P</Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })()}

          <RoundAmountTable roundState={roundState} />

          </Box>
          {/* /1|2 row */}

          {/* ===== 전략별 현황 전광판 (배팅 판 ↔ S1/S2/S3 사이) ===== */}
          <GhStrategyBoard
            roundState={roundState}
          />

          {/* ===== 빅로드2 ===== */}
          <GhBigRoad2
            roundState={roundState}
            subgameBasis={displaySnapshot?.subgame_basis}
            ncRefShoes={displaySnapshot?.nc_ref_shoes}
            ncRefShoeNo={displaySnapshot?.nc_ref_shoe_no}
            actualSeq={results.map((r) => r.value).join("")}
          />
          </>
        );
      })()}

      {/* ===== 빅로드2 누적 그래프 ===== */}
      {(() => {
        const N = results.length;
        const sqTracks = picksSnapshot?.s_tracks?.tracks;
        const srTracks = picksSnapshot?.sr_tracks?.tracks;
        const ssrTracks = picksSnapshot?.ssr_tracks?.tracks;
        const ssroTracks = picksSnapshot?.ssro_tracks?.tracks;
        const sxTracks = picksSnapshot?.sx_tracks?.tracks;
        const forTracks = picksSnapshot?.for_tracks?.tracks;
        const quarterTracks = picksSnapshot?.quarter_tracks?.tracks;
        const palette = ["#f44336", "#2196f3", "#ffffff", "#00e676", "#ff9800", "#e040fb", "#26c6da", "#ffeb3b", "#9ccc65", "#ef5350", "#5c6bc0", "#8d6e63"];
        const seriesFromRows = (rows = []) => {
          const arr = new Array(N).fill(null);
          for (const r of rows || []) {
            const idx = (r.round || 0) - 1;
            if (idx < 0 || idx >= N) continue;
            if (r.status === "hit" || r.status === "miss") arr[idx] = r.status;
          }
          return arr;
        };
        const statSeries = (key) => picksSnapshot?.stats?.[key]?.series || [];
        const assistSeries = (key) => picksSnapshot?.assist_stats?.[key]?.series || [];
        const qAssistSeries = (key) => {
          const qas = picksSnapshot?.q_assist_stats?.[key];
          return qas?.round_data ? seriesFromRows(qas.round_data) : (qas?.series || []);
        };
        const trackSeries = (container, sc, quarter = false) => {
          const track = container?.tracks?.[sc] || container?.[sc];
          return seriesFromRows(quarter ? track?.bigroad_data : track?.round_data);
        };
        const add = (list, key, label, type = "stat") => {
          let series;
          if (type === "assist") series = assistSeries(key);
          else if (type === "qassist") series = qAssistSeries(key);
          else series = statSeries(key);
          if (series?.some((v) => v === "hit" || v === "miss")) list.push({ label, series });
        };
        const addTrack = (list, container, sc, label, quarter = false) => {
          const series = trackSeries(container, sc, quarter);
          if (series?.some((v) => v === "hit" || v === "miss")) list.push({ label, series });
        };
        const addAllModes = (list, key, label) => {
          add(list, key, label);
          add(list, key, `${label} A`, "assist");
          add(list, key, `${label} Q`, "qassist");
        };
        const addTrackAllModes = (list, container, sc, assistKey, label, quarter = false) => {
          addTrack(list, container, sc, label, quarter);
          if (!quarter) add(list, assistKey, `${label} A`, "assist");
          add(list, assistKey, `${label} Q`, "qassist");
        };
        const buildGroups = () => {
          const groups = {};
          groups.A = [];
          ["A", "AR", "AARO", "AAR"].forEach((key) => addAllModes(groups.A, key, key));
          [["S1", "sc1"], ["S2", "sc2"], ["S3", "sc3"]].forEach(([gid, sc], idx) => {
            const n = idx + 1;
            groups[gid] = [];
            addTrackAllModes(groups[gid], sqTracks, sc, `S${n}`, `S${n}`);
            addTrackAllModes(groups[gid], srTracks, sc, `SR${n}`, `S${n}R`);
            addTrackAllModes(groups[gid], ssroTracks, sc, `SSRO${n}`, `SSRO${n}`);
            addTrackAllModes(groups[gid], ssrTracks, sc, `SSR${n}`, `SSRN${n}`);
          });
          groups.FOR = [];
          [["sc1", "FOR1"], ["sc2", "FOR2"], ["sc3", "FOR3"]].forEach(([sc, key]) => addTrackAllModes(groups.FOR, forTracks, sc, key, key));
          groups.FORX = [];
          [["sc1", "FOR1X"], ["sc2", "FOR2X"], ["sc3", "FOR3X"]].forEach(([sc, key]) => addTrackAllModes(groups.FORX, sxTracks, sc, key, key));
          groups.DGT = [];
          ["D", "G", "TN", "ONE", "TWO"].forEach((key) => addAllModes(groups.DGT, key, key));
          groups.PBJ = [];
          ["P", "B", "J"].forEach((key) => addAllModes(groups.PBJ, key, key));
          groups.G = [];
          ["G(H1)", "G(H0)", "G(%1)", "G(%0)"].forEach((key) => addAllModes(groups.G, key, key));
          groups.HB = [];
          ["허니비", "허니R", "허니SRO", "허니SRN"].forEach((key) => addAllModes(groups.HB, key, key));
          groups.WH = [];
          ["W111", "위너R", "위너SRO", "위너SRN"].forEach((key) => addAllModes(groups.WH, key, key));
          groups.MH = [];
          ["M22", "메가R", "메가SRO", "메가SRN"].forEach((key) => addAllModes(groups.MH, key, key));
          groups.DH = [];
          ["D112", "드림R", "드림SRO", "드림SRN"].forEach((key) => addAllModes(groups.DH, key, key));
          groups.NC = [];
          ["NC", "NCR", "NCSRO", "NCSRN"].forEach((key) => addAllModes(groups.NC, key, key));
          groups.SQ = [];
          [["sc1", "SQ1"], ["sc2", "SQ2"], ["sc3", "SQ3"]].forEach(([sc, key]) => addTrackAllModes(groups.SQ, quarterTracks, sc, key, key, true));
          return Object.fromEntries(Object.entries(groups).filter(([, rows]) => rows.length > 0));
        };
        const CHART_GROUPS = buildGroups();
        const selectedGroup = CHART_GROUPS[chartGroup] ? chartGroup : Object.keys(CHART_GROUPS)[0];
        const cumulative = (series) => {
          let sum = 0;
          return (series || []).map((s) => {
            if (s === "hit") sum += 1;
            else if (s === "miss") sum -= 1;
            return sum;
          });
        };
        const lines = (CHART_GROUPS[selectedGroup] || []).map((row, idx) => ({
          key: row.label,
          color: palette[idx % palette.length],
          data: cumulative(row.series),
        }));
        const maxRound = Math.max(78, N || 0);
        const W = Math.max(1080, maxRound * 16);
        const H = 260, padL = 28, padR = 12, padT = 12, padB = 24;
        const innerW = W - padL - padR;
        const innerH = H - padT - padB;
        const allVals = lines.flatMap((l) => l.data).filter((v) => v !== null && v !== undefined);
        const minY = Math.min(0, ...(allVals.length ? allVals : [0]));
        const maxY = Math.max(0, ...(allVals.length ? allVals : [0]));
        const yRange = Math.max(1, maxY - minY);
        const xOf = (i) => padL + (i / Math.max(1, maxRound - 1)) * innerW;
        const yOf = (v) => padT + (1 - (v - minY) / yRange) * innerH;
        return (
          <Box sx={{ mb: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              {Object.keys(CHART_GROUPS).map((g) => (
                <Box
                  key={g}
                  onClick={() => setChartGroup(g)}
                  sx={{
                    px: 1.2, py: 0.3, border: "1px solid #555", borderRadius: 0.5,
                    cursor: "pointer", fontSize: 11, fontWeight: "bold",
                    backgroundColor: selectedGroup === g ? "#00e676" : "#1a1a2e",
                    color: selectedGroup === g ? "#000" : "#90caf9",
                    userSelect: "none",
                  }}
                >{g}</Box>
              ))}
            </Box>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              {lines.map((l) => (
                <Box key={`legend-${l.key}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.35, fontSize: 10, color: "#ddd" }}>
                  <Box sx={{ width: 14, height: 2, backgroundColor: l.color }} />
                  {l.key}
                </Box>
              ))}
            </Box>
            <Box sx={{ overflowX: "auto", border: "1px solid #222", backgroundColor: "#0a0c10" }}>
              <svg width={W} height={H} style={{ display: "block" }}>
                {Array.from({ length: maxRound }, (_, i) => i + 1).map((n) => (
                  <text key={`xl-${n}`} x={xOf(n - 1)} y={H - 7} fontSize={8} fill="#666" textAnchor="middle">{n}</text>
                ))}
                <line x1={padL} y1={yOf(0)} x2={W - padR} y2={yOf(0)} stroke="#777" strokeDasharray="2 2" strokeWidth={1} />
                {lines.map((l) => {
                  const points = l.data
                    .map((v, i) => (v !== null && v !== undefined) ? `${xOf(i)},${yOf(v)}` : null)
                    .filter(Boolean)
                    .join(" ");
                  return points ? <polyline key={`line-${l.key}`} points={points} fill="none" stroke={l.color} strokeWidth={1.7} /> : null;
                })}
              </svg>
            </Box>
          </Box>
        );
      })()}

      {/* 종료 다이얼로그 */}
      <Dialog open={endingDone} onClose={() => {}}>
        <DialogTitle sx={{ fontWeight: "bold" }}>게임 종료</DialogTitle>
        <DialogContent>
          <Typography>모든 배팅이 완료되었습니다.</Typography>
          <Box sx={{ mt: 2 }}>
            {[
              { name: "마틴A", pnl: cumPnL.user_a },
              { name: "마틴Z", pnl: cumPnL.user_z },
              { name: "AllP", pnl: cumPnL.allp },
              { name: "AllB", pnl: cumPnL.allb },
              { name: "fail", pnl: cumPnL.fail },
              { name: "HnH", pnl: cumPnL.hnh },
              { name: isMobile ? "1-2" : "one-two", pnl: (cumPnL.one || 0) + (cumPnL.two || 0) },
              { name: "마틴S", pnl: cumPnL.user_s || 0 },
            ].map((item) => (
              <Typography key={item.name} sx={{ color: item.pnl >= 0 ? "#4caf50" : "#f44336" }}>
                {item.name}: {item.pnl > 0 ? "+" : ""}{item.pnl.toLocaleString()}P
              </Typography>
            ))}
            {(() => { const t = cumPnL.user_a + cumPnL.user_z + (cumPnL.user_s || 0) + cumPnL.allp + cumPnL.allb + cumPnL.fail + cumPnL.hnh + cumPnL.one + cumPnL.two; return (
              <Typography sx={{ mt: 1, fontWeight: "bold", color: t >= 0 ? "#4caf50" : "#f44336" }}>
                Total: {t > 0 ? "+" : ""}{t.toLocaleString()}P
              </Typography>
            ); })()}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFinishGame} variant="contained">새 게임 시작</Button>
        </DialogActions>
      </Dialog>

      {/* 새 게임 확인 대화상자 */}
      {/* 이전 게임 복원 확인 */}
      <Dialog open={!!resumeGame} onClose={async () => { const gid = resumeGame?.game_id; setResumeGame(null); if (gid) { try { await apiCaller.post(GH_GAMES_API.END, null, { params: { game_id: gid } }); } catch {} } startGame(); }}>
        <DialogTitle sx={{ fontWeight: "bold" }}>이전 게임 복원</DialogTitle>
        <DialogContent>
          <Typography>진행 중인 게임이 있습니다. (#{resumeGame?.game_id}, {resumeGame?.round_count}회차)</Typography>
          <Typography>이어서 하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={async () => { const gid = resumeGame.game_id; setResumeGame(null); try { await apiCaller.post(GH_GAMES_API.END, null, { params: { game_id: gid } }); } catch {} startGame(); }}>새 게임</Button>
          <Button onClick={() => { const gid = resumeGame.game_id; setResumeGame(null); restoreGame(gid); }} variant="contained">이어하기</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showNewConfirm} onClose={() => setShowNewConfirm(false)}>
        <DialogTitle sx={{ fontWeight: "bold" }}>새 게임</DialogTitle>
        <DialogContent>
          <Typography>carry-over 없이 새 게임을 시작합니다.</Typography>
          <Typography>계속하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewConfirm(false)}>취소</Button>
          <Button onClick={handleNewGameConfirm} variant="contained">확인</Button>
        </DialogActions>
      </Dialog>

      {/* 넥스트 게임 확인 */}
      <Dialog open={showNextConfirm} onClose={() => setShowNextConfirm(false)}>
        <DialogTitle>다음 게임</DialogTitle>
        <DialogContent>
          <Typography variant="body2">현재 게임을 종료하고 다음 게임으로 넘어가시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNextConfirm(false)}>취소</Button>
          <Button onClick={() => { setShowNextConfirm(false); handleNextGame(); }} color="primary" variant="contained">확인</Button>
        </DialogActions>
      </Dialog>

      {/* ===== 총금액 요약 5칸 (MA|MZ|AllP|fail|AllB) ===== */}
      {(() => {
        const sA = userSummary?.martin_a;
        const sZ = userSummary?.martin_z;
        const um = betData?.user_martin;
        const dash = userMartinDashboard;

        const pnlText = (v) => { const s = v > 0 ? "+" : ""; return `${s}${v.toLocaleString()}P`; };
        const pnlColor = (v) => v > 0 ? "#4caf50" : v < 0 ? "#f44336" : "#fff";

        // pick_change가 발동하면 마틴A 실제 베팅 방향은 pickChangePick으로 덮어써짐 (A 칩과 일치)
        const formalADir = pickChangePick || sA?.direction || "wait";
        const formalZDir = sZ?.direction || "wait";
        const formalAColor = formalADir === "P" ? "#1565c0" : formalADir === "B" ? "#f44336" : "#888";
        const formalZColor = formalZDir === "P" ? "#1565c0" : formalZDir === "B" ? "#f44336" : "#888";
        const martinPnlA = sA?.pnl || 0;
        const martinPnlZ = sZ?.pnl || 0;
        const martinActive = (sA?.bet_p || 0) + (sA?.bet_b || 0) > 0;
        const martinZActive = (sZ?.bet_p || 0) + (sZ?.bet_b || 0) > 0;

        const alwaysInfo = (key) => {
          const trackData = um?.[key];
          const dashData = dash?.[key];
          const dir = trackData?.direction || "wait";
          const amt = trackData?.amount || 0;
          const step = dashData?.step || dashData?.step_min || 1;
          const dirColor = dir === "P" ? "#1565c0" : dir === "B" ? "#f44336" : "#888";
          const mActive = amt > 0;
          const failExtra = key === "fail" && dashData ? `f${dashData.fail_count || 2}(${dashData.miss_streak || 0})` : "";
          return { dir, amt, step, dirColor, mActive, failExtra };
        };

        const allpInfo = alwaysInfo("allp");
        const failInfo = alwaysInfo("fail");
        const allbInfo = alwaysInfo("allb");
        const hnhInfo = alwaysInfo("hnh");
        const oneInfo = alwaysInfo("one");
        const twoInfo = alwaysInfo("two");

        if (isMobile) {
          const rowSx = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0.5, borderRadius: 1, px: 0.8, py: 0.3, whiteSpace: "nowrap" };
          const renderMartin = (label, fDir, fColor, martinPnl, mActive) => (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3, flex: 1 }}>
              <Box sx={{ ...rowSx, border: `1px solid ${mActive ? "rgba(255,255,255,0.3)" : "#333"}` }}>
                <Typography variant="caption" sx={{ fontSize: 9, color: "#888" }}>{label}</Typography>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: fColor }}>{fDir}</Typography>
              </Box>
              <Box sx={{ ...rowSx, backgroundColor: "#00bcd4" }}>
                <Typography variant="caption" sx={{ fontSize: 9, color: "#000" }}>합계</Typography>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: martinPnl < 0 ? "#f44336" : "#000" }}>{pnlText(martinPnl)}</Typography>
              </Box>
            </Box>
          );
          const renderAlways = (label, color, pnl, info) => (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3, flex: 1 }}>
              <Box sx={{ ...rowSx, border: `1px solid ${info.mActive ? "rgba(255,255,255,0.3)" : "#333"}` }}>
                <Typography variant="caption" sx={{ fontSize: 9, color: color, fontWeight: "bold" }}>{label}{info.failExtra ? ` ${info.failExtra}` : ""} <span style={{ color: "#888", fontWeight: "normal" }}>{info.step}S</span></Typography>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: info.dirColor }}>{info.dir}</Typography>
              </Box>
              <Box sx={{ ...rowSx, backgroundColor: color }}>
                <Typography variant="caption" sx={{ fontSize: 9, color: "#fff" }}>합계</Typography>
                <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: pnl < 0 ? "#ffcdd2" : "#fff" }}>{pnlText(pnl)}</Typography>
              </Box>
            </Box>
          );
          return (
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: "flex", gap: 0.5 }}>
                {renderMartin("마틴A", formalADir, formalAColor, martinPnlA, martinActive)}
                {renderMartin("마틴Z", formalZDir, formalZColor, martinPnlZ, martinZActive)}
                {renderAlways("AllP", "#6a1b9a", cumPnL.allp, allpInfo)}
                {renderAlways("fail", "#e65100", cumPnL.fail, failInfo)}
              </Box>
              <Box sx={{ display: "flex", gap: 0.5, mt: 0.5 }}>
                {renderAlways("AllB", "#00695c", cumPnL.allb, allbInfo)}
                {renderAlways("HnH", "#558b2f", cumPnL.hnh, hnhInfo)}
                {renderAlways(isMobile ? "1-2" : "one-two", "#00838f", (cumPnL.one || 0) + (cumPnL.two || 0), oneInfo.mActive || twoInfo.mActive ? { ...oneInfo, ...(twoInfo.mActive ? twoInfo : {}), mActive: true } : oneInfo)}
                {renderMartin("마틴S", formalZDir, formalZColor, cumPnL.user_s || 0, (betData?.user_martin?.martin_s?.amount || 0) > 0)}
              </Box>
            </Box>
          );
        }

        const renderMartin = (label, fDir, fColor, martinPnl, mActive) => (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3, flex: 1 }}>
            <Box sx={{ border: `1px solid ${mActive ? "rgba(255,255,255,0.3)" : "#333"}`, borderRadius: 2, px: 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>{label}</Typography>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: fColor }}>{fDir}</Typography>
            </Box>
            <Box sx={{ backgroundColor: "#00bcd4", borderRadius: 2, px: 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: martinPnl < 0 ? "#f44336" : "#000" }}>{pnlText(martinPnl)}</Typography>
            </Box>
          </Box>
        );

        const renderAlways = (label, color, pnl, info) => (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3, flex: 1 }}>
            <Box sx={{ border: `1px solid ${info.mActive ? "rgba(255,255,255,0.3)" : "#333"}`, borderRadius: 2, px: 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: color }}>{label}{info.failExtra ? ` ${info.failExtra}` : ""} <span style={{ color: "#888", fontWeight: "normal" }}>{info.step}S</span></Typography>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: info.dirColor }}>{info.dir}</Typography>
            </Box>
            <Box sx={{ backgroundColor: color, borderRadius: 2, px: 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: pnl < 0 ? "#ffcdd2" : "#fff" }}>{pnlText(pnl)}</Typography>
            </Box>
          </Box>
        );

        return (
          <Box sx={{ mb: 1 }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              {renderMartin("마틴A", formalADir, formalAColor, martinPnlA, martinActive)}
              {renderMartin("마틴Z", formalZDir, formalZColor, martinPnlZ, martinZActive)}
              {renderAlways("AllP", "#6a1b9a", cumPnL.allp, allpInfo)}
              {renderAlways("fail", "#e65100", cumPnL.fail, failInfo)}
            </Box>
            <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
              {renderAlways("AllB", "#00695c", cumPnL.allb, allbInfo)}
              {renderAlways("HnH", "#558b2f", cumPnL.hnh, hnhInfo)}
              {renderAlways("one-two", "#00838f", (cumPnL.one || 0) + (cumPnL.two || 0), oneInfo.mActive || twoInfo.mActive ? { ...oneInfo, ...(twoInfo.mActive ? twoInfo : {}), mActive: true } : oneInfo)}
              {renderMartin("마틴S", formalZDir, formalZColor, cumPnL.user_s || 0, (betData?.user_martin?.martin_s?.amount || 0) > 0)}
            </Box>
          </Box>
        );
      })()}

      {/* ===== 어드민 전용: 대시보드 + 글로벌히트 상세 ===== */}
      {isAdmin && (() => {
        const gh = betData?.globalhit;
        const combined = betData?.combined;
        const combinedDir = combined?.direction || "wait";
        const dirColor = combinedDir === "P" ? "#1565c0" : combinedDir === "B" ? "#f44336" : "#888";
        const dc = { border: "1px solid #555", padding: isMobile ? "2px 4px" : "3px 12px", fontSize: isMobile ? 8 : 10, textAlign: "center", whiteSpace: "nowrap" };
        const dcB = { ...dc, fontWeight: "bold" };
        const ghPatterns = ["PPP", "BBB", "PBP", "BPB", "PPB", "BBP", "PBB", "BPP"];
        const getPatSec = (pat, sec) => {
          const d = gh?.details?.find((x) => x.pattern === pat && x.group === sec + 1);
          return d ? d.amount : 0;
        };
        const ghHasBet = (gh?.P || 0) + (gh?.B || 0) > 0;

        return (
          <>
            {/* 상단 요약 바 — 마틴A / 마틴Z 분리 */}
            {!isMobile && (() => {
              const umA = betData?.user_martin?.martin_a;
              const umZ = betData?.user_martin?.martin_z;
              const aDirRaw = umA?.direction || "wait";
              const zDirRaw = umZ?.direction || "wait";
              const fADir = aDirRaw;
              const fAColor = fADir === "P" ? "#1565c0" : fADir === "B" ? "#f44336" : "#888";
              const fZDir = zDirRaw;
              const fZColor = fZDir === "P" ? "#1565c0" : fZDir === "B" ? "#f44336" : "#888";
              const pnlText = (v) => `${v > 0 ? "+" : ""}${v.toLocaleString()}P`;
              const pnlClr = (v) => v > 0 ? "#4caf50" : v < 0 ? "#f44336" : "#fff";
              const umAHasBet = (umA?.amount || 0) > 0;
              const umZHasBet = (umZ?.amount || 0) > 0;
              const barSx = { border: "1px solid rgba(255,255,255,0.3)", borderRadius: 2, px: 2, py: 0.3, display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1 };
              const totalPnl = (cumPnL.user_a || 0) + (cumPnL.user_z || 0) + (cumPnL.user_s || 0) + (cumPnL.allp || 0) + (cumPnL.allb || 0) + (cumPnL.fail || 0) + (cumPnL.hnh || 0) + (cumPnL.one || 0) + (cumPnL.two || 0);
              return (
                <Box sx={{ display: "flex", gap: 0.5, mb: 0.5 }}>
                  <Box sx={{ ...barSx, minWidth: 0, justifyContent: "center" }}>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: fAColor }}>{`formal(${fADir})`}</Typography>
                  </Box>
                  <Box sx={{ ...barSx }}>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>합계</Typography>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: pnlClr(totalPnl) }}>{pnlText(totalPnl)}</Typography>
                  </Box>
                </Box>
              );
            })()}

            {/* 배팅 상황판 — 마틴A / 마틴Z 각각 독립 테이블 (유저 마틴 대시보드 데이터) */}
            {(() => {
              const umA = betData?.user_martin?.martin_a;
              const umZ = betData?.user_martin?.martin_z;
              const dashA = userMartinDashboard?.martin_a;
              const dashZ = userMartinDashboard?.martin_z;
              const martinTable = (label, um, labelColor, dash, isUnified) => {
                // 마틴A는 pick_change 발동 시 실제 베팅 방향이 pickChangePick으로 덮어써짐 (A 칩과 일치). 마틴Z는 미적용.
                const isMartinA = label === "마틴A";
                const mDir = (isMartinA && pickChangePick) || um?.direction || "wait";
                const mAmt = um?.amount || 0;
                const mP = mDir === "P" ? mAmt : 0;
                const mB = mDir === "B" ? mAmt : 0;
                // 방향은 서버가 내려준 mDir 그대로 사용 (프론트 금액비교 제거)
                const fDir = mDir;
                const fColor = fDir === "P" ? "#1565c0" : fDir === "B" ? "#f44336" : "#888";
                const mHasBet = mAmt > 0;
                const mDimStyle = mHasBet ? {} : { filter: "grayscale(100%)", opacity: 0.7 };
                const amounts = dash?.amounts || [];
                const stepMin = dash?.step_min || 1;
                const stepMax = dash?.step_max || 20;
                const unifiedStep = isUnified ? (dash?.step || stepMin) : null;
                const patternSteps = !isUnified ? (dash?.steps || {}) : {};
                const getStepAmt = (pat, sec) => {
                  const key = `${pat}-${sec + 1}`;
                  const step = isUnified ? unifiedStep : (patternSteps[key] || stepMin);
                  const idx = step - 1;
                  const amt = (idx >= 0 && idx < amounts.length) ? amounts[idx] : 0;
                  const detail = betData?.globalhit?.details?.find((d) => d.pattern === pat && d.group === sec + 1);
                  const predict = detail?.direction || null;
                  return { step, amt, predict };
                };
                // 전체에서 가장 높은 단계 셀 찾기
                let maxStepKey = null;
                let maxStepVal = stepMin;
                if (!isUnified && ghPatterns) {
                  ghPatterns.forEach((pat) => {
                    [0, 1, 2].forEach((sec) => {
                      const { step } = getStepAmt(pat, sec);
                      if (step > maxStepVal) { maxStepVal = step; maxStepKey = `${pat}-${sec + 1}`; }
                    });
                  });
                }
                return (
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 0.5 }}>
                  <Box>
                  <table style={{ borderCollapse: "collapse", width: "fit-content", marginBottom: 4 }}>
                    <tbody>
                      <tr>
                        <td style={{ ...dcB, color: fColor }}>{`formal(${fDir})`}</td>
                        <td style={{ ...dcB, color: labelColor, ...mDimStyle }}>{label}</td>
                        <td style={{ ...dc, color: "#1565c0", ...mDimStyle }}>{`${mP.toLocaleString()}P`}</td>
                        <td style={{ ...dc, color: "#f44336", ...mDimStyle }}>{`${mB.toLocaleString()}P`}</td>
                        <td style={{ ...dcB, color: "#fff" }}>{currentTurn}</td>
                        {Array.from({ length: 8 }, (_, i) => <td key={i} style={{ ...dc }}></td>)}
                      </tr>
                      {dash && [[ghPatterns[0], ghPatterns[1]], [ghPatterns[2], ghPatterns[3]], [ghPatterns[4], ghPatterns[5]], [ghPatterns[6], ghPatterns[7]]].map((pair, ri) => (
                        <tr key={`gh-${ri}`}>
                          {pair.map((pat, pi) => (
                            <React.Fragment key={pat}>
                              {pi > 0 && <td style={{ ...dc, width: 8 }}></td>}
                              {[0, 1, 2].map((sec) => {
                                const { step, amt, predict } = getStepAmt(pat, sec);
                                const isActive = step > stepMin;
                                const isBetting = !!predict;
                                const dimStyle = isBetting ? {} : { filter: "grayscale(100%)", opacity: 0.5 };
                                const predictColor = predict === "P" ? "#1565c0" : predict === "B" ? "#f44336" : "#888";
                                return (
                                  <React.Fragment key={`${pat}-${sec}`}>
                                    <td style={{ ...dc, ...dimStyle }}>
                                      {pat.split("").map((c, ci) => (
                                        <span key={ci} style={{ color: c === "P" ? "#1565c0" : "#f44336", fontWeight: "bold" }}>{c}</span>
                                      ))}
                                      <span style={{ fontSize: 9 }}>({sec + 1}sc)</span>
                                    </td>
                                    <td style={{ ...dc, ...dimStyle, ...(isActive && isBetting && { color: "#ffeb3b", fontWeight: "bold" }) }}>
                                      {predict && <span style={{ color: predictColor, fontWeight: "bold", marginRight: 2 }}>{predict}</span>}
                                      {`${amt.toLocaleString()}P`}
                                      {isActive && <span style={{ fontSize: 8, marginLeft: 2 }}>{step}S</span>}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </Box>
                  </Box>
                );
              };
              /* ── 마틴Z 간소화: 단계 + 금액만 표시 ── */
              const martinZSimple = () => {
                if (!umZ && !dashZ) return null;
                const mDir = umZ?.direction || "wait";
                const mAmt = umZ?.amount || 0;
                const mP = mDir === "P" ? mAmt : 0;
                const mB = mDir === "B" ? mAmt : 0;
                // 방향은 서버가 내려준 mDir 그대로 사용 (프론트 금액비교 제거)
                const fDir = mDir;
                const fColor = fDir === "P" ? "#1565c0" : fDir === "B" ? "#f44336" : "#888";
                const mHasBet = mAmt > 0;
                const mDimStyle = mHasBet ? {} : { filter: "grayscale(100%)", opacity: 0.7 };
                const amounts = dashZ?.amounts || [];
                const stepMin = dashZ?.step_min || 1;
                const curStep = dashZ?.step || stepMin;
                const curAmt = (curStep >= 1 && curStep <= amounts.length) ? amounts[curStep - 1] : 0;
                return (
                  <Box sx={{ mb: 0.5 }}>
                    <table style={{ borderCollapse: "collapse", width: "fit-content" }}>
                      <tbody>
                        <tr>
                          <td style={{ ...dcB, color: fColor }}>{`formal(${fDir})`}</td>
                          <td style={{ ...dcB, color: "#c62828", ...mDimStyle }}>마틴Z</td>
                          <td style={{ ...dc, color: "#1565c0", ...mDimStyle }}>{`${mP.toLocaleString()}P`}</td>
                          <td style={{ ...dc, color: "#f44336", ...mDimStyle }}>{`${mB.toLocaleString()}P`}</td>
                          <td style={{ ...dcB, color: "#fff" }}>{currentTurn}</td>
                          <td style={{ ...dcB, color: "#ffeb3b" }}>{`${curStep}S`}</td>
                          <td style={{ ...dc, color: "#ffeb3b", fontWeight: "bold" }}>{`${curAmt.toLocaleString()}P`}</td>
                        </tr>
                      </tbody>
                    </table>
                  </Box>
                );
              };
              return (
                <>
                  {martinTable("마틴A", umA, "#1565c0", dashA, false)}
                  {martinZSimple()}
                </>
              );
            })()}


            {/* GlobalHit 패턴별 상세 — 마틴A / 마틴Z 독립 블록 */}
            {(() => {
              const cellSize = 20;
              const colsPerRow = 30;
              const totalCols = colsPerRow + 2;
              const GH_CELL_BG = { hit: "#00e676", wait: "#fff" };
              const tdStyleFn = (status) => ({
                width: cellSize, height: cellSize, border: "1px solid #555", padding: 0, textAlign: "center",
                backgroundColor: status ? (GH_CELL_BG[status] || "#333") : "#333",
              });

              const dashA = userMartinDashboard?.martin_a;
              const dashZ = userMartinDashboard?.martin_z;

              const getStepAmt = (pat, gi, dash, isUnified) => {
                if (dash) {
                  const key = `${pat}-${gi + 1}`;
                  const stepMin = dash.step_min || 1;
                  const step = isUnified ? (dash.step || stepMin) : (dash.steps?.[key] || stepMin);
                  const idx = step - 1;
                  const amounts = dash.amounts || [];
                  const amt = (idx >= 0 && idx < amounts.length) ? amounts[idx] : 0;
                  return { step, amt, stepMin };
                }
                // 유저 설정 없으면 0단계 — 단계 진행 안 함
                return { step: 0, amt: 0, stepMin: 0 };
              };

              const renderPatternBlock = (label, labelColor, dash, isUnified) => {
                // 전체에서 가장 높은 단계 셀 찾기 (동율 포함)
                const topKeys = new Set();
                let topStep = dash?.step_min || 1;
                if (!isUnified && dash?.steps) {
                  Object.entries(dash.steps).forEach(([k, v]) => {
                    if (v > topStep) { topStep = v; topKeys.clear(); topKeys.add(k); }
                    else if (v === topStep && v > (dash?.step_min || 1)) { topKeys.add(k); }
                  });
                }
                return (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  <Box sx={{ backgroundColor: labelColor, borderRadius: 1, px: 1, py: 0.3, width: "fit-content" }}>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold", color: "#fff" }}>{label}</Typography>
                  </Box>
                  {globalhitData.map((patData) => {
                    const pat = patData.pattern;
                    const circleStyle = (charIdx) => ({
                      width: cellSize - 2, height: cellSize - 2, borderRadius: "50%",
                      backgroundColor: pat[charIdx % pat.length] === "P" ? "#1565c0" : "#f44336",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 9, fontWeight: "bold",
                    });
                    const collapseKey = `${label}-${pat}`;
                    return (
                      <Box key={pat}>
                        <Box
                          onClick={() => setCollapsedPatterns((prev) => ({ ...prev, [collapseKey]: !prev[collapseKey] }))}
                          sx={{
                            display: "flex", alignItems: "center", gap: 0.5, mb: 0.3,
                            border: "1px solid rgba(255,255,255,0.2)", backgroundColor: "background.paper",
                            px: 0.5, py: 0.3, cursor: "pointer",
                            "&:hover": { backgroundColor: "rgba(255,255,255,0.05)" },
                          }}
                        >
                          <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 1, py: 0.2 }}>
                            <Typography variant="caption" sx={{ fontSize: 11, fontWeight: "bold" }}>
                              {pat.split("").map((c, ci) => (
                                <Typography key={ci} component="span" sx={{ color: c === "P" ? "#1565c0" : "#f44336", fontWeight: "bold", fontSize: 11 }}>{c}</Typography>
                              ))}
                              <Typography component="span" sx={{ fontSize: 10, color: "text.secondary" }}>(123)</Typography>
                            </Typography>
                          </Box>
                          <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 0.8, py: 0.2 }}>
                            <Typography variant="caption" sx={{ fontSize: 10 }}>{results.length}</Typography>
                          </Box>
                          {patData.groups.map((g, gi) => {
                            const { step, amt, stepMin } = getStepAmt(pat, gi, dash, isUnified);
                            const isActive = step > (stepMin || 1);
                            return (
                              <Box key={gi} sx={{ display: "flex", gap: 0.3, ml: gi > 0 ? 1 : 0 }}>
                                <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 0.6, py: 0.2 }}>
                                  <Typography variant="caption" sx={{ fontSize: 10, ...(topKeys.has(`${pat}-${gi + 1}`) && { color: "#ffeb3b", fontWeight: "bold", animation: "blink 1s infinite" }) }}>SC{gi + 1}</Typography>
                                </Box>
                                <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 0.6, py: 0.2 }}>
                                  <Typography variant="caption" sx={{ fontSize: 10, ...(isActive && { color: "#f44336", fontWeight: "bold" }) }}>{step}S</Typography>
                                </Box>
                                <Box sx={{ border: "1px solid rgba(255,255,255,0.3)", px: 0.8, py: 0.2 }}>
                                  <Typography variant="caption" sx={{ fontSize: 10, ...(isActive && { color: "#ffeb3b", fontWeight: "bold" }) }}>{amt.toLocaleString()}P</Typography>
                                </Box>
                              </Box>
                            );
                          })}
                          <Box sx={{ flexGrow: 1 }} />
                        </Box>
                        {collapsedPatterns[collapseKey] && (
                          <table style={{ borderCollapse: "collapse", borderSpacing: 0 }}>
                            <tbody>
                              {patData.groups.map((group, gi) => {
                                const row1 = group.row1;
                                const row2 = group.row2;
                                return [
                                  gi > 0 && <tr key={`${gi}-gap`}><td colSpan={totalCols} style={{ height: 4, padding: 0 }} /></tr>,
                                  <tr key={`${gi}-0`}>
                                    {Array.from({ length: totalCols }, (_, colIdx) => {
                                      const dataIdx = colIdx - gi;
                                      const hasData = dataIdx >= 0 && dataIdx < row1.length;
                                      const isEmpty = colIdx < gi;
                                      const item = hasData ? row1[dataIdx] : null;
                                      const roundNum = item?.round;
                                      const isGroupEnd = hasData && (roundNum - gi) % 3 === 0;
                                      const base = hasData ? tdStyleFn(item.status) : (isEmpty ? tdStyleFn(null) : { width: cellSize, height: cellSize, border: "none", padding: 0 });
                                      const style = { ...base, ...(hasData && isGroupEnd && { borderRight: "2px solid #aaa" }) };
                                      return <td key={colIdx} style={style}>{hasData && <div style={circleStyle(roundNum - 1)}>{roundNum}</div>}</td>;
                                    })}
                                  </tr>,
                                  <tr key={`${gi}-1`}>
                                    {Array.from({ length: totalCols }, (_, colIdx) => {
                                      const hasData = colIdx < row2.length;
                                      const item = hasData ? row2[colIdx] : null;
                                      const roundNum = item?.round;
                                      const isGroupEnd = hasData && (roundNum - gi) % 3 === 0;
                                      const base = hasData ? tdStyleFn(item.status) : { width: cellSize, height: cellSize, border: "none", padding: 0 };
                                      const style = { ...base, ...(hasData && isGroupEnd && { borderRight: "2px solid #aaa" }) };
                                      return <td key={colIdx} style={style}>{hasData && <div style={circleStyle(roundNum - 1)}>{roundNum}</div>}</td>;
                                    })}
                                  </tr>,
                                ];
                              })}
                            </tbody>
                          </table>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              );
              };

              return (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {renderPatternBlock("마틴A", "#1565c0", dashA, false)}
                </Box>
              );
            })()}
          </>
        );
      })()}

      <Dialog open={goalDialog.open} onClose={() => setGoalDialog({ open: false, msgs: [] })}>
        <DialogTitle sx={{ fontWeight: "bold" }}>목표금액 도달</DialogTitle>
        <DialogContent>
          <Typography>목표금액에 도달하여 배팅이 정지됩니다.</Typography>
          <Box sx={{ mt: 2 }}>
            {[
              { name: "마틴A", pnl: cumPnL.user_a },
              { name: "마틴Z", pnl: cumPnL.user_z },
              { name: "AllP", pnl: cumPnL.allp },
              { name: "AllB", pnl: cumPnL.allb },
              { name: "fail", pnl: cumPnL.fail },
              { name: "HnH", pnl: cumPnL.hnh },
              { name: isMobile ? "1-2" : "one-two", pnl: (cumPnL.one || 0) + (cumPnL.two || 0) },
              { name: "마틴S", pnl: cumPnL.user_s || 0 },
            ].map((item) => (
              <Typography key={item.name} sx={{ color: item.pnl >= 0 ? "#4caf50" : "#f44336" }}>
                {item.name}: {item.pnl > 0 ? "+" : ""}{item.pnl.toLocaleString()}P
              </Typography>
            ))}
            {(() => { const t = cumPnL.user_a + cumPnL.user_z + (cumPnL.user_s || 0) + cumPnL.allp + cumPnL.allb + cumPnL.fail + cumPnL.hnh + cumPnL.one + cumPnL.two; return (
              <Typography sx={{ mt: 1, fontWeight: "bold", color: t >= 0 ? "#4caf50" : "#f44336" }}>
                Total: {t > 0 ? "+" : ""}{t.toLocaleString()}P
              </Typography>
            ); })()}
          </Box>
          <Box sx={{ mt: 2 }}>
            {goalDialog.msgs.map((m) => (
              <Typography key={m} sx={{ fontSize: "0.85rem", color: "text.secondary" }}>
                * {m} 배팅 정지
              </Typography>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGoalDialog({ open: false, msgs: [] })} variant="contained">확인</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={labSeqOpen} onClose={() => setLabSeqOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: "bold" }}>라보쉐르 시퀀스</DialogTitle>
        <DialogContent>
          {(() => {
            const lb = betData?.user_martin?.labouchere;
            const seq = Array.isArray(lb?.sequence) ? lb.sequence : [];
            const sum = seq.reduce((a, b) => a + (b || 0), 0);
            const cumLab = cumPnL?.labouchere || 0;
            const bet = lb?.amount || 0;
            return (
              <Box>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1.5 }}>
                  <Typography sx={{ fontSize: 13 }}>남은 항목: <b>{seq.length}</b></Typography>
                  <Typography sx={{ fontSize: 13 }}>남은 합: <b>{sum.toLocaleString()}</b></Typography>
                  <Typography sx={{ fontSize: 13 }}>현재 베팅: <b>{bet.toLocaleString()}</b></Typography>
                  <Typography sx={{ fontSize: 13, color: cumLab >= 0 ? "#4caf50" : "#f44336" }}>
                    누적 PnL: {cumLab > 0 ? "+" : ""}{cumLab.toLocaleString()}P
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {seq.length === 0 ? (
                    <Typography sx={{ fontSize: 13, color: "#888" }}>시퀀스가 비어있습니다 (목표 달성).</Typography>
                  ) : seq.map((v, i) => (
                    <Box key={i} sx={{
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: 1, px: 0.8, py: 0.3, fontSize: 12,
                      backgroundColor: (i === 0 || i === seq.length - 1) ? "rgba(142,36,170,0.25)" : "transparent",
                      color: (i === 0 || i === seq.length - 1) ? "#ce93d8" : "#ccc",
                      fontWeight: (i === 0 || i === seq.length - 1) ? "bold" : "normal",
                    }}>
                      {v}
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLabSeqOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* Auto 베팅 시작 모달 — mvp-aboo-integration.md §5.1 */}
      <AutoStartDialog
        open={autoDialogOpen}
        onClose={() => setAutoDialogOpen(false)}
        onStarted={(resp) => setAutoStatus({ running: true, autoSessionId: resp.auto_session_id })}
        gameId={gameId}
        pickhandId={myPickhandId}
        gameType="gh"
      />

      {/* 베팅 거부 레이어 팝업 */}
      <Snackbar
        open={!!rejectMsg}
        autoHideDuration={5000}
        onClose={() => setRejectMsg(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="warning" variant="filled" onClose={() => setRejectMsg(null)}>
          {rejectMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
