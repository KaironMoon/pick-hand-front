import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { Box, TextField, Button, Typography, Paper, CircularProgress } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { loginAtom } from "@/store/auth-store";

function LoginPage() {
  const navigate = useNavigate();
  const login = useSetAtom(loginAtom);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      await login({ username, password });
      navigate("/", { replace: true });
    } catch (err) {
      const message =
        err.response?.data?.detail || err.response?.data?.message || "로그인에 실패했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#000",
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: 4,
          width: 380,
          maxWidth: "90vw",
          backgroundColor: "#1a1a1a",
          border: "1px solid #3a3a3a",
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 3 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              backgroundColor: "#2e7d32",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 1.5,
            }}
          >
            <LockOutlinedIcon sx={{ color: "#fff", fontSize: 28 }} />
          </Box>
          <Typography variant="h5" sx={{ color: "#fff", fontWeight: 600 }}>
            Pick Hand
          </Typography>
          <Typography variant="body2" sx={{ color: "#888", mt: 0.5 }}>
            로그인이 필요합니다
          </Typography>
        </Box>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            fullWidth
            label="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            sx={{
              mb: 2,
              "& .MuiOutlinedInput-root": {
                color: "#fff",
                "& fieldset": { borderColor: "#555" },
                "&:hover fieldset": { borderColor: "#2e7d32" },
                "&.Mui-focused fieldset": { borderColor: "#4caf50" },
              },
              "& .MuiInputLabel-root": { color: "#888" },
              "& .MuiInputLabel-root.Mui-focused": { color: "#4caf50" },
            }}
          />
          <TextField
            fullWidth
            label="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            sx={{
              mb: 2,
              "& .MuiOutlinedInput-root": {
                color: "#fff",
                "& fieldset": { borderColor: "#555" },
                "&:hover fieldset": { borderColor: "#2e7d32" },
                "&.Mui-focused fieldset": { borderColor: "#4caf50" },
              },
              "& .MuiInputLabel-root": { color: "#888" },
              "& .MuiInputLabel-root.Mui-focused": { color: "#4caf50" },
            }}
          />

          {error && (
            <Typography
              variant="body2"
              sx={{
                color: "#f44336",
                mb: 2,
                textAlign: "center",
                backgroundColor: "rgba(244, 67, 54, 0.08)",
                py: 1,
                px: 2,
                borderRadius: 1,
              }}
            >
              {error}
            </Typography>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{
              py: 1.2,
              backgroundColor: "#2e7d32",
              fontWeight: 600,
              fontSize: "1rem",
              "&:hover": { backgroundColor: "#1b5e20" },
              "&.Mui-disabled": { backgroundColor: "#1a3a1a", color: "#666" },
            }}
          >
            {loading ? <CircularProgress size={24} sx={{ color: "#4caf50" }} /> : "로그인"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

export default LoginPage;
