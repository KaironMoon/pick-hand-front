/**
 * Auto 시작 모달 — mvp-aboo-integration.md §5.1 step 3.
 *
 * 동작:
 *  - 열림 시 /auth/session-status 로 JSESSIONID 캡처 상태 확인.
 *  - 캡처 없거나 expired → "캡처 필요" 안내 + 입력 비활성.
 *  - 캡처 OK → table_id / server 입력 + "자동 베팅 시작" 활성.
 *  - 시작 호출 후 부모에서 폴링 시작.
 */
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import autoService from "@/services/auto-service";

// 서버 옵션: gs1 ~ gs29 + (자동탐지) 빈값
const SERVER_OPTIONS = ["", ...Array.from({ length: 29 }, (_, i) => `gs${i + 1}`)];

// 테이블 limits에서 min bet 추출 (구조 변형 대응)
const extractMinBet = (t) => {
  const l = t?.limits || {};
  return (
    l.minBet ??
    l.min_bet ??
    l.player?.minBet ?? l.player?.min_bet ?? l.player?.min ??
    l.banker?.minBet ?? l.banker?.min_bet ?? l.banker?.min ??
    l.all?.minBet ?? l.all?.min_bet ?? l.all?.min ??
    l.min ??
    null
  );
};

const extractMaxBet = (t) => {
  const l = t?.limits || {};
  return (
    l.maxBet ??
    l.max_bet ??
    l.player?.maxBet ?? l.player?.max_bet ?? l.player?.max ??
    l.all?.maxBet ?? l.all?.max_bet ?? l.all?.max ??
    l.max ??
    null
  );
};

const MIN_BET_TARGET = 1000;

const formatAge = (sec) => {
  if (sec == null) return "";
  if (sec < 60) return `${sec}초 전`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  return `${Math.floor(sec / 3600)}시간 전`;
};

const AutoStartDialog = ({ open, onClose, onStarted, gameId, pickhandId, gameType = "gh" }) => {
  const [sessionInfo, setSessionInfo] = useState(null);
  const [tableId, setTableId] = useState("");
  const [server, setServer] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [featureDisabled, setFeatureDisabled] = useState(false);

  // 테이블 목록 (pick-aboo /tables/discover 프록시)
  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState(null);
  const [filterMin1000, setFilterMin1000] = useState(true);  // 기본: 최소 1000원만

  // 모달 열림 + 캡처 OK 시 테이블 목록 자동 로드
  useEffect(() => {
    if (!open || !pickhandId) return undefined;
    if (!sessionInfo || sessionInfo.status !== "fresh") return undefined;
    let cancelled = false;
    (async () => {
      setTablesLoading(true);
      setTablesError(null);
      try {
        const res = await autoService.discoverTables(pickhandId);
        if (cancelled) return;
        const list = Array.isArray(res?.tables) ? res.tables : [];
        setTables(list);
      } catch (e) {
        if (cancelled) return;
        const detail = e?.response?.data?.detail;
        setTablesError(
          typeof detail === "string"
            ? detail
            : detail?.error || "테이블 목록 조회 실패"
        );
        setTables([]);
      } finally {
        if (!cancelled) setTablesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, pickhandId, sessionInfo]);

  const refreshTables = async () => {
    if (!pickhandId) return;
    setTablesLoading(true);
    setTablesError(null);
    try {
      const res = await autoService.discoverTables(pickhandId, true);
      setTables(Array.isArray(res?.tables) ? res.tables : []);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setTablesError(
        typeof detail === "string" ? detail : detail?.error || "재조회 실패"
      );
    } finally {
      setTablesLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setError(null);
      setBusy(false);
      return;
    }
    if (!pickhandId) {
      setError("프로필에서 pickhand_id를 먼저 등록하세요");
      setSessionInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const info = await autoService.getSessionStatus(pickhandId);
        if (!cancelled) setSessionInfo(info);
      } catch (e) {
        if (cancelled) return;
        if (e?.response?.status === 503) {
          setFeatureDisabled(true);
        } else {
          setError("세션 상태 조회 실패");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open, pickhandId]);

  const handleStart = async () => {
    setError(null);
    setBusy(true);
    try {
      const resp = await autoService.startAuto({
        gameId,
        pickhandId,
        tableId: tableId.trim(),
        server: server.trim() || null,
        gameType,
      });
      onStarted?.(resp);
      onClose?.();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (detail?.error === "session_required") {
        setError("JSESSIONID가 만료되었습니다. 모바일 앱에서 재캡처하세요");
      } else if (detail?.error === "auto_session_already_running") {
        setError("이미 자동 베팅이 실행 중입니다");
      } else if (e?.response?.status === 503) {
        setFeatureDisabled(true);
      } else {
        setError(detail?.error || "시작 실패");
      }
    } finally {
      setBusy(false);
    }
  };

  const isCaptureOk = sessionInfo?.captured && sessionInfo?.status === "fresh";
  const canStart = !!pickhandId && isCaptureOk && tableId.trim().length > 0 && !busy;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>자동 베팅 시작</DialogTitle>
      <DialogContent>
        {featureDisabled && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            자동 베팅 기능이 비활성화되어 있습니다 (운영자 문의)
          </Alert>
        )}
        {!featureDisabled && !pickhandId && (
          <Alert severity="info" sx={{ mb: 2 }}>
            프로필에서 pickhand_id를 등록한 뒤 다시 시도하세요
          </Alert>
        )}
        {!featureDisabled && sessionInfo && (
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Typography variant="body2">
              JSESSIONID:&nbsp;
              {isCaptureOk
                ? `캡처됨 (${formatAge(sessionInfo.age_seconds)})`
                : "캡처 필요 / 만료"}
            </Typography>
            {!isCaptureOk && (
              <Alert severity="warning">모바일 앱에서 JSESSIONID를 캡처하세요</Alert>
            )}
          </Stack>
        )}
        <Stack spacing={2}>
          {/* 서버 먼저 선택 — 비워두면 pick-aboo 자동탐지 (find_working_server) */}
          <FormControl size="small" disabled={!isCaptureOk || busy} fullWidth>
            <InputLabel id="server-select-label">server</InputLabel>
            <Select
              labelId="server-select-label"
              label="server"
              value={server}
              onChange={(e) => setServer(e.target.value)}
            >
              <MenuItem value="">
                <em>(자동탐지)</em>
              </MenuItem>
              {SERVER_OPTIONS.filter((s) => s).map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 테이블은 pick-aboo /tables/discover로 동적 조회. 직접 입력 불가. */}
          {(() => {
            const visibleTables = filterMin1000
              ? tables.filter((t) => extractMinBet(t) === MIN_BET_TARGET)
              : tables;
            return (
              <>
                <Stack direction="row" spacing={1} alignItems="center">
                  <FormControl
                    size="small"
                    disabled={!isCaptureOk || busy || tablesLoading || visibleTables.length === 0}
                    fullWidth
                  >
                    <InputLabel id="table-select-label">table_id</InputLabel>
                    <Select
                      labelId="table-select-label"
                      label="table_id"
                      value={tableId}
                      onChange={(e) => setTableId(e.target.value)}
                      renderValue={(val) => {
                        const t = visibleTables.find((x) => (x.table_id || x.id) === val);
                        if (!t) return val;
                        const name = t.name || t.title || t.description;
                        const min = extractMinBet(t);
                        const max = extractMaxBet(t);
                        const limitsStr = min != null ? ` [${min}${max != null ? `-${max}` : ""}]` : "";
                        return name ? `${val} — ${name}${limitsStr}` : `${val}${limitsStr}`;
                      }}
                    >
                      {visibleTables.map((t) => {
                        const id = t.table_id || t.id;
                        const name = t.name || t.title || t.description;
                        const min = extractMinBet(t);
                        const max = extractMaxBet(t);
                        const limitsStr =
                          min != null ? ` [${min}${max != null ? `-${max}` : ""}]` : " [limits ?]";
                        return (
                          <MenuItem key={id} value={id}>
                            {name ? `${id} — ${name}${limitsStr}` : `${id}${limitsStr}`}
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                  <IconButton
                    size="small"
                    onClick={refreshTables}
                    disabled={!isCaptureOk || busy || tablesLoading}
                    title="재조회"
                  >
                    {tablesLoading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
                  </IconButton>
                </Stack>

                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={filterMin1000}
                      onChange={(e) => setFilterMin1000(e.target.checked)}
                    />
                  }
                  label={`최소 베팅 ${MIN_BET_TARGET} 만 보기 (전체 ${tables.length}개 중 ${visibleTables.length}개)`}
                />

                {tablesError && (
                  <Alert severity="error" sx={{ mt: 0 }}>{tablesError}</Alert>
                )}
                {isCaptureOk && !tablesLoading && !tablesError && tables.length === 0 && (
                  <Alert severity="info" sx={{ mt: 0 }}>
                    테이블 목록을 가져오려면 새로고침 버튼을 누르세요
                  </Alert>
                )}
                {isCaptureOk && !tablesLoading && filterMin1000 && tables.length > 0 && visibleTables.length === 0 && (
                  <Alert severity="warning" sx={{ mt: 0 }}>
                    최소 베팅 {MIN_BET_TARGET}원짜리 테이블이 없습니다. 필터를 끄고 전체 보기.
                  </Alert>
                )}
              </>
            );
          })()}
        </Stack>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>취소</Button>
        <Button onClick={handleStart} disabled={!canStart} variant="contained">
          자동 베팅 시작
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AutoStartDialog;
