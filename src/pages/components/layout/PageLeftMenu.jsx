import { useState, useEffect } from "react";
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

import InfoIcon from "@mui/icons-material/Info";
import PublicIcon from "@mui/icons-material/Public";
import StarIcon from "@mui/icons-material/Star";
import HomeIcon from "@mui/icons-material/Home";
import PeopleIcon from "@mui/icons-material/People";
import SettingsIcon from "@mui/icons-material/Settings";
import ConstructionIcon from "@mui/icons-material/Construction";
import LogoutIcon from "@mui/icons-material/Logout";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";

import { useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { userAtom, logoutAtom } from "@/store/auth-store";
import { blockedGamesAtom, fetchBlockedGamesAtom } from "@/store/app-settings-store";
import autoService from "@/services/auto-service";
import { emergencyStopResultMessage } from "@/utils/emergency-stop-result";

function PageLeftMenu({ isMobile, onMenuClose }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const user = useAtomValue(userAtom);
  const logout = useSetAtom(logoutAtom);
  const blockedGames = useAtomValue(blockedGamesAtom);
  const fetchBlocked = useSetAtom(fetchBlockedGamesAtom);
  const [popupOpen, setPopupOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyBusy, setEmergencyBusy] = useState(false);
  const [emergencyResult, setEmergencyResult] = useState(null);
  const [emergencyError, setEmergencyError] = useState("");

  useEffect(() => {
    fetchBlocked();
  }, [fetchBlocked]);

  const handleNavClick = (path) => {
    navigate(path);
    if (isMobile && onMenuClose) onMenuClose();
  };

  const handleUserGameClick = (gameKey, path) => {
    if (blockedGames.includes(gameKey)) {
      setPopupOpen(true);
      if (isMobile && onMenuClose) onMenuClose();
    } else {
      handleNavClick(path);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const openEmergencyStop = () => {
    setEmergencyResult(null);
    setEmergencyError("");
    setEmergencyOpen(true);
  };

  const handleEmergencyStop = async () => {
    if (emergencyBusy) return;
    setEmergencyBusy(true);
    setEmergencyError("");
    try {
      setEmergencyResult(await autoService.emergencyStop());
    } catch (error) {
      setEmergencyError(
        error.response?.data?.detail?.error === "auto_stop_dispatch_failed"
          ? "오토 실행 서버에 정지 명령을 전달하지 못했습니다. 잠시 후 다시 시도해 주세요."
          : "전체 비상정지 요청을 처리하지 못했습니다.",
      );
    } finally {
      setEmergencyBusy(false);
    }
  };

  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        display: "flex",
        flexDirection: "column",
        backgroundColor: theme.palette.background.leftMenu,
        "& .MuiListItemIcon-root": {
          color: "military.text",
        },
        "& .MuiListItemText-primary": {
          color: "text.primary",
        },
        "& .MuiListItemButton-root": {
          "&:hover": {
            backgroundColor: "military.hover",
          },
        },
      }}
    >
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={() => handleNavClick("/")}>
            <ListItemIcon><HomeIcon /></ListItemIcon>
            <ListItemText primary="Home" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={() => handleNavClick("/info")}>
            <ListItemIcon><InfoIcon /></ListItemIcon>
            <ListItemText primary="Info" />
          </ListItemButton>
        </ListItem>
      </List>
      <Divider sx={{ bgcolor: "military.border", my: 1 }} />
      {user?.role === "admin" ? (
        <>
          {/* 나이스초이스2 */}
          <List dense>
            <ListItem disablePadding>
              <ListItemButton disabled sx={{ pb: 0 }}>
                <ListItemIcon><StarIcon /></ListItemIcon>
                <ListItemText primary="트리플나인" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/nc2game/user")} sx={{ pl: 7 }}>
                <ListItemText primary="유저" primaryTypographyProps={{ fontSize: "0.85rem" }} />
              </ListItemButton>
            </ListItem>
          </List>
          <Divider sx={{ bgcolor: "military.border", my: 1 }} />
          {/* 글로벌히트 */}
          <List dense>
            <ListItem disablePadding>
              <ListItemButton disabled sx={{ pb: 0 }}>
                <ListItemIcon><PublicIcon /></ListItemIcon>
                <ListItemText primary="글로벌히트" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/ghgame")} sx={{ pl: 7 }}>
                <ListItemText primary="어드민" primaryTypographyProps={{ fontSize: "0.85rem" }} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/ghgame/user")} sx={{ pl: 7 }}>
                <ListItemText primary="유저" primaryTypographyProps={{ fontSize: "0.85rem" }} />
              </ListItemButton>
            </ListItem>
          </List>
        </>
      ) : (
        <>
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleUserGameClick("nc2", "/nc2game/user")}>
                <ListItemIcon><StarIcon /></ListItemIcon>
                <ListItemText primary="트리플나인" />
              </ListItemButton>
            </ListItem>
          </List>
          <Divider sx={{ bgcolor: "military.border", my: 1 }} />
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleUserGameClick("gh", "/ghgame/user")}>
                <ListItemIcon><PublicIcon /></ListItemIcon>
                <ListItemText primary="글로벌히트" />
              </ListItemButton>
            </ListItem>
          </List>
        </>
      )}
      {user?.role === "admin" && (
        <>
          <Divider sx={{ bgcolor: "military.border", my: 1 }} />
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/users")}>
                <ListItemIcon><PeopleIcon /></ListItemIcon>
                <ListItemText primary="사용자 관리" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/app-settings")}>
                <ListItemIcon><SettingsIcon /></ListItemIcon>
                <ListItemText primary="앱 설정" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/maintenance-admin")}>
                <ListItemIcon><ConstructionIcon /></ListItemIcon>
                <ListItemText primary="점검 관리" />
              </ListItemButton>
            </ListItem>
          </List>
        </>
      )}
      <Dialog
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        PaperProps={{ sx: { backgroundColor: "background.paper", border: "1px solid #333", minWidth: 320, textAlign: "center" } }}
      >
        <DialogTitle sx={{ color: "text.primary", fontWeight: 600 }}>준비중입니다</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "text.secondary" }}>현재 이 게임은 이용할 수 없습니다.</Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
          <Button variant="contained" onClick={() => setPopupOpen(false)} sx={{ backgroundColor: "#2e7d32", "&:hover": { backgroundColor: "#1b5e20" } }}>
            확인
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={emergencyOpen}
        onClose={emergencyBusy ? undefined : () => setEmergencyOpen(false)}
        PaperProps={{ sx: { backgroundColor: "background.paper", border: "1px solid #d32f2f", minWidth: 340 } }}
      >
        <DialogTitle sx={{ color: "#f44336", fontWeight: 800 }}>전체 비상정지</DialogTitle>
        <DialogContent>
          {emergencyResult ? (
            <Typography sx={{ color: emergencyResult.failed || emergencyResult.worker_failed || emergencyResult.discovery_failed ? "#ff9800" : "text.primary" }}>
              {emergencyStopResultMessage(emergencyResult)}
            </Typography>
          ) : (
            <Typography sx={{ color: "text.primary" }}>
              현재 계정의 글로벌히트·나이스초이스 전체 슬롯 오토를 모두 정지하시겠습니까?
            </Typography>
          )}
          {emergencyError && <Typography sx={{ color: "#f44336", mt: 1 }}>{emergencyError}</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {emergencyResult ? (
            <Button onClick={() => setEmergencyOpen(false)} variant="contained">확인</Button>
          ) : (
            <>
              <Button onClick={() => setEmergencyOpen(false)} disabled={emergencyBusy}>취소</Button>
              <Button
                onClick={handleEmergencyStop}
                disabled={emergencyBusy}
                variant="contained"
                color="error"
              >
                {emergencyBusy ? "정지 중..." : "모두 정지"}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
      <Box sx={{ mt: "auto", p: 1.5 }}>
        <Divider sx={{ bgcolor: "military.border", mb: 1.5 }} />
        {user && (
          <Box sx={{ px: 1, mb: 1 }}>
            <Box sx={{ color: "#888", fontSize: "0.75rem" }}>{user.nickname || user.username}</Box>
          </Box>
        )}
        <Button
          fullWidth
          variant="contained"
          color="error"
          startIcon={<ReportProblemIcon />}
          onClick={openEmergencyStop}
          sx={{ mb: 1, fontWeight: 800 }}
        >
          전체 비상정지
        </Button>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{
            color: "#999",
            borderColor: "#555",
            textTransform: "none",
            fontSize: "0.85rem",
            "&:hover": {
              borderColor: "#f44336",
              color: "#f44336",
              backgroundColor: "rgba(244, 67, 54, 0.04)",
            },
          }}
        >
          로그아웃
        </Button>
      </Box>
    </Box>
  );
}

export default PageLeftMenu;
