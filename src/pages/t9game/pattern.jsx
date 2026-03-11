import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import apiCaller from "@/services/api-caller";

const API_BASE = "/api/v1/patterns";

const ballStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 20,
  borderRadius: "50%",
  color: "#fff",
  fontSize: 11,
  fontWeight: "bold",
  lineHeight: 1,
  marginRight: 0,
};

const PatternBall = ({ text }) => {
  if (!text) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
      {text.split("").map((char, i) => {
        if (char === "P") {
          return (
            <span key={i} style={{ ...ballStyle, backgroundColor: "#1565c0" }}>P</span>
          );
        }
        if (char === "B") {
          return (
            <span key={i} style={{ ...ballStyle, backgroundColor: "#d32f2f" }}>B</span>
          );
        }
        return <span key={i}>{char}</span>;
      })}
    </span>
  );
};

const PickBall = ({ text }) => {
  if (!text) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
      {text.split("").map((char, i) => {
        if (char === "P") {
          return (
            <span key={i} style={{ ...ballStyle, backgroundColor: "#fff", color: "#1565c0", border: "2px solid #1565c0" }}>P</span>
          );
        }
        if (char === "B") {
          return (
            <span key={i} style={{ ...ballStyle, backgroundColor: "#fff", color: "#d32f2f", border: "2px solid #d32f2f" }}>B</span>
          );
        }
        return <span key={i}>{char}</span>;
      })}
    </span>
  );
};

const cellSx = {
  py: 0.5,
  px: 1,
  fontSize: 13,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const headerCellSx = {
  ...cellSx,
  fontWeight: "bold",
  fontSize: 12,
  color: "text.secondary",
  backgroundColor: "background.paper",
  borderBottom: "1px solid rgba(255,255,255,0.15)",
};

export default function PatternPage() {
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSeq, setEditingSeq] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [saving, setSaving] = useState(false);

  const fetchPatterns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiCaller.get(API_BASE);
      const data = res.data?.data ?? res.data ?? [];
      const sorted = [...data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setPatterns(sorted);
    } catch (err) {
      console.error("Failed to fetch patterns:", err);
      setSnackbar({ open: true, message: "패턴 목록을 불러오지 못했습니다.", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  const handleEditStart = (row) => {
    setEditingSeq(row.pat_seq);
    setEditValues({
      pattern: row.pattern ?? "",
      pick: row.pick ?? "",
      order: row.order ?? 0,
    });
  };

  const handleEditCancel = () => {
    setEditingSeq(null);
    setEditValues({});
  };

  const handleEditChange = (field, value) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!editingSeq) return;
    try {
      setSaving(true);
      await apiCaller.put(`${API_BASE}/${editingSeq}`, {
        pattern: editValues.pattern,
        pick: editValues.pick,
        order: Number(editValues.order),
      });
      setSnackbar({ open: true, message: "저장되었습니다.", severity: "success" });
      setEditingSeq(null);
      setEditValues({});
      await fetchPatterns();
    } catch (err) {
      console.error("Failed to save pattern:", err);
      setSnackbar({ open: true, message: "저장에 실패했습니다.", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (row) => {
    setDeleteTarget(row);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await apiCaller.delete(`${API_BASE}/${deleteTarget.pat_seq}`);
      setSnackbar({ open: true, message: "삭제되었습니다.", severity: "success" });
      setDeleteTarget(null);
      await fetchPatterns();
    } catch (err) {
      console.error("Failed to delete pattern:", err);
      setSnackbar({ open: true, message: "삭제에 실패했습니다.", severity: "error" });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteTarget(null);
  };

  const handleMove = async (index, direction) => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= patterns.length) return;
    const current = patterns[index];
    const target = patterns[targetIdx];
    try {
      await Promise.all([
        apiCaller.put(`${API_BASE}/${current.pat_seq}`, { order: target.order }),
        apiCaller.put(`${API_BASE}/${target.pat_seq}`, { order: current.order }),
      ]);
      await fetchPatterns();
    } catch (err) {
      console.error("Failed to move pattern:", err);
      setSnackbar({ open: true, message: "순서 변경에 실패했습니다.", severity: "error" });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold", fontSize: 18 }}>
        패턴 관리
      </Typography>

      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ width: "auto" }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...headerCellSx, width: 60 }}>순서</TableCell>
              <TableCell sx={{ ...headerCellSx, width: 60 }}>번호</TableCell>
              <TableCell sx={{ ...headerCellSx, pr: "10px" }}>패턴</TableCell>
              <TableCell sx={{ ...headerCellSx, pl: 0 }}>픽</TableCell>
              <TableCell sx={{ ...headerCellSx, width: 120, textAlign: "center" }}>수정 / 삭제</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {patterns.map((row) => {
              const isEditing = editingSeq === row.pat_seq;
              return (
                <TableRow
                  key={row.pat_seq}
                  hover
                  sx={{
                    "&:hover": { backgroundColor: "rgba(255,255,255,0.03)" },
                  }}
                >
                  {/* 순서 (order) */}
                  <TableCell sx={cellSx}>
                    {isEditing ? (
                      <TextField
                        type="number"
                        size="small"
                        value={editValues.order}
                        onChange={(e) => handleEditChange("order", e.target.value)}
                        variant="outlined"
                        sx={{ width: 60 }}
                        inputProps={{ style: { fontSize: 13, padding: "4px 8px" } }}
                      />
                    ) : (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
                        <span>{row.order}</span>
                        <IconButton
                          size="small"
                          onClick={() => handleMove(patterns.indexOf(row), "up")}
                          disabled={patterns.indexOf(row) === 0}
                          sx={{ p: 0.2 }}
                          aria-label="위로"
                        >
                          <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleMove(patterns.indexOf(row), "down")}
                          disabled={patterns.indexOf(row) === patterns.length - 1}
                          sx={{ p: 0.2 }}
                          aria-label="아래로"
                        >
                          <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    )}
                  </TableCell>

                  {/* 번호 (pat_seq) */}
                  <TableCell sx={cellSx}>{row.pat_seq}</TableCell>

                  {/* 패턴 (pattern) */}
                  <TableCell sx={{ ...cellSx, pr: "10px" }}>
                    {isEditing ? (
                      <TextField
                        size="small"
                        value={editValues.pattern}
                        onChange={(e) => handleEditChange("pattern", e.target.value)}
                        variant="outlined"
                        fullWidth
                        inputProps={{ style: { fontSize: 13, padding: "4px 8px" } }}
                      />
                    ) : (
                      <PatternBall text={row.pattern} />
                    )}
                  </TableCell>

                  {/* 픽 (pick) */}
                  <TableCell sx={{ ...cellSx, pl: 0 }}>
                    {isEditing ? (
                      <TextField
                        size="small"
                        value={editValues.pick}
                        onChange={(e) => handleEditChange("pick", e.target.value)}
                        variant="outlined"
                        sx={{ width: 70 }}
                        inputProps={{ style: { fontSize: 13, padding: "4px 8px" } }}
                      />
                    ) : (
                      <PickBall text={row.pick} />
                    )}
                  </TableCell>

                  {/* 수정 / 삭제 */}
                  <TableCell sx={{ ...cellSx, textAlign: "center" }}>
                    {isEditing ? (
                      <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5 }}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={handleSave}
                          disabled={saving}
                          aria-label="저장"
                        >
                          <SaveIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="default"
                          onClick={handleEditCancel}
                          disabled={saving}
                          aria-label="취소"
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ) : (
                      <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleEditStart(row)}
                          aria-label="수정"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(row)}
                          aria-label="삭제"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteTarget} onClose={handleDeleteCancel}>
        <DialogTitle>패턴 삭제</DialogTitle>
        <DialogContent>
          <DialogContentText>
            패턴 #{deleteTarget?.pat_seq} ({deleteTarget?.pattern})을 삭제하시겠습니까?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>취소</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* 알림 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
