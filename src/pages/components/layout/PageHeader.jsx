import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import { useTheme } from "@mui/material/styles";

function PageHeader({ isMobile, onMenuToggle }) {
  const theme = useTheme();

  return (
    <Toolbar
      variant={isMobile ? "dense" : "regular"}
      sx={{ backgroundColor: theme.palette.background.header, minHeight: isMobile ? 48 : 64 }}
    >
      {isMobile && (
        <IconButton edge="start" color="inherit" onClick={onMenuToggle} sx={{ mr: 1, color: theme.palette.text.primary }}>
          <MenuIcon />
        </IconButton>
      )}
      <Typography variant="h6" component="div" sx={{ color: theme.palette.text.primary, fontSize: isMobile ? 14 : 20 }}>
        Pick Hand
      </Typography>
    </Toolbar>
  );
}

export default PageHeader;
