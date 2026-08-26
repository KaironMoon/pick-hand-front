import { useRef, useState } from "react";
import { toBlob } from "html-to-image";
import {
  Box,
  Button,
  FormControl,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

import {
  buildMaxMissClipboardPayload,
  compressPngBlob,
  includeInMaxMissImage,
  MAX_MISS_CAPTURE_PIXEL_RATIO,
  MAX_MISS_CAPTURE_SECTION_ORDER,
  MAX_MISS_SECTION_ROWS,
  MAX_MISS_THRESHOLDS,
  maxMissGeneratedJTrack,
  maxMissLabel,
  maxMissTitle,
  maxMissTrackForSection,
  writeMaxMissClipboard,
  writePngToClipboard,
} from "./max-miss-dialog.js";
import { buildGoalStatusItems, formatGoalIndicator, formatGoalTarget } from "../goal-status.js";

const MAX_MISS_THRESHOLD_KEY = "gh_max_miss_threshold";

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
  width: 50,
  minWidth: 50,
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
        {MAX_MISS_SECTION_ROWS.map((row, rowIndex) => (
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
              const track = maxMissTrackForSection(sections, section.key, trackKey);
              const value = maxMissLabel(track, threshold, section.always);
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

function MaxMissGeneratedJ({ roundState, threshold }) {
  const value = maxMissLabel(
    maxMissGeneratedJTrack(roundState?.sections || {}),
    threshold,
    true,
  );
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "max-content", mb: 1 }}>
      <Typography sx={{ color: "#ff74df", fontWeight: 900 }}>생성픽 최대연패</Typography>
      <Box sx={{ display: "flex", border: "2px solid #b39b5d" }}>
        <Box sx={labelCellSx("#ff74df")}>J</Box>
        <Box sx={valueCellSx}>{value}</Box>
      </Box>
    </Box>
  );
}

function MaxMissPotStatus({ roundState }) {
  const items = buildGoalStatusItems(
    roundState?.strategy_goals,
    roundState?.overall_stop,
    null,
  );
  return (
    <Box data-capture-section={MAX_MISS_CAPTURE_SECTION_ORDER[1]} sx={{ mt: 1.5 }}>
      <Typography sx={{ mb: 0.7, color: "#fff", fontSize: 16, fontWeight: 900 }}>POT 상태</Typography>
      <Box sx={{ display: "flex", gap: 0.5, width: "max-content", p: 1, backgroundColor: "#111" }}>
        {items.map((item) => {
          const text = formatGoalIndicator(item);
          const title = item.target > 0
            ? `${item.label}: ${formatGoalTarget(item.pnl)} / ${formatGoalTarget(item.target)}P${item.reached ? " (목표 달성)" : ""}`
            : `${item.label}: 목표금액 없음`;
          return (
            <Box
              key={item.key}
              title={title}
              sx={{
                minWidth: 42,
                height: 28,
                px: 0.9,
                border: `1px solid ${item.reached ? "#00e676" : "#59616d"}`,
                borderRadius: 1,
                backgroundColor: item.reached ? "#0e5635" : "#11161d",
                color: item.reached ? "#b9ffd5" : "#fff",
                boxShadow: item.reached
                  ? "0 0 7px #00e676, inset 0 0 7px rgba(0,230,118,0.35)"
                  : "none",
                opacity: item.dimmed ? 0.28 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: "bold",
                whiteSpace: "nowrap",
              }}
            >
              {text}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function MaxMissRoundAmountTable({ roundState }) {
  const table = roundState?.round_amount_table || {};
  const cells = Array.from({ length: 80 }, (_, index) => table.cells?.[index] || {
    round: index + 1,
    amount: 0,
    pnl: 0,
    status: null,
    actual: null,
    pick: null,
  });
  const formatAmount = (value) => value === "N/A" ? "-" : Number(value || 0).toFixed(1);
  const finalSide = table.total_side;
  const finalSideColor = finalSide === "P" ? "#1565d8" : finalSide === "B" ? "#e53935" : "#555";
  const pnlBreakdown = table.pnl_breakdown || { globalhit: table.total_pnl || 0 };
  const basePnl = Number(pnlBreakdown.globalhit || 0);
  const martinPnls = [
    ["Z", Number(pnlBreakdown.martin_z || 0)],
    ["B", Number(pnlBreakdown.martin_b || 0)],
    ["C", Number(pnlBreakdown.martin_c || 0)],
  ];
  const globalhitAggregate = roundState?.globalhit_aggregate || {};
  const globalhitDirection = globalhitAggregate.direction;
  const globalhitBetAmount = Number(globalhitAggregate.amount || 0);
  const globalhitDirectionColor = globalhitDirection === "P" ? "#1565d8" : globalhitDirection === "B" ? "#e53935" : "#555";
  const roundColor = (cell) => {
    const value = cell?.pick ?? cell?.side;
    if (value === "P") return "#1565d8";
    if (value === "B") return "#e53935";
    return "#777";
  };
  return (
    <Box data-capture-section={MAX_MISS_CAPTURE_SECTION_ORDER[2]} sx={{ mt: 1.5 }}>
      <Typography sx={{ mb: 0.7, color: "#fff", fontSize: 16, fontWeight: 900 }}>회차별 금액표</Typography>
      <Box sx={{ width: "max-content", p: 1, backgroundColor: "#0d1014" }}>
        <Box sx={{ display: "flex", alignItems: "stretch", gap: 0.5, mb: 1 }}>
          <Box sx={{ width: 28, border: "1px solid #3f4650", backgroundColor: finalSideColor, color: "#fff", fontSize: 13, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {finalSide || "-"}
          </Box>
          <Box sx={{ width: 180, border: "1px solid #3f4650", backgroundColor: "#111821", color: "#fff", fontSize: 11, fontWeight: "bold", px: 0.75, py: 0.7, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>BET</span><span>{formatAmount(table.total_amount)}</span>
          </Box>
          <Box sx={{ width: 180, border: "1px solid #3f4650", backgroundColor: "#111821", color: Number(table.total_pnl || 0) >= 0 ? "#00e676" : "#ef5350", fontSize: 11, fontWeight: "bold", px: 0.75, py: 0.7, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>전체 PNL</span><span>{formatAmount(table.total_pnl)}</span>
          </Box>
        </Box>
        <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "stretch", gap: 0.5, mb: 1 }}>
          <Box sx={{ width: 28, minWidth: 28, border: "1px solid #3f4650", backgroundColor: globalhitDirectionColor, color: "#fff", fontSize: 13, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {globalhitDirection || "-"}
          </Box>
          <Box sx={{ width: 145, border: "1px solid #3f4650", backgroundColor: "#111821", color: "#fff", fontSize: 11, fontWeight: "bold", px: 0.75, py: 0.35, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>글로벌히트 BET</span><span>{formatAmount(globalhitBetAmount)}</span>
          </Box>
          <Box sx={{ width: 145, border: "1px solid #3f4650", backgroundColor: "#111821", color: basePnl >= 0 ? "#00e676" : "#ef5350", fontSize: 11, fontWeight: "bold", px: 0.75, py: 0.35, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>글로벌히트 PNL</span><span>{formatAmount(basePnl)}</span>
          </Box>
          {martinPnls.map(([label, value]) => (
            <Box key={label} sx={{ width: 112, border: "1px solid #3f4650", backgroundColor: "#111821", color: value >= 0 ? "#00e676" : "#ef5350", fontSize: 11, fontWeight: "bold", px: 0.75, py: 0.35, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>{label} PnL</span><span>{formatAmount(value)}</span>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: "grid", gridTemplateRows: "repeat(10, 31px)", gridAutoFlow: "column", gridAutoColumns: "84px", gap: "2px" }}>
          {cells.map((cell, index) => {
            const hasResult = Boolean(cell.actual);
            const hasJudgement = cell.status === "hit" || cell.status === "miss";
            return (
              <Box
                key={index}
                title={`${index + 1}회차 / 계산 ${formatAmount(cell.amount)}P / PnL ${formatAmount(cell.pnl)}P`}
                sx={{
                  width: 84,
                  height: 31,
                  border: "1px solid #3f4650",
                  backgroundColor: hasResult && hasJudgement
                    ? (cell.status === "hit" ? "#2e9e5b" : "#5b6068")
                    : "#101318",
                  display: "grid",
                  gridTemplateColumns: "22px 1fr",
                  alignItems: "center",
                  overflow: "hidden",
                }}
              >
                <Box sx={{ color: roundColor(cell), fontSize: 10, fontWeight: "bold", textAlign: "center" }}>{index + 1}</Box>
                <Box sx={{ color: "#fff", fontSize: 11, fontWeight: "bold", textAlign: "right", pr: 0.4 }}>{formatAmount(cell.amount)}</Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

export default function GhMaxMissPanel({ roundState, gameId, replayRound = null }) {
  const captureRef = useRef(null);
  const [copyStatus, setCopyStatus] = useState(null);
  const [imageCopying, setImageCopying] = useState(false);
  const [threshold, setThreshold] = useState(() => {
    const stored = Number(sessionStorage.getItem(MAX_MISS_THRESHOLD_KEY));
    return MAX_MISS_THRESHOLDS.includes(stored) ? stored : 9;
  });
  const changeThreshold = (value) => {
    setThreshold(value);
    setCopyStatus(null);
    sessionStorage.setItem(MAX_MISS_THRESHOLD_KEY, String(value));
  };
  const roundNum = replayRound || Number(roundState?.round_num) || null;
  const replay = Boolean(replayRound);
  const title = maxMissTitle({ threshold, gameId, roundNum, replay });
  const copyForExcel = async () => {
    setCopyStatus(null);
    const payload = buildMaxMissClipboardPayload({
      sections: roundState?.sections || {},
      sectionRows: MAX_MISS_SECTION_ROWS,
      threshold,
      gameId,
      roundNum,
      replay,
    });
    try {
      const format = await writeMaxMissClipboard(payload);
      await new Promise((resolve) => setTimeout(resolve, 0));
      setCopyStatus({
        success: true,
        message: format === "html"
          ? "엑셀용 표를 디자인과 함께 복사했습니다."
          : "엑셀용 표를 복사했습니다. 색상은 지원되지 않는 환경입니다.",
      });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 0));
      setCopyStatus({ success: false, message: "복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해주세요." });
    }
  };
  const copyAsImage = async () => {
    if (!captureRef.current || imageCopying) return;
    setCopyStatus(null);
    setImageCopying(true);
    try {
      await document.fonts?.ready;
      const width = captureRef.current.scrollWidth;
      const height = captureRef.current.scrollHeight;
      const pngPromise = toBlob(captureRef.current, {
        backgroundColor: "#0d0f12",
        cacheBust: true,
        filter: includeInMaxMissImage,
        width,
        height,
        pixelRatio: MAX_MISS_CAPTURE_PIXEL_RATIO,
      }).then((blob) => compressPngBlob(blob));
      await writePngToClipboard(pngPromise);
      await new Promise((resolve) => setTimeout(resolve, 0));
      setCopyStatus({ success: true, message: "이미지를 클립보드에 복사했습니다." });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 0));
      setCopyStatus({ success: false, message: "이미지를 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해주세요." });
    } finally {
      setImageCopying(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", p: 1.5, backgroundColor: "#0d0f12" }}>
      <Box ref={captureRef} data-image-capture-root="true" sx={{ width: "max-content", p: 0.5, backgroundColor: "#0d0f12" }}>
        <Box data-capture-section={MAX_MISS_CAPTURE_SECTION_ORDER[0]}>
          <Typography sx={{ mb: 1, color: "#fff", fontSize: 18, fontWeight: 900 }}>{title}</Typography>
          <Box data-image-capture-exclude="true" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.2 }}>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <Select value={threshold} onChange={(event) => changeThreshold(Number(event.target.value))}>
                {MAX_MISS_THRESHOLDS.map((value) => (
                  <MenuItem key={value} value={value}>{value}M 이상</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ px: 1.5, py: 0.9, minWidth: 100, border: "1px solid #777", borderRadius: 1, color: "#fff", fontWeight: 800 }}>
              #{gameId || "-"}{roundNum ? ` ${roundNum}회차` : ""}{replay ? " 리플레이" : ""}
            </Box>
            <Button size="small" variant="contained" color="success" onClick={copyForExcel}>
              엑셀 복사
            </Button>
            <Button size="small" variant="contained" color="info" onClick={copyAsImage} disabled={imageCopying}>
              {imageCopying ? "복사 중..." : "이미지 복사"}
            </Button>
            {copyStatus && (
              <Typography sx={{ color: copyStatus.success ? "#66bb6a" : "#ef5350", fontSize: 12, fontWeight: 700 }}>
                {copyStatus.message}
              </Typography>
            )}
          </Box>
          <MaxMissGeneratedJ roundState={roundState} threshold={threshold} />
          <Box sx={{ display: "flex", gap: 1.5, width: "max-content", backgroundColor: "#111", p: 1 }}>
            <MaxMissGrid roundState={roundState} trackKey="assist_h" color="#20c9e8" title="회차어시 H" threshold={threshold} />
            <MaxMissGrid roundState={roundState} trackKey="assist_q" color="#ff74df" title="쿼터어시 Q" threshold={threshold} />
          </Box>
        </Box>
        <MaxMissPotStatus roundState={roundState} />
        <MaxMissRoundAmountTable roundState={roundState} />
      </Box>
    </Box>
  );
}
