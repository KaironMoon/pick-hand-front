import { Box, CircularProgress, Typography } from "@mui/material";

export default function PageLoading({ fullScreen = false }) {
  return (
    <Box
      role="status"
      sx={{
        minHeight: fullScreen ? "100vh" : 160,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
        color: "text.secondary",
        backgroundColor: "background.default",
      }}
    >
      <CircularProgress size={24} sx={{ color: "#4caf50" }} aria-hidden="true" />
      <Typography variant="body2">불러오는 중...</Typography>
    </Box>
  );
}
