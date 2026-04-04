import { useState, useEffect } from "react";
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

import InfoIcon from "@mui/icons-material/Info";
import ViewListIcon from "@mui/icons-material/ViewList";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import HiveIcon from "@mui/icons-material/Hive";
import PublicIcon from "@mui/icons-material/Public";
import StarIcon from "@mui/icons-material/Star";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import HomeIcon from "@mui/icons-material/Home";
import PeopleIcon from "@mui/icons-material/People";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";

import { useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { userAtom, logoutAtom } from "@/store/auth-store";
import { blockedGamesAtom, fetchBlockedGamesAtom } from "@/store/app-settings-store";

function PageLeftMenu({ isMobile, onMenuClose }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const user = useAtomValue(userAtom);
  const logout = useSetAtom(logoutAtom);
  const blockedGames = useAtomValue(blockedGamesAtom);
  const fetchBlocked = useSetAtom(fetchBlockedGamesAtom);
  const [popupOpen, setPopupOpen] = useState(false);

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
      {user?.role === "admin" ? (
        <>
          {/* 트리플나인 */}
          <List dense>
            <ListItem disablePadding>
              <ListItemButton disabled sx={{ pb: 0 }}>
                <ListItemIcon><SportsEsportsIcon /></ListItemIcon>
                <ListItemText primary="트리플나인" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/t9game")} sx={{ pl: 7 }}>
                <ListItemText primary="어드민" primaryTypographyProps={{ fontSize: "0.85rem" }} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/t9game/user")} sx={{ pl: 7 }}>
                <ListItemText primary="유저" primaryTypographyProps={{ fontSize: "0.85rem" }} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/patterns")} sx={{ pl: 7 }}>
                <ListItemText primary="패턴 관리" primaryTypographyProps={{ fontSize: "0.85rem" }} />
              </ListItemButton>
            </ListItem>
          </List>
          <Divider sx={{ bgcolor: "military.border", my: 1 }} />
          {/* 허니비 */}
          <List dense>
            <ListItem disablePadding>
              <ListItemButton disabled sx={{ pb: 0 }}>
                <ListItemIcon><HiveIcon /></ListItemIcon>
                <ListItemText primary="허니비" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/hbgame")} sx={{ pl: 7 }}>
                <ListItemText primary="어드민" primaryTypographyProps={{ fontSize: "0.85rem" }} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/hbgame/user")} sx={{ pl: 7 }}>
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
          <Divider sx={{ bgcolor: "military.border", my: 1 }} />
          {/* 나이스초이스 */}
          <List dense>
            <ListItem disablePadding>
              <ListItemButton disabled sx={{ pb: 0 }}>
                <ListItemIcon><StarIcon /></ListItemIcon>
                <ListItemText primary="나이스초이스" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/ncgame")} sx={{ pl: 7 }}>
                <ListItemText primary="어드민" primaryTypographyProps={{ fontSize: "0.85rem" }} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/ncgame/user")} sx={{ pl: 7 }}>
                <ListItemText primary="유저" primaryTypographyProps={{ fontSize: "0.85rem" }} />
              </ListItemButton>
            </ListItem>
          </List>
          <Divider sx={{ bgcolor: "military.border", my: 1 }} />
          {/* 위너히트 */}
          <List dense>
            <ListItem disablePadding>
              <ListItemButton disabled sx={{ pb: 0 }}>
                <ListItemIcon><EmojiEventsIcon /></ListItemIcon>
                <ListItemText primary="위너히트" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/whgame")} sx={{ pl: 7 }}>
                <ListItemText primary="어드민" primaryTypographyProps={{ fontSize: "0.85rem" }} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/whgame/user")} sx={{ pl: 7 }}>
                <ListItemText primary="유저" primaryTypographyProps={{ fontSize: "0.85rem" }} />
              </ListItemButton>
            </ListItem>
          </List>
          <Divider sx={{ bgcolor: "military.border", my: 1 }} />
          {/* 메가히트 */}
          <List dense>
            <ListItem disablePadding>
              <ListItemButton disabled sx={{ pb: 0 }}>
                <ListItemIcon><WhatshotIcon /></ListItemIcon>
                <ListItemText primary="메가히트" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/mhgame")} sx={{ pl: 7 }}>
                <ListItemText primary="어드민" primaryTypographyProps={{ fontSize: "0.85rem" }} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/mhgame/user")} sx={{ pl: 7 }}>
                <ListItemText primary="유저" primaryTypographyProps={{ fontSize: "0.85rem" }} />
              </ListItemButton>
            </ListItem>
          </List>
          <Divider sx={{ bgcolor: "military.border", my: 1 }} />
          {/* 드림히트 */}
          <List dense>
            <ListItem disablePadding>
              <ListItemButton disabled sx={{ pb: 0 }}>
                <ListItemIcon><AutoAwesomeIcon /></ListItemIcon>
                <ListItemText primary="드림히트" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/dhgame")} sx={{ pl: 7 }}>
                <ListItemText primary="어드민" primaryTypographyProps={{ fontSize: "0.85rem" }} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/dhgame/user")} sx={{ pl: 7 }}>
                <ListItemText primary="유저" primaryTypographyProps={{ fontSize: "0.85rem" }} />
              </ListItemButton>
            </ListItem>
          </List>
        </>
      ) : (
        <>
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleUserGameClick("t9", "/t9game/user")}>
                <ListItemIcon><SportsEsportsIcon /></ListItemIcon>
                <ListItemText primary="트리플나인" />
              </ListItemButton>
            </ListItem>
          </List>
          <Divider sx={{ bgcolor: "military.border", my: 1 }} />
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleUserGameClick("hb", "/hbgame/user")}>
                <ListItemIcon><HiveIcon /></ListItemIcon>
                <ListItemText primary="허니비" />
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
          <Divider sx={{ bgcolor: "military.border", my: 1 }} />
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleUserGameClick("nc", "/ncgame/user")}>
                <ListItemIcon><StarIcon /></ListItemIcon>
                <ListItemText primary="나이스초이스" />
              </ListItemButton>
            </ListItem>
          </List>
          <Divider sx={{ bgcolor: "military.border", my: 1 }} />
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleUserGameClick("wh", "/whgame/user")}>
                <ListItemIcon><EmojiEventsIcon /></ListItemIcon>
                <ListItemText primary="위너히트" />
              </ListItemButton>
            </ListItem>
          </List>
          <Divider sx={{ bgcolor: "military.border", my: 1 }} />
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleUserGameClick("mh", "/mhgame/user")}>
                <ListItemIcon><WhatshotIcon /></ListItemIcon>
                <ListItemText primary="메가히트" />
              </ListItemButton>
            </ListItem>
          </List>
          <Divider sx={{ bgcolor: "military.border", my: 1 }} />
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleUserGameClick("dh", "/dhgame/user")}>
                <ListItemIcon><AutoAwesomeIcon /></ListItemIcon>
                <ListItemText primary="드림히트" />
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
