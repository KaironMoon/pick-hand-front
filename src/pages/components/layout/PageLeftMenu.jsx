import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider } from "@mui/material";
import { useTheme } from "@mui/material/styles";

// 아이콘 import
import MapIcon from "@mui/icons-material/Map";
import InfoIcon from "@mui/icons-material/Info";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SettingsIcon from "@mui/icons-material/Settings";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import ListIcon from "@mui/icons-material/List";
import HomeIcon from "@mui/icons-material/Home";

import { useNavigate } from "react-router-dom";

function PageLeftMenu() {
  const theme = useTheme();
  const navigate = useNavigate();
  const debugMode = true;

  const handleNavClick = (path) => {
    navigate(path);
    if (isMobile && closeMobileMenu) {
      closeMobileMenu();
    }
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
            <ListItemIcon>
              <HomeIcon />
            </ListItemIcon>
            <ListItemText primary="Home" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={() => handleNavClick("/info")}>
            <ListItemIcon>
              <InfoIcon />
            </ListItemIcon>
            <ListItemText primary="Info" />
          </ListItemButton>
        </ListItem>
      </List>
      {debugMode && (
        <div style={{ flex: 1 }}>
          <Divider
            sx={{
              bgcolor: "military.border",
              my: 1,
            }}
          />
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/tactic-manuals")}>
                <ListItemIcon>
                  <MenuBookIcon />
                </ListItemIcon>
                <ListItemText primary="메뉴3" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/session")}>
                <ListItemIcon>
                  <ListIcon />
                </ListItemIcon>
                <ListItemText primary="메뉴4" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavClick("/client-options")}>
                <ListItemIcon>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText primary="Client Option" />
              </ListItemButton>
            </ListItem>
          </List>
        </div>
      )}
    </Box>
  );
}

export default PageLeftMenu;
