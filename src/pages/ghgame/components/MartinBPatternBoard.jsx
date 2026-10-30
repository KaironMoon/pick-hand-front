import { Box, Typography } from "@mui/material";

export default function MartinBPatternBoard({ display }) {
  return (
    <Box sx={{ flex: "1 1 auto", minWidth: 0, overflowX: "auto", alignSelf: "stretch" }}>
      <Box role="table" aria-label="마틴B 패턴 현황" sx={{
        display: "flex", flexDirection: "column", gap: 0.75, p: 1,
        minWidth: 440, maxWidth: 850,
      }}>
        {(display.rows || []).map((row) => (
          <Box key={row.pattern_no} role="row" sx={{ display: "grid", gridTemplateColumns: "repeat(11, minmax(0, 1fr))", gap: 0.75 }}>
            <Box role="rowheader" aria-label={`${row.pattern_no}번 패턴`} sx={cellStyle()}>{row.pattern_no}</Box>
            {row.cells.map((cell, index) => (
              <Box key={index} role="cell" aria-label={`${row.pattern_no}번 패턴 ${index + 1}단계${cell.status === "hit" ? " 성공" : cell.status === "miss" ? " 실패" : ""}`}
                sx={cellStyle(cell.status)}>{cell.number}</Box>
            ))}
          </Box>
        ))}
        {!display.rows?.length && <Typography sx={{ p: 2 }}>사용 중인 마틴B 패턴이 없습니다.</Typography>}
      </Box>
    </Box>
  );
}

function cellStyle(status) {
  return {
    aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
    border: "2px solid #a9c8df", borderRadius: 1.5,
    backgroundColor: status === "hit" ? "#00c781" : status === "miss" ? "#85898d" : "#226398",
    color: "#fff", fontSize: { xs: 20, md: 30 }, fontWeight: "bold",
  };
}
