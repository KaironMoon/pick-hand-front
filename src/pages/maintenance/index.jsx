import { useEffect, useState } from "react";
import { Box, CircularProgress, Paper, Typography } from "@mui/material";

import maintenanceService from "@/services/maintenance-service";

const formatDate = (value) => value ? new Date(value).toLocaleString() : "미정";

export default function MaintenancePage() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    maintenanceService.getStatus().then(setStatus).catch(() => setStatus({ enabled: true }));
  }, []);
  if (!status) return <Box sx={{ p: 5, textAlign: "center" }}><CircularProgress /></Box>;
  return (
    <Box sx={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
      <Paper sx={{ width: "100%", maxWidth: 680, p: 4, textAlign: "center", border: "1px solid #555" }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>서비스 점검 중</Typography>
        <Typography sx={{ whiteSpace: "pre-wrap", mb: 3 }}>{status.message || "서비스 점검 중입니다."}</Typography>
        <Typography color="text.secondary">점검 시작: {formatDate(status.starts_at)}</Typography>
        <Typography color="text.secondary">점검 종료: {formatDate(status.ends_at)}</Typography>
      </Paper>
    </Box>
  );
}
