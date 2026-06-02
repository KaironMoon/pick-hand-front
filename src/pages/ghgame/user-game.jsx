import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Typography, useMediaQuery, useTheme, Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress, Chip, Tooltip } from "@mui/material";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { userAtom } from "@/store/auth-store";
import apiCaller from "@/services/api-caller";
import autoService from "@/services/auto-service";
import AutoStartDialog from "../t9game/components/AutoStartDialog";
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
  const [picksSnapshot, setPicksSnapshot] = useState(null);
  const [batExpanded, setBatExpanded] = useState({}); // {`gi-ri`: true} — Bat 셀 전체 표시 토글
  const [trackStreakHidden, setTrackStreakHidden] = useState({}); // {sckey: true} — 트랙 연승/연패 셀 숨김 토글
  const [chipStreakHidden, setChipStreakHidden] = useState({}); // {chipLabel: true} — 칩 연승/연패 라벨 숨김 토글
  const [chartGroup, setChartGroup] = useState("S123"); // 누적 step 그래프 표시 그룹
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
  const [processing, setProcessing] = useState(false);
  const goalAlertedRef = useRef({ a: false, z: false });

  const [goalDialog, setGoalDialog] = useState({ open: false, msgs: [] });

  // Auto 모드 (pick-aboo 통합) — t9game/index.jsx에서 포팅
  const [autoFeatureAvailable, setAutoFeatureAvailable] = useState(true);
  const [autoDialogOpen, setAutoDialogOpen] = useState(false);
  const [autoStatus, setAutoStatus] = useState({ running: false, autoSessionId: null });
  const [myPragmaticId, setMyPragmaticId] = useState(null);

  const currentTurn = results.length + 1;
  const grid = calculateCircleGrid(results);

  // 마지막 hit/miss 라운드부터 거꾸로 같은 결과가 몇 번 연속되었는지 카운트.
  // pickAt(i): i번째 라운드의 픽 (없으면 null), seq[i]와 비교해 hit/miss 판정.
  const calcStreak = (pickAt) => {
    let last = null, count = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      const pick = pickAt(i);
      if (!pick) continue;
      const status = pick === results[i].value ? "hit" : "miss";
      if (last === null) { last = status; count = 1; }
      else if (status === last) { count++; }
      else break;
    }
    return last ? { type: last, count } : null;
  };
  const streakA = (() => {
    let last = null, count = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      const st = results[i].status;
      if (st !== "hit" && st !== "miss") continue;
      if (last === null) { last = st; count = 1; }
      else if (st === last) { count++; }
      else break;
    }
    return last ? { type: last, count } : null;
  })();
  const streakD = calcStreak((i) => roundDsList[i]?.decal_pick || null);
  const streakG = calcStreak((i) => roundDsList[i]?.shadow_pick || null);
  const streakTN = calcStreak((i) => roundLscList[i] || null);
  const streakTWO = calcStreak((i) => roundTwoList[i] || null);
  // ONE armed streak (picksSnapshot.round_picks.ONE 사용 — 백엔드 _calc_round_one_two_picks 결과)
  const streakONE = calcStreak((i) => picksSnapshot?.round_picks?.ONE?.[i] || null);

  // 백엔드 picks_snapshot에서 AR, J, ONE 픽 정보 가져오기 (프론트 로직 제거됨)
  const arPick = picksSnapshot?.next_picks?.AR || null;
  const jPick = picksSnapshot?.next_picks?.J || null;
  const onePick = picksSnapshot?.next_picks?.ONE || null;
  const roundArList = picksSnapshot?.round_picks?.AR || [];
  const roundJList = picksSnapshot?.round_picks?.J || [];
  const streakAR = calcStreak((i) => roundArList[i] || null);
  const streakJ = calcStreak((i) => roundJList[i] || null);

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
      startGame();
    } else if (urlGameId) {
      restoreGame(parseInt(urlGameId));
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
      const pcMarks = data.round_pick_change || [];
      const dsMarks = data.round_decal_shadow || [];
      setResults(seq.split("").map((v, i) => {
        const pick = picks[i];
        const status = pick ? (pick === v ? "hit" : "miss") : "wait";
        return { value: v, status, aPick: pick || null, pickChanged: !!pcMarks[i], decalShadow: !!(dsMarks[i]?.decal_pick || dsMarks[i]?.shadow_pick) };
      }));
      setGlobalhitData(data.globalhit || []);
      setTopGhSections(data.top_gh_sections || []); setTopNextRound(data.top_next_round ?? null); setPickChangePick(data.pick_change_pick ?? null); setLscMatches(data.lsc_matches || []); setLscPick(data.lsc_pick ?? null); setRoundLscList(data.round_lsc_picks || []); setTwoPick(data.two_pick ?? null); setRoundTwoList(data.round_two_picks || []); setPicksSnapshot(data.picks_snapshot || null); setDecalPick(data.decal_pick ?? null); setShadowPick(data.shadow_pick ?? null); setDecalAxis(data.decal_axis ?? null); setShadowAxis(data.shadow_axis ?? null); setRoundDsList(data.round_decal_shadow || []);
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
  // pragmatic_id: userAtom에서 직접. fallback으로 username 사용
  // (auth-store.js가 로그인 시 username을 pragmatic_id로 자동 등록한다는 가정)
  useEffect(() => {
    setMyPragmaticId(user?.pragmatic_id || user?.username || null);
  }, [user]);

  // Auto 상태 폴링 (1초)
  useEffect(() => {
    if (!gameId || !autoFeatureAvailable) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const st = await autoService.getAutoStatus(gameId);
        if (!cancelled) {
          setAutoStatus({
            running: !!st.running,
            autoSessionId: st.auto_session_id || null,
            lastEventAt: st.last_event_at,
            betsAttempted: st.bets_attempted,
            betsSucceeded: st.bets_succeeded,
            betsFailed: st.bets_failed,
          });
        }
      } catch (e) {
        if (e?.response?.status === 503) {
          setAutoFeatureAvailable(false);
        }
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [gameId, autoFeatureAvailable]);

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
      setAutoDialogOpen(true);
    }
  };

  const handleInput = async (inputValue) => {
    if (!gameId || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    let status = "wait";
    const normalPick = betData?.user_martin?.combined?.direction || betData?.combined?.direction;
    const effectivePick = pickChangePick || normalPick;
    if (effectivePick && effectivePick !== "wait") {
      status = effectivePick === inputValue ? "hit" : "miss";
    }
    setResults((prev) => [...prev, { value: inputValue, status, aPick: effectivePick && effectivePick !== "wait" ? effectivePick : null, pickChanged: !!pickChangePick, decalShadow: decalPick !== null || shadowPick !== null }]);
    setBetData(null);

    try {
      const res = await apiCaller.post(GH_GAMES_API.ROUND, { game_id: gameId, actual: inputValue });
      const data = res.data;
      if (data.round_num !== undefined && data.round_num !== results.length + 1) {
        alert("서버/클라이언트 불일치가 감지되어 페이지를 리로드합니다.");
        window.location.reload();
        return;
      }
      setCumPnL({ gh: data.cum_pnl.gh, user_a: data.cum_pnl.user_a || 0, user_z: data.cum_pnl.user_z || 0, user_s: data.cum_pnl.user_s || 0, allp: data.cum_pnl.allp || 0, allb: data.cum_pnl.allb || 0, fail: data.cum_pnl.fail || 0, hnh: data.cum_pnl.hnh || 0, one: data.cum_pnl.one || 0, two: data.cum_pnl.two || 0, labouchere: data.cum_pnl.labouchere || 0 });
      setGlobalhitData(data.globalhit || []);
      setTopGhSections(data.top_gh_sections || []); setTopNextRound(data.top_next_round ?? null); setPickChangePick(data.pick_change_pick ?? null); setLscMatches(data.lsc_matches || []); setLscPick(data.lsc_pick ?? null); setRoundLscList(data.round_lsc_picks || []); setTwoPick(data.two_pick ?? null); setRoundTwoList(data.round_two_picks || []); setPicksSnapshot(data.picks_snapshot || null); setDecalPick(data.decal_pick ?? null); setShadowPick(data.shadow_pick ?? null); setDecalAxis(data.decal_axis ?? null); setShadowAxis(data.shadow_axis ?? null); setRoundDsList(data.round_decal_shadow || []);
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
      setTopGhSections(data.top_gh_sections || []); setTopNextRound(data.top_next_round ?? null); setPickChangePick(data.pick_change_pick ?? null); setLscMatches(data.lsc_matches || []); setLscPick(data.lsc_pick ?? null); setRoundLscList(data.round_lsc_picks || []); setTwoPick(data.two_pick ?? null); setRoundTwoList(data.round_two_picks || []); setPicksSnapshot(data.picks_snapshot || null); setDecalPick(data.decal_pick ?? null); setShadowPick(data.shadow_pick ?? null); setDecalAxis(data.decal_axis ?? null); setShadowAxis(data.shadow_axis ?? null); setRoundDsList(data.round_decal_shadow || []);
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
      setResults([]); setBetData(null); setUserSummary(null);
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
      setTopGhSections(data.top_gh_sections || []); setTopNextRound(data.top_next_round ?? null); setPickChangePick(data.pick_change_pick ?? null); setLscMatches(data.lsc_matches || []); setLscPick(data.lsc_pick ?? null); setRoundLscList(data.round_lsc_picks || []); setTwoPick(data.two_pick ?? null); setRoundTwoList(data.round_two_picks || []); setPicksSnapshot(data.picks_snapshot || null); setDecalPick(data.decal_pick ?? null); setShadowPick(data.shadow_pick ?? null); setDecalAxis(data.decal_axis ?? null); setShadowAxis(data.shadow_axis ?? null); setRoundDsList(data.round_decal_shadow || []);
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
      <Box sx={{ mb: 1, display: "flex", alignItems: "baseline", gap: 1 }}>
        <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>글로벌히트</span>
        {gameId && <span style={{ fontSize: 11, color: "#888" }}>#{gameId}</span>}
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
        // 2번: 픽 카드
        const pickImg = (p) => p === "P" ? "/player.png" : p === "B" ? "/banker.png" : "/wait.png";
        const aPick = pickChangePick || betData?.user_martin?.martin_a?.direction || null;
        const PICK_LIST = [
          { label: "A",   img: pickImg(aPick),    color: aPick ? "#90caf9" : "#aaa", streak: streakA },
          { label: "AR",  img: pickImg(arPick),   color: arPick ? "#ce93d8" : "#aaa", streak: streakAR, badge: picksSnapshot?.modes?.AR === "reverse" ? "⇄" : null },
          { label: "D",   img: pickImg(decalPick), color: decalPick ? "#ce93d8" : "#aaa", streak: streakD },
          { label: "G",   img: pickImg(shadowPick), color: shadowPick ? "#ce93d8" : "#aaa", streak: streakG },
          { label: "TN",  img: pickImg(lscPick),  color: lscPick ? "#90caf9" : "#aaa", streak: streakTN },
          { label: "J",   img: pickImg(jPick),    color: jPick ? "#90caf9" : "#aaa", streak: streakJ },
          // 7번째 카드: armed에 따라 ONE / TWO 동적 표시 (260527)
          (onePick && !twoPick
            ? { label: "ONE", img: pickImg(onePick), color: "#90caf9", streak: streakONE }
            : { label: "TWO", img: pickImg(twoPick), color: twoPick ? "#90caf9" : "#aaa", streak: streakTWO }),
        ];
        // 2번: 배팅 테이블 정적 데이터
        const SEC_COLOR = "#5165f3";
        const BET_GROUPS = [
          [{ sec: "A" }, { sec: "AR" }, { sec: "AR_RATE" }],
          [{ sec: "D" }, { sec: "G" }, { sec: "TN" }],
          [{ sec: "J" }, { sec: "1" }, { sec: "2" }],
        ];
        // 1000원 마틴 9단계 (2배 진행, 9단계 cap)
        const MARTIN_AMOUNTS = [1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000];
        const calcBatBySec = (sec) => {
          const SEC_TO_KEY = { "1": "ONE", "2": "TWO" };
          const key = SEC_TO_KEY[sec] || sec;
          const s = picksSnapshot?.stats?.[key];
          if (!s) return 0;
          let step = 1;
          if (s.cur_streak_type === "miss") {
            step = Math.min((s.cur_streak_count || 0) + 1, 9);
          }
          return MARTIN_AMOUNTS[step - 1];
        };
        // picks_snapshot.stats에서 가져옴 (없으면 0/0/0[0-0])
        const SEC_TO_KEY = { "1": "ONE", "2": "TWO" };
        // SEC 라벨 색상: 승률(hit/total) 상위 1~3등 강조
        const ALL_SECS = ["A", "D", "G", "TN", "AR", "J", "1", "2"];
        const secWinRates = ALL_SECS.map((sec) => {
          const key = SEC_TO_KEY[sec] || sec;
          const s = picksSnapshot?.stats?.[key];
          const total = s?.total ?? 0;
          const hit = s?.hit ?? 0;
          return { sec, total, hit, rate: total > 0 ? hit / total : -1 };
        });
        const ranked = secWinRates
          .filter((x) => x.total > 0)
          .sort((a, b) => b.rate - a.rate);
        const secRankBg = (sec) => {
          // D, G, TN: 3개 비교 1/2/3등
          const DGTN_SECS = ["D", "G", "TN"];
          if (DGTN_SECS.includes(sec)) {
            const dgtnRanked = secWinRates
              .filter((x) => DGTN_SECS.includes(x.sec) && x.total > 0)
              .sort((a, b) => b.rate - a.rate);
            const idx = dgtnRanked.findIndex((x) => x.sec === sec);
            if (idx === 0) return "#00e676";
            if (idx === 1) return "#ff9800";
            if (idx === 2) return "#ffeb3b";
          }
          // A/AR: 두 개만 비교 — 높은 쪽 형광
          if (sec === "A" || sec === "AR") {
            const aRate = secWinRates.find((x) => x.sec === "A")?.rate ?? -1;
            const arRate = secWinRates.find((x) => x.sec === "AR")?.rate ?? -1;
            if (sec === "A" && aRate > arRate && aRate >= 0) return "#00e676";
            if (sec === "AR" && arRate > aRate && arRate >= 0) return "#00e676";
          }
          return null;
        };
        // sec → 칩 라벨 매핑 (이 sec를 가리는 칩)
        const SEC_TO_CHIP = { A: "A", D: "D", G: "G", TN: "TN", AR: "AR", J: "J", "1": "TWO", "2": "TWO" };
        const fmtStats = (sec) => {
          const chipKey = SEC_TO_CHIP[sec];
          if (chipKey && chipStreakHidden[chipKey]) {
            return null; // 칩 toggle 숨김 상태면 통계도 숨김
          }
          const key = SEC_TO_KEY[sec] || sec;
          const s = picksSnapshot?.stats?.[key];
          const total = s?.total ?? 0;
          const hit = s?.hit ?? 0;
          const miss = s?.miss ?? 0;
          const mh = s?.max_hit_streak ?? 0;
          const mm = s?.max_miss_streak ?? 0;
          return (
            <>
              {total}/<span style={{ color: HIT_BG }}>{hit}</span>/<span style={{ color: MISS_BG }}>{miss}</span>[<span style={{ color: HIT_BG }}>{mh}</span>-<span style={{ color: MISS_BG }}>{mm}</span>]
            </>
          );
        };
        // 만 단위 표시(절대값 ≥ 100,000)는 어두운 톤, 그 외는 밝은 톤
        const batColor = (v) => {
          const isMan = Math.abs(v) >= 100000;
          if (v < 0) return isMan ? "#c62828" : "#ff1744";
          return isMan ? "#b8860b" : "#ffea00";
        };
        // 단축 표시: 10만 이상은 XX만, 그 미만은 그냥 숫자
        const fmtBatShort = (v) => {
          const n = Math.abs(v);
          if (n >= 100000) {
            return `${Math.floor(n / 10000)}만`;
          }
          return n.toLocaleString();
        };
        const tdCell = { border: "1px solid #555", padding: "1px 10px", fontSize: 11, lineHeight: 1.2, textAlign: "center", whiteSpace: "nowrap", color: "#e0e0e0", backgroundColor: "#0f1217" };
        const tdCellBat = { ...tdCell, padding: "1px 6px", minWidth: 50 };
        const tdCellNarrow = { ...tdCell, padding: "1px 4px" };
        const thCell = { ...tdCell, color: "#9e9e9e", fontWeight: "bold", backgroundColor: "#161a20" };
        const thCellBat = { ...thCell, padding: "1px 6px", minWidth: 50 };
        const thCellNarrow = { ...thCell, padding: "1px 4px" };

        // 3번: S1/S2/S3 78셀 그리드 (39열 × 2행 = 78셀, 1~39 / 40~78)
        const COLS = 39;
        const buildRow = (start) => Array.from({ length: COLS }, (_, k) => start + k);
        const HIT_BG = "#01e676";   // 초록
        const MISS_BG = "#ffeb3b";  // 노랑
        const WAIT_BG = "#ffffff";  // 흰색 (현재 회차)
        const resBg = (r) => r === "hit" ? HIT_BG : r === "miss" ? MISS_BG : WAIT_BG;

        // gh_tracks 데이터로 SROWS 구성 (sc1/sc2/sc3)
        // 셀 인덱스 k에 표시되는 라운드 = startRound + k (sc1=1, sc2=2, sc3=3)
        const ghTracks = picksSnapshot?.gh_tracks?.tracks;
        const buildSrow = (key, label, startRound) => {
          const t = ghTracks?.[key];
          const filled = new Array(78).fill(null);
          const bgPalette = new Array(78).fill(null);
          const scoresAt = new Array(78).fill(null);  // 셀 인덱스별 그 시점 8 패턴 점수
          if (!t) return { label, filled, bgPalette, scoresAt, startRound };
          for (const r of (t.round_data || [])) {
            const idx = r.round - startRound; // 셀 인덱스
            if (idx < 0 || idx >= 78) continue;
            filled[idx] = r.predict || null;
            if (r.status === "hit") bgPalette[idx] = HIT_BG;
            else if (r.status === "miss") bgPalette[idx] = MISS_BG;
            else if (r.status === "current") bgPalette[idx] = WAIT_BG;  // 현재 라운드 = 흰색
            else if (r.status === "future") bgPalette[idx] = "#1c1f25"; // 현재 묶음의 다른 미진행 = 어두운 회색
            scoresAt[idx] = r.pattern_scores || null;
          }
          return { label, filled, bgPalette, scoresAt, startRound };
        };
        const SROWS = [
          buildSrow("sc1", "S1", 1),
          buildSrow("sc2", "S2", 2),
          buildSrow("sc3", "S3", 3),
        ];
        const cellSz = 22;
        const renderCell = (n, pick, bg) => (
          <Box key={n} sx={{
            width: cellSz, height: cellSz, border: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "center",
            backgroundColor: pick ? (bg || HIT_BG) : "#1c1f24",
          }}>
            {pick ? (
              <Typography sx={{ fontSize: 11, fontWeight: "bold", color: pick === "P" ? "#1565c0" : "#f44336" }}>{pick}</Typography>
            ) : (
              <Typography sx={{ fontSize: 10, color: "#888" }}>{n}</Typography>
            )}
          </Box>
        );

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
              cursor: processing ? "not-allowed" : "pointer",
              opacity: processing ? 0.4 : 1, pointerEvents: processing ? "none" : "auto",
              "&:hover": { opacity: processing ? 0.4 : 0.85 },
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
                    // A/AR 연승·연패 비교 → 더 좋은 쪽 픽
                    // hit > miss, 같은 type이면 hit는 큰 streak, miss는 작은 streak이 우위
                    const pickBetter = () => {
                      const aHit = streakA?.type === "hit";
                      const arHit = streakAR?.type === "hit";
                      if (streakA && !streakAR) return aPick;
                      if (!streakA && streakAR) return arPick;
                      if (!streakA && !streakAR) return aPick || arPick || null;
                      if (aHit && !arHit) return aPick;
                      if (!aHit && arHit) return arPick;
                      if (aHit && arHit) return streakA.count >= streakAR.count ? aPick : arPick;
                      return streakA.count <= streakAR.count ? aPick : arPick; // 둘 다 miss → 연패가 적은 쪽
                    };
                    const center = pickBetter() || "W";
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
                  <Box sx={{ ...fieldSx, width: 128, minWidth: 128, justifyContent: "flex-start", height: 32, border: "2px solid #7f7f7f", whiteSpace: "nowrap", overflow: "hidden" }}>
                    <Typography variant="caption" sx={{ fontSize: 11, color: "#fff", whiteSpace: "nowrap" }}>HP:&nbsp;&nbsp;220000 P</Typography>
                  </Box>
                </Box>
              </Box>
            );
          })()}

          {/* ===== 2: 픽 정보부 (이미지15 정적 디자인) ===== */}
          <Box sx={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 1, p: 0.5, backgroundColor: "#0d1014", borderRadius: 1, overflowX: "auto" }}>
            {/* 2-1: 7-픽 카드 + streak */}
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "nowrap" }}>
              {PICK_LIST.map(({ label, img, color, streak, badge }) => (
                <Box key={label} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                  <Box sx={{ width: 52, height: 52, border: "1px solid #4e4e4e", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", backgroundColor: "#0a0c10" }}>
                    <img src={img} alt={label} style={{ width: 46, height: 46, objectFit: "contain" }} />
                    <Typography variant="caption" sx={{ position: "absolute", top: 2, left: 4, fontSize: 10, color, fontWeight: "bold" }}>{label}</Typography>
                    {badge && (
                      <Typography variant="caption" sx={{ position: "absolute", top: 1, right: 3, fontSize: 14, lineHeight: 1, color: "#ffeb3b", fontWeight: 900, textShadow: "0 0 2px #000, 0 0 2px #000" }}>{badge}</Typography>
                    )}
                  </Box>
                  {(() => {
                    const chipHidden = !!chipStreakHidden[label];
                    const onChipToggle = () => setChipStreakHidden((p) => ({ ...p, [label]: !p[label] }));
                    if (!streak || chipHidden) {
                      return (
                        <Box
                          onClick={streak ? onChipToggle : undefined}
                          sx={{ width: 36, height: 22, border: "1px solid #7f7f7f", borderRadius: 1, cursor: streak ? "pointer" : "default" }}
                        />
                      );
                    }
                    return (
                      <Box
                        onClick={onChipToggle}
                        sx={{ width: 36, height: 22, border: "1px solid #7f7f7f", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", "&:hover": { opacity: 0.8 } }}
                      >
                        <Typography variant="caption" sx={{ fontSize: 12, fontWeight: "bold", color: streak.type === "hit" ? "#4caf50" : "#f44336" }}>
                          {streak.count}{streak.type === "hit" ? "H" : "M"}
                        </Typography>
                      </Box>
                    );
                  })()}
                </Box>
              ))}
            </Box>
            {/* 2-1.5: NEW SEC 7개 미니 테이블 (260527) — 위 픽 카드와 컬럼 정렬, A/AR/D/G/TN/J/(1or2) */}
            {(() => {
              const SEC_TO_KEY_NEW = { "1": "ONE", "2": "TWO" };
              const NEW_SECS_BASE = ["A", "AR", "D", "G", "TN", "J"];
              // 마지막 컬럼: 현재 ONE/TWO 픽 중 활성된 쪽 라벨 (없으면 "2" 기본)
              const _onePresent = picksSnapshot?.next_picks?.ONE != null;
              const _twoPresent = picksSnapshot?.next_picks?.TWO != null;
              const lastSec = _onePresent && !_twoPresent ? "1" : "2";
              const NEW_SECS_7 = [...NEW_SECS_BASE, lastSec];
              const getStat7 = (sec) => {
                const k = SEC_TO_KEY_NEW[sec] || sec;
                return picksSnapshot?.stats?.[k] || { total: 0, hit: 0, miss: 0, max_hit_streak: 0, max_miss_streak: 0 };
              };
              const rates7 = NEW_SECS_7.map((sec) => {
                const s = getStat7(sec);
                return { sec, total: s.total ?? 0, hit: s.hit ?? 0, rate: (s.total ?? 0) > 0 ? (s.hit ?? 0) / s.total : -1 };
              });
              const bgFor7 = (sec) => {
                // A/AR: 둘 중 1등(높은 쪽) 형광 그린
                if (sec === "A" || sec === "AR") {
                  const a = rates7.find((x) => x.sec === "A")?.rate ?? -1;
                  const ar = rates7.find((x) => x.sec === "AR")?.rate ?? -1;
                  if (sec === "A" && a > ar && a >= 0) return "#00e676";
                  if (sec === "AR" && ar > a && ar >= 0) return "#00e676";
                  return null;
                }
                // D/G/TN: 1등 초록 / 2등 주황 / 3등 노랑
                const DGTN = ["D", "G", "TN"];
                if (DGTN.includes(sec)) {
                  const sorted = rates7.filter((x) => DGTN.includes(x.sec) && x.total > 0).sort((a, b) => b.rate - a.rate);
                  const idx = sorted.findIndex((x) => x.sec === sec);
                  if (idx === 0) return "#00e676";
                  if (idx === 1) return "#ff9800";
                  if (idx === 2) return "#ffeb3b";
                }
                return null;
              };
              const cellBase7 = { border: "1px solid #444", padding: "1px 2px", textAlign: "center", fontSize: 11, color: "#fff", lineHeight: 1.3 };
              // 픽 카드와 동일한 flex 레이아웃(gap 0.5, flexShrink 0, width 52) → 컬럼 정렬
              return (
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "nowrap" }}>
                  {NEW_SECS_7.map((sec) => {
                    const s = getStat7(sec);
                    const r = rates7.find((x) => x.sec === sec);
                    const rate = r && r.rate >= 0 ? (r.rate * 100).toFixed(1) : null;
                    const bg = bgFor7(sec);
                    return (
                      <Box key={`sec-mini-${sec}`} sx={{ flexShrink: 0, width: 52 }}>
                        <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                          <tbody>
                            <tr><td style={cellBase7}>{s.total ?? 0}</td></tr>
                            <tr><td style={cellBase7}>
                              <span style={{ color: HIT_BG }}>{s.hit ?? 0}</span>/<span style={{ color: MISS_BG }}>{s.miss ?? 0}</span>
                            </td></tr>
                            <tr><td style={{ ...cellBase7, backgroundColor: bg || "transparent", color: bg ? "#000" : "#fff", fontWeight: "bold" }}>
                              {rate !== null ? `${rate}%` : "-"}
                            </td></tr>
                            <tr><td style={cellBase7}>
                              <span style={{ color: HIT_BG }}>{s.max_hit_streak ?? 0}</span>-<span style={{ color: MISS_BG }}>{s.max_miss_streak ?? 0}</span>
                            </td></tr>
                          </tbody>
                        </table>
                      </Box>
                    );
                  })}
                </Box>
              );
            })()}
          </Box>

          </Box>
          {/* /1|2 row */}

          {/* ===== 3: 나이스초이스 표 (실제 table) — admin 전용 ===== */}
          {isAdmin && (() => {
            const cellTd = (extra = {}) => ({
              width: cellSz, minWidth: cellSz, maxWidth: cellSz,
              height: cellSz, minHeight: cellSz, maxHeight: cellSz,
              padding: 0, textAlign: "center",
              border: "1px solid #333", verticalAlign: "middle",
              boxSizing: "border-box", lineHeight: 1,
              ...extra,
            });
            const labelTd = {
              width: 44, height: cellSz, padding: 0, textAlign: "center",
              backgroundColor: "transparent", boxSizing: "border-box",
            };
            // 3칸마다 굵은 우측선: col index k (0~39), (k+1) % 3 === 0 이고 마지막은 제외
            const isThickRight = (k) => k < COLS - 1 && (k + 1) % 3 === 0;
            const PATTERNS_ORDER = ["PPP", "BBB", "PBP", "BPB", "PPB", "BBP", "PBB", "BPP"];
            const buildScoreTooltip = (n, scores) => {
              if (!scores) return null;
              const max = Math.max(...Object.values(scores));
              return (
                <Box sx={{ p: 0.5 }}>
                  <Typography variant="caption" sx={{ display: "block", fontWeight: "bold", mb: 0.5 }}>R{n} 패턴별 누적 점수</Typography>
                  {PATTERNS_ORDER.map((pat) => (
                    <Box key={pat} sx={{ display: "flex", justifyContent: "space-between", gap: 2, fontSize: 11 }}>
                      <span>{pat}</span>
                      <span style={{ fontWeight: "bold", color: (scores[pat] ?? 0) === max ? "#4caf50" : "#fff" }}>
                        {scores[pat] ?? 0}
                      </span>
                    </Box>
                  ))}
                </Box>
              );
            };
            const renderTd = (key, n, pick, bg, k, scores) => {
              const extra = isThickRight(k) ? { borderRight: "2px solid #aaa" } : {};
              const cell = (
                <td key={key} style={{ ...cellTd(extra) }}>
                  <Box sx={{
                    width: "100%", height: "100%",
                    backgroundColor: pick ? (bg || HIT_BG) : "#1c1f24",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: scores ? "help" : "default",
                  }}>
                    {pick ? (
                      <Typography sx={{ fontSize: 11, fontWeight: "bold", color: pick === "P" ? "#1565c0" : "#f44336" }}>{pick}</Typography>
                    ) : (
                      <Typography sx={{ fontSize: 10, color: "#888" }}>{n}</Typography>
                    )}
                  </Box>
                </td>
              );
              if (!scores) return cell;
              return (
                <Tooltip key={key} title={buildScoreTooltip(n, scores)} arrow placement="top">
                  {cell}
                </Tooltip>
              );
            };
            return (
              <Box sx={{ mb: 2 }}>
                <table style={{ borderCollapse: "collapse", borderSpacing: 0 }}>
                  <tbody>
                    {(() => {
                      // 1/2/3등 배경색 매핑 (260525):
                      //  - Point 회차단위 적용 시(point_applied) → 회차 점수(total_score) 기준 "적중 많은 트랙=1등"
                      //  - 미적용(기본/복원) → 옛날처럼 승률 기준
                      const pointApplied = !!picksSnapshot?.gh_tracks?.point_applied;
                      const metric = (key) => {
                        const t = ghTracks?.[key];
                        if (!t) return null;
                        let h = 0, m = 0;
                        for (const x of (t.round_data || [])) {
                          if (x.status === "hit") h++;
                          else if (x.status === "miss") m++;
                        }
                        if (h + m === 0) return null;
                        return pointApplied ? (t.total_score ?? 0) : h / (h + m);
                      };
                      const trackRates = [
                        { key: "sc1", rate: metric("sc1") },
                        { key: "sc2", rate: metric("sc2") },
                        { key: "sc3", rate: metric("sc3") },
                      ].filter((x) => x.rate !== null).sort((a, b) => b.rate - a.rate);
                      const rateBgByKey = (key) => {
                        const idx = trackRates.findIndex((x) => x.key === key);
                        if (idx === 0) return "#00e676";
                        if (idx === 1) return "#ff9800";
                        if (idx === 2) return "#ffeb3b";
                        return null;
                      };
                      return SROWS.map((row, ri) => {
                      const top = buildRow(row.startRound);
                      const bottom = buildRow(row.startRound + 39);
                      const fill = row.filled;
                      const palette = row.bgPalette;
                      const scoresAt = row.scoresAt || [];
                      // 트랙 현재 연승/연패 + 총 승/패 산출
                      const sckey = row.label === "S1" ? "sc1" : row.label === "S2" ? "sc2" : "sc3";
                      const rd = (ghTracks?.[sckey]?.round_data) || [];
                      let trackStreak = null;
                      let totalHit = 0;
                      let totalMiss = 0;
                      for (let i = rd.length - 1; i >= 0; i--) {
                        const st = rd[i].status;
                        if (st !== "hit" && st !== "miss") continue;
                        if (!trackStreak) { trackStreak = { type: st, count: 1 }; }
                        else if (trackStreak.type === st) { trackStreak.count++; }
                        // streak는 다른 결과 만나면 break (총합은 계속 카운트)
                      }
                      for (const r of rd) {
                        if (r.status === "hit") totalHit++;
                        else if (r.status === "miss") totalMiss++;
                      }
                      // streak는 마지막부터 같은 결과 연속만 카운트해야 하므로 다시 산출
                      trackStreak = null;
                      for (let i = rd.length - 1; i >= 0; i--) {
                        const st = rd[i].status;
                        if (st !== "hit" && st !== "miss") continue;
                        if (!trackStreak) { trackStreak = { type: st, count: 1 }; }
                        else if (trackStreak.type === st) { trackStreak.count++; }
                        else break;
                      }
                      const streakColor = trackStreak ? (trackStreak.type === "hit" ? "#4caf50" : "#f44336") : null;
                      const streakText = trackStreak ? `${trackStreak.count}${trackStreak.type === "hit" ? "H" : "M"}` : "";
                      const hidden = !!trackStreakHidden[sckey];
                      const onToggle = () => setTrackStreakHidden((p) => ({ ...p, [sckey]: !p[sckey] }));
                      const streakCell = (
                        <td style={labelTd}>
                          <Box
                            onClick={onToggle}
                            sx={{ px: 0.5, py: 0, borderRadius: 1, border: `1px solid ${hidden ? "#555" : (streakColor || "#555")}`, color: hidden ? "transparent" : (streakColor || "#666"), fontSize: 11, fontWeight: "bold", minWidth: 28, height: cellSz, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", cursor: "pointer", "&:hover": { opacity: 0.8 } }}
                          >{hidden ? "" : streakText}</Box>
                        </td>
                      );
                      const totalCell = (
                        <td style={labelTd}>
                          {hidden ? (
                            <Box sx={{ px: 0.5, py: 0, borderRadius: 1, border: "1px solid #555", minWidth: 28, height: cellSz, boxSizing: "border-box" }} />
                          ) : (
                            <Box sx={{ px: 0.5, py: 0, borderRadius: 1, border: "1px solid #555", fontSize: 10, fontWeight: "bold", minWidth: 28, height: cellSz, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
                              <span style={{ color: "#01e676" }}>{totalHit}</span>
                              <span style={{ color: "#aaa" }}>/</span>
                              <span style={{ color: "#ffeb3b" }}>{totalMiss}</span>
                            </Box>
                          )}
                        </td>
                      );
                      return (
                        <React.Fragment key={row.label}>
                          {/* 1행: S1 라벨 + 연승연패 + top 셀 40개 */}
                          <tr>
                            <td style={labelTd}>
                              <Box sx={{ px: 1, py: 0, borderRadius: 1, border: "1px solid #555", color: "#aaa", fontSize: 12, minWidth: 40, height: cellSz, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>{row.label}</Box>
                            </td>
                            {streakCell}
                            {top.map((n, k) => {
                              const pick = fill[k];
                              const bg = pick ? palette[k] : null;
                              return renderTd(`${row.label}-t-${k}`, n, pick, bg, k, scoresAt[k]);
                            })}
                          </tr>
                          {/* 2행: 승률 라벨 + 총 승/패 + bottom 셀 40개 */}
                          <tr>
                            <td style={labelTd}>
                              {(() => {
                                const tot = totalHit + totalMiss;
                                const rate = tot > 0 ? (totalHit / tot * 100).toFixed(1) : null;
                                const bg = rateBgByKey(sckey);
                                return (
                                  <Box sx={{ px: 1, py: 0, borderRadius: 1, border: "1px solid #555", color: bg ? "#000" : "#aaa", fontSize: 11, fontWeight: "bold", minWidth: 40, height: cellSz, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", ...(bg ? { backgroundColor: bg } : {}) }}>
                                    {rate ? `${rate}%` : "-"}
                                  </Box>
                                );
                              })()}
                            </td>
                            {totalCell}
                            {bottom.map((n, k) => {
                              const idx = k + 39;
                              const pick = fill[idx];
                              const bg = pick ? palette[idx] : null;
                              return renderTd(`${row.label}-b-${k}`, n, pick, bg, k, scoresAt[idx]);
                            })}
                          </tr>
                          {ri < SROWS.length - 1 && (
                            <tr><td colSpan={COLS + 2} style={{ height: 6, border: "none", padding: 0 }} /></tr>
                          )}
                        </React.Fragment>
                      );
                    });
                    })()}
                  </tbody>
                </table>
              </Box>
            );
          })()}
          </>
        );
      })()}

      {/* ===== 배팅부: 마틴A/Z + P/B + next/new + 셋업/픽체인지 ===== */}
      {/* ===== 중단: 인터페이스 (한줄) ===== */}
      <Box sx={{ display: "flex", alignItems: "center", gap: isMobile ? 0.5 : 1, mb: 1, flexWrap: "wrap" }}>
        {/* 좌: 배팅 8행 + 총배팅 영역 제거됨 (새 2번 영역의 배팅 테이블이 대체) */}

        {/* 우측: 상하 분리 */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {/* 상: 회차/P/B/del/next/new/셋업/픽체인지/픽카드는 새 1·2번 영역으로 이동됨 */}
          {/* 하: 슈 넘버 + 라벨 */}
          <Box>
            {/* 누적 step 그래프 (260527) — 회차별 적중=+1 / 미적=-1 / wait=0 누적 */}
            {(() => {
              // 통일된 3색: 빨강 / 파랑 / 흰색 순
              const CHART_GROUPS = {
                S123: { S1: "#f44336", S2: "#2196f3", S3: "#ffffff" },
                AAR:  { A: "#f44336", AR: "#2196f3" },
                DGT:  { D: "#f44336", G: "#2196f3", TN: "#ffffff" },
                "1-2": { ONE: "#f44336", TWO: "#2196f3" },
              };
              const N = results.length;
              const tracks = picksSnapshot?.gh_tracks?.tracks || {};
              const seriesFor = (key) => {
                // S1/S2/S3 → gh_tracks round_data 사용
                if (key === "S1" || key === "S2" || key === "S3") {
                  const sckey = key === "S1" ? "sc1" : key === "S2" ? "sc2" : "sc3";
                  const rd = tracks[sckey]?.round_data || [];
                  const arr = new Array(N).fill(null);
                  for (const r of rd) {
                    const idx = (r.round || 0) - 1;
                    if (idx >= 0 && idx < N) {
                      if (r.status === "hit") arr[idx] = "hit";
                      else if (r.status === "miss") arr[idx] = "miss";
                    }
                  }
                  return arr;
                }
                // 나머지: round_picks[key] vs results[i].value
                const picks = picksSnapshot?.round_picks?.[key] || [];
                return results.map((r, i) => {
                  const pick = picks[i];
                  if (!pick || pick === "wait") return null;
                  return pick === r.value ? "hit" : "miss";
                });
              };
              const cumulativeFor = (key) => {
                const series = seriesFor(key);
                let sum = 0;
                return series.map((s) => {
                  if (s === "hit") sum += 1;
                  else if (s === "miss") sum -= 1;
                  return sum;
                });
              };
              const colors = CHART_GROUPS[chartGroup] || CHART_GROUPS.S123;
              const lines = Object.entries(colors).map(([key, color]) => ({ key, color, data: cumulativeFor(key) }));
              // SVG 차트 영역
              const W = 800, H = 160, padL = 22, padR = 8, padT = 8, padB = 22;
              const innerW = W - padL - padR;
              const innerH = H - padT - padB;
              const maxRound = Math.max(65, N);
              const allVals = lines.flatMap((l) => l.data).filter((v) => v !== null && v !== undefined);
              const minY = Math.min(0, ...(allVals.length ? allVals : [0]));
              const maxY = Math.max(0, ...(allVals.length ? allVals : [0]));
              const yRange = Math.max(1, maxY - minY);
              const xOf = (i) => padL + (i / Math.max(1, maxRound - 1)) * innerW;
              const yOf = (v) => padT + (1 - (v - minY) / yRange) * innerH;
              return (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {/* 그룹 토글 */}
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    {Object.keys(CHART_GROUPS).map((g) => (
                      <Box
                        key={g}
                        onClick={() => setChartGroup(g)}
                        sx={{
                          px: 1.5, py: 0.3, border: "1px solid #555", borderRadius: 0.5,
                          cursor: "pointer", fontSize: 11, fontWeight: "bold",
                          backgroundColor: chartGroup === g ? "#00e676" : "#1a1a2e",
                          color: chartGroup === g ? "#000" : "#90caf9",
                          userSelect: "none",
                        }}
                      >{g}</Box>
                    ))}
                  </Box>
                  {/* SVG 차트 */}
                  <Box sx={{ overflowX: "auto" }}>
                    <svg width={W} height={H} style={{ backgroundColor: "#0a0c10", display: "block" }}>
                      {/* X 라벨 (회차 번호) */}
                      {Array.from({ length: maxRound }, (_, i) => i + 1).map((n) => (
                        <text key={`xl-${n}`} x={xOf(n - 1)} y={H - 6} fontSize={8} fill="#666" textAnchor="middle">{n}</text>
                      ))}
                      {/* 0 기준선 */}
                      <line x1={padL} y1={yOf(0)} x2={W - padR} y2={yOf(0)} stroke="#555" strokeDasharray="2 2" strokeWidth={1} />
                      {/* 라인들 */}
                      {lines.map((l) => {
                        const points = l.data
                          .map((v, i) => (v !== null && v !== undefined) ? `${xOf(i)},${yOf(v)}` : null)
                          .filter(Boolean)
                          .join(" ");
                        return points ? (
                          <polyline key={`line-${l.key}`} points={points} fill="none" stroke={l.color} strokeWidth={1.5} />
                        ) : null;
                      })}
                    </svg>
                  </Box>
                </Box>
              );
            })()}
          </Box>
        </Box>
      </Box>

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

        const formalADir = sA?.direction || "wait";
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
                const mDir = um?.direction || "wait";
                const mAmt = um?.amount || 0;
                const mP = mDir === "P" ? mAmt : 0;
                const mB = mDir === "B" ? mAmt : 0;
                const fDir = mP > mB ? "P" : mB > mP ? "B" : "wait";
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
                const fDir = mP > mB ? "P" : mB > mP ? "B" : "wait";
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
              const GH_CELL_BG = { hit: "#00e676", miss: "#ffeb3b", wait: "#fff" };
              const tdStyleFn = (status) => ({
                width: cellSize, height: cellSize, border: "1px solid #555", padding: 0, textAlign: "center",
                backgroundColor: status ? (GH_CELL_BG[status] || "#fff") : "#333",
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
        pragmaticId={myPragmaticId}
      />
    </Box>
  );
}
