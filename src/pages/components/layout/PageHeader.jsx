import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";

function PageHeader() {
  const theme = useTheme();

  return (
    <Toolbar sx={{ backgroundColor: theme.palette.background.header }}>
      <Typography variant="h6" component="div" sx={{ color: theme.palette.text.primary }}>
        PageHeader
      </Typography>
    </Toolbar>
  );
}

export default PageHeader;
