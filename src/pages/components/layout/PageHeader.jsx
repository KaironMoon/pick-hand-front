import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";

function PageHeader({ isMobile, onMenuToggle }) {
  const theme = useTheme();

  return (
    <Toolbar
      variant={isMobile ? "dense" : "regular"}
      sx={{ backgroundColor: theme.palette.background.header, minHeight: isMobile ? 48 : 64 }}
    >
      {isMobile && (
        <IconButton edge="start" color="inherit" onClick={onMenuToggle} sx={{ mr: 1 }}>
          <Box component="img" src="/favicon.png" alt="menu" sx={{ width: 24, height: 24 }} />
        </IconButton>
      )}
      <Typography variant="h6" component="div" sx={{ color: theme.palette.text.primary, fontSize: isMobile ? 14 : 20 }}>
        TripleNine
      </Typography>
    </Toolbar>
  );
}

export default PageHeader;
