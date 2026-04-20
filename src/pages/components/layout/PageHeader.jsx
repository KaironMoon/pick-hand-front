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
      <Box component="img" src="/header.png" alt="header" onClick={isMobile ? onMenuToggle : undefined} sx={{ height: isMobile ? 20 : 28, objectFit: "contain", cursor: isMobile ? "pointer" : "default" }} />
    </Toolbar>
  );
}

export default PageHeader;
