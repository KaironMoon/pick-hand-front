import { useEffect, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Checkbox, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, LinearProgress, Link, MenuItem, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow,
  TextField, Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { GH_GAMES_API, USERS_API } from "@/constants/api-url";
import apiCaller from "@/services/api-caller";

const accountLabel = ({ username, nickname }) => nickname ? `${nickname} (${username})` : username;
const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "medium", hour12: false,
});
const columns = ["게임 번호", "설정 계정", "탐색 기준", "최초 달성", "최대 연패", "종료 PNL (P)", "결과열", "PickHelper 원본", "생성 시각"];
const jobKey = "gh-counter-shoe-job";
const phases = {
  queued: "생성 대기 중",
  loading: "계정 설정을 불러오는 중",
  searching: "P/B 분기 탐색 중",
  verifying: "60회차 결과 재검증 중",
  saving: "리플레이 기록 저장 중",
  stopping: "생성 작업을 중지하는 중",
  finished: "생성 종료",
};
const reasons = {
  goal_reached: "목표 개수를 모두 저장했습니다.",
  exhausted: "가능한 분기 탐색을 마쳤습니다.",
  server_shutdown: "서버가 종료되어 작업이 중단됐습니다.",
  worker_error: "생성 작업 중 오류가 발생했습니다.",
  user_stopped: "사용자가 생성을 중지했습니다.",
};

function ShoeJobProgress({ job }) {
  const isStreak = job.criterion === "loss_streak";
  const target = isStreak ? `${job.threshold}연패 초과` : `${job.threshold}P 미만`;
  const best = job.best == null ? "60회차 결과 없음"
    : isStreak ? `최대 ${job.best}연패` : `최저 PNL ${job.best}P`;
  const elapsed = job.elapsed ?? Math.max(0, Math.floor(Date.now() / 1000 - job.started_at));
  return (
    <Stack spacing={0.5} role="status" aria-live="off">
      <Typography variant="body2">
        {phases[job.phase]} · 기준 {target}
        {job.phase === "searching" && job.round_num ? ` · ${job.round_num}/60회차 분기` : ""}
        {job.phase === "verifying" ? ` · ${job.round_num}/60회차` : ""}
        {job.phase === "searching" && job.intervention_round ? ` · ${job.intervention_round}회차부터 개입` : ""}
      </Typography>
      <Typography variant="body2">평가 분기 {job.expanded}개 · 60회차 완료 {job.completed}개 · {best} · 중복 {job.duplicates}개</Typography>
      <Typography variant="body2">목표 {job.requested}개 · 검증 {job.verified}개 · 저장 {job.generated}개 · 경과 {elapsed}초</Typography>
    </Stack>
  );
}

function requestErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

export default function GhTestShoesPage() {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [account, setAccount] = useState(null);
  const [criterion, setCriterion] = useState("loss_streak");
  const [threshold, setThreshold] = useState("9");
  const [count, setCount] = useState("5");
  const [job, setJob] = useState(null);
  const [jobId, setJobId] = useState(() => sessionStorage.getItem(jobKey));
  const [submitting, setSubmitting] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [stopError, setStopError] = useState("");
  const [searchError, setSearchError] = useState("");
  const busy = submitting || Boolean(jobId && job?.phase !== "finished");
  const [history, setHistory] = useState({ items: [], total: 0 });
  const [historyError, setHistoryError] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [deleteIds, setDeleteIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const pageIds = history.items.map(({ game_id }) => game_id);
  const selectedIds = pageIds.filter((id) => selected.has(id));
  const pageSelected = pageIds.length > 0 && selectedIds.length === pageIds.length;
  const isStreak = criterion === "loss_streak";
  const number = Number(threshold);
  const requested = Number(count);
  const valid = account && threshold.trim() && Number.isFinite(number)
    && Number.isInteger(requested) && requested >= 1 && requested <= 2147483647
    && (!isStreak || (Number.isInteger(number) && number >= 0 && number < 60));

  useEffect(() => {
    const controller = new AbortController();
    apiCaller.get(USERS_API.BASE, {}, { signal: controller.signal })
      .then(({ data }) => setUsers(data))
      .catch(() => {
        if (!controller.signal.aborted) setUsersError("계정 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingUsers(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingHistory(true);
    setHistoryError("");
    apiCaller.get(GH_GAMES_API.SHOE_SEARCH, { page: page + 1, page_size: pageSize }, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setHistory(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setHistoryError(requestErrorMessage(error, "생성 기록을 불러오지 못했습니다."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingHistory(false);
      });
    return () => controller.abort();
  }, [page, pageSize, revision]);

  useEffect(() => {
    if (!jobId) return undefined;
    const controller = new AbortController();
    let timer;
    const poll = async () => {
      try {
        const { data } = await apiCaller.get(`${GH_GAMES_API.SHOE_SEARCH}/jobs/${jobId}`, {}, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setJob(data);
        setSearchError("");
        if (data.phase === "finished") {
          setStopRequested(false);
          setStopError("");
          sessionStorage.removeItem(jobKey);
          setJobId(null);
          setPage(0);
          setSelected(new Set());
          setRevision((value) => value + 1);
          return;
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchError(requestErrorMessage(error, "진행 상황을 불러오지 못했습니다. 다시 확인 중입니다."));
        if ([403, 404].includes(error.response?.status)) {
          sessionStorage.removeItem(jobKey);
          setJobId(null);
          setJob(null);
          return;
        }
      }
      timer = setTimeout(poll, 1000);
    };
    poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [jobId]);

  const search = async (event) => {
    event.preventDefault();
    if (!valid || busy) return;
    setJob(null);
    setSearchError("");
    setStopRequested(false);
    setStopError("");
    setSubmitting(true);
    try {
      const { data } = await apiCaller.post(GH_GAMES_API.SHOE_SEARCH, {
        user_id: account.id,
        criterion,
        [criterion]: number,
        count: requested,
      });
      sessionStorage.setItem(jobKey, data.job_id);
      setJob(data);
      setJobId(data.job_id);
    } catch (error) {
      setSearchError(requestErrorMessage(error, "슈를 생성하지 못했습니다."));
    } finally {
      setSubmitting(false);
    }
  };

  const stopSearch = async () => {
    setStopRequested(true);
    setStopError("");
    try {
      await apiCaller.post(`${GH_GAMES_API.SHOE_SEARCH}/jobs/${jobId}/stop`);
    } catch (error) {
      setStopRequested(false);
      setStopError(requestErrorMessage(error, "생성 작업을 중지하지 못했습니다."));
    }
  };

  const deleteSelected = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await apiCaller.delete(GH_GAMES_API.SHOE_SEARCH, {}, { data: { game_ids: deleteIds } });
      setSelected(new Set());
      setDeleteIds([]);
      setPage(0);
      setRevision((value) => value + 1);
    } catch (error) {
      setDeleteError(requestErrorMessage(error, "선택한 기록을 삭제하지 못했습니다."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Stack spacing={2} sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" component="h1">카운터 슈 생성</Typography>
      <Box component="form" onSubmit={search} sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Autocomplete
          size="small" sx={{ minWidth: 230 }}
          options={users} value={account} getOptionLabel={accountLabel}
          loading={loadingUsers} loadingText="계정을 불러오는 중입니다."
          noOptionsText="계정이 없습니다." disabled={busy}
          onChange={(_, value) => setAccount(value)}
          renderInput={(params) => <TextField {...params} label="글로벌히트 설정 계정" />}
        />
        <TextField
          select size="small" sx={{ minWidth: 160 }} label="탐색 기준" value={criterion} disabled={busy}
          onChange={(event) => {
            setCriterion(event.target.value);
            setThreshold(event.target.value === "loss_streak" ? "9" : "-100");
          }}
        >
          <MenuItem value="loss_streak">최대 연패</MenuItem>
          <MenuItem value="pnl">진행 중 PNL</MenuItem>
        </TextField>
        <TextField
          size="small" sx={{ width: 175 }} type="number" label={isStreak ? "기준 연패 수" : "기준 PNL (P)"}
          value={threshold} disabled={busy}
          inputProps={isStreak ? { min: 0, max: 59, step: 1 } : { step: "any" }}
          helperText={isStreak ? "입력값 초과" : "슈 진행 중 입력값 미만"}
          onChange={(event) => setThreshold(event.target.value)}
        />
        <TextField
          size="small" sx={{ width: 110 }} type="number" label="생성 개수"
          value={count} disabled={busy} inputProps={{ min: 1, max: 2147483647, step: 1 }}
          onChange={(event) => setCount(event.target.value)}
        />
        <Button type="submit" variant="contained" disabled={!valid || busy}>{busy ? "생성 중" : "슈 생성"}</Button>
        {jobId && busy && (
          <Button color="error" variant="outlined" disabled={stopRequested || job?.phase === "stopping"} onClick={stopSearch}>
            {stopRequested || job?.phase === "stopping" ? "중지 중" : "중지"}
          </Button>
        )}
        <Button disabled={loadingHistory || deleting} onClick={() => setRevision((value) => value + 1)}>새로고침</Button>
        <Button
          color="error" disabled={!selectedIds.length || loadingHistory || deleting}
          onClick={() => { setDeleteError(""); setDeleteIds(selectedIds); }}
        >
          선택 삭제{selectedIds.length > 0 && ` (${selectedIds.length})`}
        </Button>
      </Box>
      {usersError && <Alert severity="error">{usersError}</Alert>}
      {searchError && <Alert severity="error">{searchError}</Alert>}
      {stopError && <Alert severity="error">{stopError}</Alert>}
      {busy && <LinearProgress aria-label="카운터 슈 생성 중" />}
      {job && <ShoeJobProgress job={job} />}
      {job?.phase === "finished" && (
        <Alert severity={job.reason === "goal_reached" ? "success" : ["exhausted", "user_stopped"].includes(job.reason) ? "info" : "error"}>
          {reasons[job.reason] || job.detail || "생성 작업을 완료하지 못했습니다."}
        </Alert>
      )}
      {historyError && <Alert severity="error">{historyError}</Alert>}
      <Paper>
        {loadingHistory && <LinearProgress aria-label="생성 기록 불러오는 중" />}
        <TableContainer>
          <Table size="small" aria-label="카운터 슈 생성 기록" sx={{ minWidth: 780 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={pageSelected} indeterminate={!pageSelected && selectedIds.length > 0}
                    disabled={!pageIds.length || loadingHistory || deleting}
                    onChange={() => setSelected(new Set(pageSelected ? [] : pageIds))}
                    slotProps={{ input: { "aria-label": "현재 페이지 전체 선택" } }}
                  />
                </TableCell>
                {columns.map((label) => <TableCell key={label}>{label}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {history.items.map((row) => (
                <TableRow key={row.game_id} hover selected={selected.has(row.game_id)}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selected.has(row.game_id)} disabled={loadingHistory || deleting}
                      onChange={(_, checked) => setSelected((current) => {
                        const next = new Set(current);
                        if (checked) next.add(row.game_id);
                        else next.delete(row.game_id);
                        return next;
                      })}
                      slotProps={{ input: { "aria-label": `카운터 슈 ${row.game_id} 선택` } }}
                    />
                  </TableCell>
                  <TableCell>
                    <Link component={RouterLink} to={`/ghgame/user?slot=1&replayGameId=${row.game_id}`} aria-label={`테스트 슈 ${row.game_id} 리플레이`}>
                      {row.game_id}
                    </Link>
                  </TableCell>
                  <TableCell>{row.username}</TableCell>
                  <TableCell>{row.criterion === "loss_streak" ? `${row.threshold}연패 초과` : `${row.threshold}P 미만`}</TableCell>
                  <TableCell>
                    {row.first_hit_round == null ? "—" : (
                      `${row.first_hit_round}회차 · ${row.first_hit_value}${row.criterion === "loss_streak" ? "연패" : "P"}`
                    )}
                  </TableCell>
                  <TableCell>
                    {row.max_loss_streak}연패
                    {row.loss_streak_range && ` (${row.loss_streak_range.start}~${row.loss_streak_range.end}회차)`}
                  </TableCell>
                  <TableCell>{row.pnl}</TableCell>
                  <TableCell>
                    <Box component="details">
                      <Box component="summary" sx={{ cursor: "pointer", whiteSpace: "nowrap" }}>
                        {row.round_count}회차
                      </Box>
                      <Box component="code" sx={{ display: "block", minWidth: 130, overflowWrap: "anywhere" }}>{row.shoe}</Box>
                      {row.intervention_round && (
                        <Typography variant="caption">{row.intervention_round}회차부터 개입</Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {row.helper_games.map(({ game_seq, title, date }) => (
                      <Typography key={game_seq} variant="body2">
                        #{game_seq}{title && ` · ${title}`}{date && ` · ${date.slice(0, 10)}`}
                      </Typography>
                    ))}
                    {row.helper_games.length === 0 && "—"}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{dateFormatter.format(new Date(row.created_at))}</TableCell>
                </TableRow>
              ))}
              {!loadingHistory && !historyError && history.items.length === 0 && (
                <TableRow><TableCell colSpan={columns.length + 1} align="center">생성 기록이 없습니다.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={history.total} page={page} rowsPerPage={pageSize}
          rowsPerPageOptions={[25, 50, 100]} labelRowsPerPage="페이지당 기록"
          onPageChange={(_, value) => { setSelected(new Set()); setPage(value); }}
          onRowsPerPageChange={(event) => { setSelected(new Set()); setPageSize(Number(event.target.value)); setPage(0); }}
        />
      </Paper>
      <Dialog open={deleteIds.length > 0} onClose={deleting ? undefined : () => setDeleteIds([])}>
        <DialogTitle>카운터 슈 기록 삭제</DialogTitle>
        <DialogContent>
          <DialogContentText>선택한 {deleteIds.length}개의 카운터 슈와 리플레이 기록을 삭제할까요?</DialogContentText>
          {deleteError && <Alert severity="error" sx={{ mt: 1 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={deleting} onClick={() => setDeleteIds([])}>취소</Button>
          <Button color="error" disabled={deleting || !deleteIds.length} onClick={deleteSelected}>삭제</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
