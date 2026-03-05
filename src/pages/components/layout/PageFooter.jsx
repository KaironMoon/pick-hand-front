import { Box, Typography, Link } from "@mui/material";
import { useTheme } from "@mui/material/styles";

function PageFooter() {
  const theme = useTheme();

  return (
    <Box
      sx={{
        py: 2, // 상하 패딩
        px: 3, // 좌우 패딩
        backgroundColor: theme.palette.background.footer,
        color: theme.palette.text.primary,
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="body2">© {new Date().getFullYear()} Your Company Name. All rights reserved.</Typography>
        <Box>
          <Link href="#" color="inherit" underline="hover" sx={{ mr: 2 }}>
            Privacy Policy
          </Link>
          <Link href="#" color="inherit" underline="hover" sx={{ mr: 2 }}>
            Terms of Service
          </Link>
          <Link href="#" color="inherit" underline="hover">
            Contact Us
          </Link>
        </Box>
      </Box>
    </Box>
  );
}

export default PageFooter;
