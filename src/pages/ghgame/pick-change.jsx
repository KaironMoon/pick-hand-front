import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, useBlocker } from "react-router-dom";
import { Box, Typography, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import apiCaller from "@/services/api-caller.js";
import { USER_BET_SETTINGS_API } from "@/constants/api-url.js";

const GREEN = "#4caf50";
const RED = "#f44336";
const BLUE = "#1565c0";

const PC_ROWS = 20;
const PPC_ROWS = 10;
const PATTERN_LEN = 15;

const newRow = () => ({ pattern: Array(PATTERN_LEN).fill(""), miss: null, pick: "P" });

// 토글 함수
const togglePatternCell = (val) => {
  if (val === "P") return "B";
  if (val === "B") return "";
  return "P";
};

// PICK Change MISS: 사용안함 → 1 → 2 → ... → 10 → 사용안함
const toggleMissPC = (val) => {
  if (val === null || val === undefined) return 1;
  if (val >= 10) return null;
  return val + 1;
};

// Pattern PICK Change MISS: 사용안함 → 0 → 1 → ... → 10 → 사용안함
const toggleMissPPC = (val) => {
  if (val === null || val === undefined) return 0;
  if (val >= 10) return null;
  return val + 1;
};

const togglePick = (val) => (val === "P" ? "B" : "P");

const cellSx = {
  width: 26,
  height: 26,
  border: "1px solid #555",
  borderRadius: 0.5,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  userSelect: "none",
  fontSize: 11,
  fontWeight: "bold",
  "&:hover": { opacity: 0.8 },
};

const missCellSx = {
  ...cellSx,
  width: 56,
  fontSize: 10,
};

const PatternCell = ({ value, onClick }) => {
  let bg = "transparent";
  let color = "#888";
  let label = "";
  if (value === "P") {
    bg = BLUE;
    color = "#fff";
    label = "P";
  } else if (value === "B") {
    bg = RED;
    color = "#fff";
    label = "B";
  }
  return (
    <Box onClick={onClick} sx={{ ...cellSx, backgroundColor: bg, color }}>
      {label}
    </Box>
  );
};

const MissCell = ({ value, onClick }) => {
  const label = value === null || value === undefined ? "사용안함" : `${value}Miss`;
  const active = value !== null && value !== undefined;
  return (
    <Box onClick={onClick} sx={{ ...missCellSx, backgroundColor: active ? "#37474f" : "transparent", color: active ? "#fff" : "#888" }}>
      {label}
    </Box>
  );
};

const PickCell = ({ value, onClick }) => {
  const bg = value === "P" ? BLUE : RED;
  return (
    <Box onClick={onClick} sx={{ ...cellSx, backgroundColor: bg, color: "#fff" }}>
      {value}
    </Box>
  );
};

function Section({ title, rows, setRows, missToggler, isPC }) {
  const updateRow = (idx, patch) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const updatePattern = (idx, ci) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = [...r.pattern];
        next[ci] = togglePatternCell(next[ci]);
        return { ...r, pattern: next };
      }),
    );
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1, color: "#fff" }}>{title}</Typography>
      <Box sx={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: "2px" }}>
          <thead>
            <tr>
              <th style={{ width: 30, color: "#888", fontSize: 11 }}>#</th>
              {Array.from({ length: PATTERN_LEN }, (_, i) => (
                <th key={i} style={{ width: 26, color: "#888", fontSize: 10 }}>{i + 1}</th>
              ))}
              <th style={{ width: 56, color: "#888", fontSize: 11 }}>MISS</th>
              <th style={{ width: 30, color: "#888", fontSize: 11 }}>Pick</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td style={{ textAlign: "center", color: "#888", fontSize: 11 }}>{idx + 1}</td>
                {row.pattern.map((v, ci) => (
                  <td key={ci}><PatternCell value={v} onClick={() => updatePattern(idx, ci)} /></td>
                ))}
                <td><MissCell value={row.miss} onClick={() => updateRow(idx, { miss: missToggler(row.miss) })} /></td>
                <td><PickCell value={row.pick} onClick={() => updateRow(idx, { pick: togglePick(row.pick) })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </Box>
  );
}

export default function GhPickChangePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [config, setConfig] = useState(null);
  const [pcRows, setPcRows] = useState(() => Array.from({ length: PC_ROWS }, newRow));
  const [ppcRows, setPpcRows] = useState(() => Array.from({ length: PPC_ROWS }, newRow));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });
  const [exitDialog, setExitDialog] = useState(false);

  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    apiCaller.get(USER_BET_SETTINGS_API.GET("gh")).then((res) => {
      const cfg = res.data.config || {};
      setConfig(cfg);
      const pc = cfg.pick_change || [];
      const ppc = cfg.pattern_pick_change || [];
      setPcRows(Array.from({ length: PC_ROWS }, (_, i) => pc[i] ? { pattern: [...(pc[i].pattern || Array(PATTERN_LEN).fill(""))], miss: pc[i].miss ?? null, pick: pc[i].pick || "P" } : newRow()));
      setPpcRows(Array.from({ length: PPC_ROWS }, (_, i) => ppc[i] ? { pattern: [...(ppc[i].pattern || Array(PATTERN_LEN).fill(""))], miss: ppc[i].miss ?? null, pick: ppc[i].pick || "P" } : newRow()));
    }).catch(() => {});
  }, []);

  // Wrap setters to track dirty
  const updatePc = (next) => {
    setPcRows(next);
    setDirty(true);
  };
  const updatePpc = (next) => {
    setPpcRows(next);
    setDirty(true);
  };

  // 패턴 검증: P/B는 연속이어야 함 (중간 빈칸 금지)
  const isContiguous = (pattern) => {
    const indices = pattern.map((c, i) => (c === "P" || c === "B" ? i : -1)).filter((i) => i !== -1);
    if (indices.length === 0) return true;  // 전체 빈칸은 OK (사용 안함)
    return indices[indices.length - 1] - indices[0] + 1 === indices.length;
  };

  const findInvalidRow = (rows, sectionLabel) => {
    for (let i = 0; i < rows.length; i++) {
      if (!isContiguous(rows[i].pattern)) {
        return `${sectionLabel} ${i + 1}행: 패턴 중간에 빈칸이 있습니다 (P/B는 연속이어야 함)`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!dirty || !config) return;
    // 검증
    const err = findInvalidRow(pcRows, "PICK Change") || findInvalidRow(ppcRows, "Pattern PICK Change");
    if (err) {
      setSnack({ open: true, message: err, severity: "error" });
      return;
    }
    setSaving(true);
    try {
      const merged = { ...config, pick_change: pcRows, pattern_pick_change: ppcRows };
      const res = await apiCaller.put(USER_BET_SETTINGS_API.SAVE("gh"), { config: merged });
      setConfig(res.data.config);
      setDirty(false);
      setSnack({ open: true, message: "저장되었습니다.", severity: "success" });
    } catch (err) {
      setSnack({ open: true, message: err?.response?.data?.detail || "저장 실패", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    const gid = searchParams.get("gameId");
    navigate(gid ? `/ghgame/user?gameId=${gid}` : "/ghgame/user");
  };

  // dirty 상태일 때 useBlocker가 navigate 차단 → 다이얼로그 표시
  useEffect(() => {
    if (blocker.state === "blocked") {
      setExitDialog(true);
    }
  }, [blocker.state]);

  const handleExitConfirm = () => {
    setExitDialog(false);
    if (blocker.state === "blocked") {
      blocker.proceed();
    }
  };

  const handleExitCancel = () => {
    setExitDialog(false);
    if (blocker.state === "blocked") {
      blocker.reset();
    }
  };

  if (!config) return <Box sx={{ p: 2, color: "#888" }}>불러오는 중...</Box>;

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Box onClick={handleBack}
          sx={{ display: "inline-flex", alignItems: "center", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1, px: 1.5, py: 0.5, cursor: "pointer", "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" } }}>
          <Typography variant="caption" sx={{ fontSize: 12 }}>&larr; 뒤로가기</Typography>
        </Box>
        <Box onClick={handleSave}
          sx={{ display: "inline-flex", alignItems: "center", border: `1px solid ${dirty ? GREEN : "rgba(255,255,255,0.2)"}`, borderRadius: 1, px: 1.5, py: 0.5, cursor: dirty ? "pointer" : "default", backgroundColor: dirty ? GREEN : "transparent", color: dirty ? "#fff" : "#666", opacity: saving ? 0.5 : 1 }}>
          <Typography variant="caption" sx={{ fontSize: 12, fontWeight: "bold" }}>{saving ? "저장 중..." : "저장"}</Typography>
        </Box>
      </Box>

      <Section title="PICK Change" rows={pcRows} setRows={updatePc} missToggler={toggleMissPC} isPC />
      <Section title="Pattern PICK Change" rows={ppcRows} setRows={updatePpc} missToggler={toggleMissPPC} />

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>{snack.message}</Alert>
      </Snackbar>

      <Dialog open={exitDialog} onClose={handleExitCancel}>
        <DialogTitle>저장하지 않은 변경사항이 있습니다</DialogTitle>
        <DialogContent>
          <Typography>변경사항이 사라집니다. 정말 나가시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleExitCancel}>취소</Button>
          <Button onClick={handleExitConfirm} color="error">나가기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
