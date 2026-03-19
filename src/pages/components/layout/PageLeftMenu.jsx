import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, Button } from "@mui/material";
import { useTheme } from "@mui/material/styles";

import InfoIcon from "@mui/icons-material/Info";
import ViewListIcon from "@mui/icons-material/ViewList";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import HiveIcon from "@mui/icons-material/Hive";
import HomeIcon from "@mui/icons-material/Home";
import PeopleIcon from "@mui/icons-material/People";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";

import { useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { userAtom, logoutAtom } from "@/store/auth-store";

function PageLeftMenu({ isMobile, onMenuClose }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const user = useAtomValue(userAtom);
  const logout = useSetAtom(logoutAtom);

  const handleNavClick = (path) => {
    navigate(path);
    if (isMobile && onMenuClose) onMenuClose();
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <Box
      sx={{
        height: "100%",
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
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={() => handleNavClick(user?.role === "admin" ? `/t9game?new=${Date.now()}` : `/t9game/user?new=${Date.now()}`)}>
            <ListItemIcon><SportsEsportsIcon /></ListItemIcon>
            <ListItemText primary="트리플나인" />
          </ListItemButton>
        </ListItem>
        {user?.role === "admin" && (
          <ListItem disablePadding>
            <ListItemButton onClick={() => handleNavClick("/patterns")}>
              <ListItemIcon><ViewListIcon /></ListItemIcon>
              <ListItemText primary="패턴 관리" />
            </ListItemButton>
          </ListItem>
        )}
      </List>
      <Divider sx={{ bgcolor: "military.border", my: 1 }} />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={() => handleNavClick(`/hbgame?new=${Date.now()}`)}>
            <ListItemIcon><HiveIcon /></ListItemIcon>
            <ListItemText primary="허니비" />
          </ListItemButton>
        </ListItem>
        {user?.role === "admin" && (
          <ListItem disablePadding>
            <ListItemButton onClick={() => handleNavClick("/hbgame/setup")}>
              <ListItemIcon><SettingsIcon /></ListItemIcon>
              <ListItemText primary="허니비 설정" />
            </ListItemButton>
          </ListItem>
        )}
      </List>
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
          </List>
        </>
      )}
      <Box sx={{ mt: "auto", p: 1.5 }}>
        <Divider sx={{ bgcolor: "military.border", mb: 1.5 }} />
        {user && (
          <Box sx={{ px: 1, mb: 1 }}>
            <Box sx={{ color: "#888", fontSize: "0.75rem" }}>{user.nickname || user.username}</Box>
          </Box>
        )}
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
