import { useState } from "react";
import {
  Box,
  FormControl,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

import { MAX_MISS_THRESHOLDS, maxMissLabel } from "./max-miss-dialog.js";

const MAX_MISS_THRESHOLD_KEY = "gh_max_miss_threshold";

const SECTION_ROWS = [
  [
    { key: "A", label: "A" },
    { key: "AR", label: "AR" },
    { key: "AARO", label: "ARO" },
    { key: "AARN", label: "AARN" },
  ],
  [
    { key: "S1", label: "S1" },
    { key: "SR1", label: "S1R" },
    { key: "SSRO1", label: "SSRO1" },
    { key: "SSRN1", label: "SSRN1" },
  ],
  [
    { key: "S2", label: "S2" },
    { key: "SR2", label: "S2R" },
    { key: "SSRO2", label: "SSRO2" },
    { key: "SSRN2", label: "SSRN2" },
  ],
  [
    { key: "S3", label: "S3" },
    { key: "SR3", label: "S3R" },
    { key: "SSRO3", label: "SSRO3" },
    { key: "SSRN3", label: "SSRN3" },
  ],
  [
    { key: "SQ1", label: "SQ1" },
    { key: "SQ2", label: "SQ2" },
    { key: "SQ3", label: "SQ3" },
    null,
  ],
  [
    { key: "FOR1", label: "FOR1" },
    { key: "FOR2", label: "FOR2" },
    { key: "FOR3", label: "FOR3" },
    null,
  ],
  [
    { key: "FOR1X", label: "FORX1" },
    { key: "FOR2X", label: "FORX2" },
    { key: "FOR3X", label: "FORX3" },
    null,
  ],
  [
    { key: "G(H1)", label: "GH1" },
    { key: "G(H2)", label: "GH2" },
    { key: "G(H3)", label: "GH3" },
    { key: "G(H4)", label: "GH4" },
  ],
  [
    { key: "G(%1)", label: "G%1" },
    { key: "G(%2)", label: "G%2" },
    { key: "G(%3)", label: "G%3" },
    { key: "G(%4)", label: "G%4" },
  ],
  [
    { key: "허니비", label: "허니비" },
    { key: "허니R2", label: "허니R2" },
    { key: "허니SR2O", label: "허니SR2O" },
    null,
  ],
  [
    { key: "W111", label: "W111" },
    { key: "위너R2", label: "위너R2" },
    { key: "위너SR2O", label: "위너SR2O" },
    null,
  ],
  [
    { key: "M22", label: "M22" },
    { key: "메가R2", label: "메가R2" },
    { key: "메가SR2O", label: "메가SR2O" },
    null,
  ],
  [
    { key: "D112", label: "D112" },
    { key: "드림R2", label: "드림R2" },
    { key: "드림SR2O", label: "드림SR2O" },
    null,
  ],
  [
    { key: "NC", label: "NC" },
    { key: "NCR", label: "NCR" },
    { key: "NCSRO", label: "NCSRO" },
    { key: "NCSRN", label: "NCSRN" },
  ],
  [
    { key: "P", label: "P" },
    { key: "B", label: "B" },
    { key: "J", label: "J", always: true },
    null,
  ],
];

const labelCellSx = (color) => ({
  minWidth: 76,
  height: 31,
  px: 0.7,
  border: "1px solid #747474",
  color,
  backgroundColor: "#181a1d",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: 13,
  whiteSpace: "nowrap",
});

const valueCellSx = {
  width: 43,
  minWidth: 43,
  height: 31,
  border: "1px solid #747474",
  backgroundColor: "#101214",
  color: "#ffeb3b",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: 14,
};

function MaxMissGrid({ roundState, trackKey, color, title, threshold }) {
  const sections = roundState?.sections || {};
  return (
    <Box>
      <Typography sx={{ mb: 0.7, color, fontWeight: 900, textAlign: "center" }}>{title}</Typography>
      <Box sx={{ border: "2px solid #b39b5d", width: "max-content" }}>
        {SECTION_ROWS.map((row, rowIndex) => (
          <Box key={rowIndex} sx={{ display: "flex" }}>
            {row.map((section, colIndex) => {
              if (!section) {
                return (
                  <Box key={colIndex} sx={{ display: "flex" }}>
                    <Box sx={labelCellSx("#555")} />
                    <Box sx={valueCellSx} />
                  </Box>
                );
              }
              const value = maxMissLabel(sections?.[section.key]?.[trackKey], threshold, section.always);
              return (
                <Box key={section.key} sx={{ display: "flex" }}>
                  <Box sx={labelCellSx(color)}>{section.label}</Box>
                  <Box sx={valueCellSx}>{value}</Box>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function GhMaxMissPanel({ roundState, gameId, replayRound = null }) {
  const [threshold, setThreshold] = useState(() => {
    const stored = Number(sessionStorage.getItem(MAX_MISS_THRESHOLD_KEY));
    return MAX_MISS_THRESHOLDS.includes(stored) ? stored : 9;
  });
  const changeThreshold = (value) => {
    setThreshold(value);
    sessionStorage.setItem(MAX_MISS_THRESHOLD_KEY, String(value));
  };

  return (
    <Box sx={{ minHeight: "100vh", p: 1.5, backgroundColor: "#0d0f12" }}>
      <Typography sx={{ mb: 1, color: "#fff", fontSize: 18, fontWeight: 900 }}>고연패 현황</Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.2 }}>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <Select value={threshold} onChange={(event) => changeThreshold(Number(event.target.value))}>
            {MAX_MISS_THRESHOLDS.map((value) => (
              <MenuItem key={value} value={value}>{value}M 이상</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ px: 1.5, py: 0.9, minWidth: 100, border: "1px solid #777", borderRadius: 1, color: "#fff", fontWeight: 800 }}>
          #{gameId || "-"}{replayRound ? ` · ${replayRound}회차 리플레이` : ""}
        </Box>
      </Box>
      <Box sx={{ overflow: "auto", pb: 1 }}>
        <Box sx={{ display: "flex", gap: 1.5, width: "max-content", backgroundColor: "#111", p: 1 }}>
          <MaxMissGrid roundState={roundState} trackKey="assist_h" color="#20c9e8" title="회차어시 H" threshold={threshold} />
          <MaxMissGrid roundState={roundState} trackKey="assist_q" color="#ff74df" title="쿼터어시 Q" threshold={threshold} />
        </Box>
      </Box>
    </Box>
  );
}
