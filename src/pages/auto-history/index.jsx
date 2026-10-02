import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Link, MenuItem, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TablePagination,
  TableRow, TextField, Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import autoService from "@/services/auto-service";

const GAME_LABELS = { gh: "글로벌히트", nc2: "나이스초이스" };
const STATUS_LABELS = { normal: "정상", error: "오류", stopped: "중지", running: "진행 중" };
const STATUS_COLORS = { normal: "success", error: "error", stopped: "default", running: "info" };
const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});
const formatTime = (value) => value ? dateFormatter.format(new Date(value)) : "—";

export default function AutoHistoryPage() {
  const [gameType, setGameType] = useState("");
  const [status, setStatus] = useState("");
  const [gameNumber, setGameNumber] = useState("");
  const [query, setQuery] = useState({});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inputError, setInputError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    autoService.getAutoHistory({ ...query, page: page + 1, page_size: pageSize })
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setError("오토플레이 기록을 불러오지 못했습니다. 다시 시도해 주세요."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, page, pageSize, revision]);

  const search = (event) => {
    event.preventDefault();
    const value = gameNumber.trim();
    if (value && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0)) {
      setInputError("올바른 게임번호를 입력하세요.");
      return;
    }
    setInputError("");
    setPage(0);
    setQuery({
      ...(gameType ? { game_type: gameType } : {}),
      ...(status ? { result_status: status } : {}),
      ...(value ? { game_id: Number(value) } : {}),
    });
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ mb: 2 }}>오토플레이 기록</Typography>
      <Box component="form" onSubmit={search} sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2, alignItems: "flex-start" }}>
        <TextField select label="게임 종류" size="small" value={gameType} onChange={(e) => setGameType(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">전체</MenuItem>
          {Object.entries(GAME_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <TextField select label="상태" size="small" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 120 }}>
          <MenuItem value="">전체</MenuItem>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <TextField label="게임 번호" size="small" value={gameNumber} onChange={(e) => setGameNumber(e.target.value)} inputProps={{ inputMode: "numeric" }} error={Boolean(inputError)} helperText={inputError} />
        <Button type="submit" variant="contained">검색</Button>
        <Button onClick={() => setRevision((value) => value + 1)} disabled={loading}>새로고침</Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>PNL은 실제 오토 베팅 손익(P), 시각은 한국 시간 기준입니다.</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper>
        <TableContainer>
          <Table size="small" aria-label="오토플레이 실행 기록" sx={{ minWidth: 850 }}>
            <TableHead>
              <TableRow>
                {["게임 종류", "게임 번호", "PNL (P)", "진행 회차", "시작 시각", "종료 시각", "상태"].map((label) => <TableCell key={label}>{label}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={24} aria-label="기록 불러오는 중" /></TableCell></TableRow>
                : error ? <TableRow><TableCell colSpan={7} align="center">기록을 조회할 수 없습니다.</TableCell></TableRow>
                : data.items.length === 0 ? <TableRow><TableCell colSpan={7} align="center">조건에 맞는 오토플레이 기록이 없습니다.</TableCell></TableRow>
                : data.items.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{GAME_LABELS[row.game_type]}</TableCell>
                    <TableCell>
                      <Link component={RouterLink} to={`${row.game_type === "gh" ? "/ghgame/user" : "/nc2game/user"}?slot=1&replayGameId=${row.game_id}`}>
                        {row.game_id}
                      </Link>
                    </TableCell>
                    <TableCell>{Number(row.pnl_actual_p).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</TableCell>
                    <TableCell>{row.round_count}회차</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatTime(row.started_at)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatTime(row.stopped_at)}</TableCell>
                    <TableCell><Chip size="small" label={STATUS_LABELS[row.status]} color={STATUS_COLORS[row.status]} /></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={data.total} page={page} rowsPerPage={pageSize} rowsPerPageOptions={[25, 50, 100]}
          onPageChange={(_, value) => setPage(value)} onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
          labelRowsPerPage="페이지당 기록" labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}건`} />
      </Paper>
    </Box>
  );
}
