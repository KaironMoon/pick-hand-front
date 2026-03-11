import { useState, useEffect, useCallback } from "react";
import { useAtomValue } from "jotai";
import { useTheme } from "@mui/material/styles";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Chip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { userAtom } from "@/store/auth-store";
import apiCaller from "@/services/api-caller";
import { USERS_API } from "@/constants/api-url";

function UsersPage() {
  const theme = useTheme();
  const currentUser = useAtomValue(userAtom);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ username: "", password: "", nickname: "" });
  const [addError, setAddError] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ nickname: "", password: "", is_active: true });
  const [editError, setEditError] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiCaller.get(USERS_API.BASE);
      setUsers(response.data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (currentUser?.role !== "admin") {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ color: "#f44336" }}>
          관리자만 접근할 수 있습니다.
        </Typography>
      </Box>
    );
  }

  const handleAddSubmit = async () => {
    setAddError("");
    if (!addForm.username.trim() || !addForm.password.trim()) {
      setAddError("아이디와 비밀번호는 필수입니다.");
      return;
    }
    try {
      await apiCaller.post(USERS_API.BASE, addForm);
      setAddOpen(false);
      setAddForm({ username: "", password: "", nickname: "" });
      fetchUsers();
    } catch (err) {
      setAddError(err.response?.data?.detail || "사용자 추가에 실패했습니다.");
    }
  };

  const handleEditOpen = (user) => {
    setEditUser(user);
    setEditForm({ nickname: user.nickname || "", password: "", is_active: user.is_active });
    setEditError("");
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    setEditError("");
    const payload = { nickname: editForm.nickname, is_active: editForm.is_active };
    if (editForm.password.trim()) {
      payload.password = editForm.password;
    }
    try {
      await apiCaller.put(USERS_API.DETAIL(editUser.id), payload);
      setEditOpen(false);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      setEditError(err.response?.data?.detail || "수정에 실패했습니다.");
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await apiCaller.delete(USERS_API.DETAIL(deleteTarget.id));
      setDeleteOpen(false);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      console.error("Failed to delete user:", err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  const isDark = theme.palette.mode === "dark";
  const borderColor = isDark ? "#333" : "#c0c0c0";
  const hoverBg = isDark ? "#252525" : "#e8e8e8";
  const cellSx = { color: "text.primary", borderBottom: `1px solid ${borderColor}` };
  const headerCellSx = { color: "#4caf50", fontWeight: 700, borderBottom: "2px solid #4caf50" };

  const dialogPaperSx = {
    backgroundColor: "background.paper",
    border: `1px solid ${borderColor}`,
    minWidth: 360,
  };

  const dialogFieldSx = {
    "& .MuiOutlinedInput-root": {
      color: "text.primary",
      "& fieldset": { borderColor },
      "&:hover fieldset": { borderColor: "#2e7d32" },
      "&.Mui-focused fieldset": { borderColor: "#4caf50" },
    },
    "& .MuiInputLabel-root": { color: "text.secondary" },
    "& .MuiInputLabel-root.Mui-focused": { color: "#4caf50" },
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" sx={{ color: "text.primary", fontWeight: 600 }}>
          사용자 관리
        </Typography>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => {
            setAddForm({ username: "", password: "", nickname: "" });
            setAddError("");
            setAddOpen(true);
          }}
          sx={{
            backgroundColor: "#2e7d32",
            "&:hover": { backgroundColor: "#1b5e20" },
          }}
        >
          사용자 추가
        </Button>
      </Box>

      <TableContainer
        component={Paper}
        sx={{ backgroundColor: "background.paper", border: `1px solid ${borderColor}`, maxWidth: 900 }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headerCellSx}>아이디</TableCell>
              <TableCell sx={headerCellSx}>닉네임</TableCell>
              <TableCell sx={headerCellSx}>권한</TableCell>
              <TableCell sx={headerCellSx}>상태</TableCell>
              <TableCell sx={headerCellSx}>생성일</TableCell>
              <TableCell sx={headerCellSx} align="center">관리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ ...cellSx, textAlign: "center", py: 4 }}>
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ ...cellSx, textAlign: "center", py: 4 }}>
                  등록된 사용자가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} hover sx={{ "&:hover": { backgroundColor: hoverBg } }}>
                  <TableCell sx={cellSx}>{user.username}</TableCell>
                  <TableCell sx={cellSx}>{user.nickname || "-"}</TableCell>
                  <TableCell sx={cellSx}>
                    <Chip
                      label={user.role}
                      size="small"
                      sx={{
                        backgroundColor: user.role === "admin" ? "#2e7d32" : "#777",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "0.75rem",
                      }}
                    />
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Chip
                      label={user.is_active ? "활성" : "비활성"}
                      size="small"
                      sx={{
                        backgroundColor: user.is_active ? "#1b5e20" : "#7f0000",
                        color: "#fff",
                        fontSize: "0.75rem",
                      }}
                    />
                  </TableCell>
                  <TableCell sx={cellSx}>{formatDate(user.created_at)}</TableCell>
                  <TableCell sx={{ ...cellSx, textAlign: "center" }}>
                    <IconButton size="small" onClick={() => handleEditOpen(user)} sx={{ color: "#4caf50" }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setDeleteTarget(user);
                        setDeleteOpen(true);
                      }}
                      sx={{ color: "#f44336", ml: 0.5 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add User Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={{ color: "text.primary" }}>사용자 추가</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth label="아이디" value={addForm.username}
            onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
            margin="dense" sx={dialogFieldSx}
          />
          <TextField
            fullWidth label="비밀번호" type="password" value={addForm.password}
            onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
            margin="dense" sx={dialogFieldSx}
          />
          <TextField
            fullWidth label="닉네임" value={addForm.nickname}
            onChange={(e) => setAddForm((f) => ({ ...f, nickname: e.target.value }))}
            margin="dense" sx={dialogFieldSx}
          />
          {addError && (
            <Typography variant="body2" sx={{ color: "#f44336", mt: 1 }}>{addError}</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOpen(false)} sx={{ color: "text.secondary" }}>취소</Button>
          <Button onClick={handleAddSubmit} variant="contained"
            sx={{ backgroundColor: "#2e7d32", "&:hover": { backgroundColor: "#1b5e20" } }}>추가</Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={{ color: "text.primary" }}>사용자 수정 - {editUser?.username}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth label="닉네임" value={editForm.nickname}
            onChange={(e) => setEditForm((f) => ({ ...f, nickname: e.target.value }))}
            margin="dense" sx={dialogFieldSx}
          />
          <TextField
            fullWidth label="새 비밀번호 (변경 시에만 입력)" type="password" value={editForm.password}
            onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
            margin="dense" sx={dialogFieldSx}
          />
          <FormControlLabel
            control={
              <Switch checked={editForm.is_active}
                onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                sx={{
                  "& .MuiSwitch-switchBase.Mui-checked": { color: "#4caf50" },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#2e7d32" },
                }}
              />
            }
            label="활성 상태" sx={{ mt: 1, color: "text.secondary" }}
          />
          {editError && (
            <Typography variant="body2" sx={{ color: "#f44336", mt: 1 }}>{editError}</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ color: "text.secondary" }}>취소</Button>
          <Button onClick={handleEditSubmit} variant="contained"
            sx={{ backgroundColor: "#2e7d32", "&:hover": { backgroundColor: "#1b5e20" } }}>저장</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}
        PaperProps={{ sx: { backgroundColor: "background.paper", border: `1px solid ${borderColor}` } }}>
        <DialogTitle sx={{ color: "text.primary" }}>사용자 삭제</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "text.primary" }}>
            <strong style={{ color: "#f44336" }}>{deleteTarget?.username}</strong> 사용자를 삭제하시겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={{ color: "text.secondary" }}>취소</Button>
          <Button onClick={handleDeleteConfirm} variant="contained"
            sx={{ backgroundColor: "#d32f2f", "&:hover": { backgroundColor: "#b71c1c" } }}>삭제</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default UsersPage;
