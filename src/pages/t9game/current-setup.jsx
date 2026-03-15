import { useState, useEffect, useCallback } from "react";
import { Box, Typography } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiCaller from "@/services/api-caller";

const CELL_BORDER = "1px solid #555";
const LABEL_COLOR = "#c62828";
const LABEL_BG = "rgba(255,255,255,0.04)";
const GREEN = "#4caf50";

const BET_TYPE_LABELS = { martin: "마틴", kkangbet: "깡벳", fixed: "고정벳", manual: "수동", cruise: "크루즈" };

const cellStyle = {
  border: CELL_BORDER, padding: "3px 6px", fontSize: 13,
  textAlign: "center", whiteSpace: "nowrap", minWidth: 70,
};
const labelCellStyle = {
  ...cellStyle, fontWeight: "bold", color: LABEL_COLOR,
  backgroundColor: LABEL_BG, textAlign: "left", minWidth: 70,
};
const headerStyle = {
  border: CELL_BORDER, padding: "4px 8px", fontSize: 14,
  fontWeight: "bold", textAlign: "center", backgroundColor: "rgba(255,255,255,0.08)",
};
const normalCell = { ...cellStyle };
const activeCell = {
  ...cellStyle, backgroundColor: GREEN, color: "#1b2e1b", fontWeight: "bold",
};

const PINCH_METHODS = ["pattern", "LongJ", "1LSC", "2LSC", "3LSC", "4LSC"];

function ReadOnlyBettingSection({ title, data }) {
  if (!data) return null;
  return (
    <table style={{ borderCollapse: "collapse", width: "fit-content", marginBottom: 16 }}>
      <thead>
        <tr><td colSpan={7} style={headerStyle}>{title}</td></tr>
      </thead>
      <tbody>
        <tr>
          <td style={labelCellStyle}>배팅종류</td>
          {["martin", "kkangbet", "fixed", "manual", "cruise"].map((t) => (
            <td key={t} style={data.bet_type === t ? activeCell : normalCell}>
              {BET_TYPE_LABELS[t]}
            </td>
          ))}
          <td style={normalCell}></td>
        </tr>
        <tr>
          <td style={labelCellStyle}>단계설정</td>
          <td style={normalCell}>최저</td>
          <td style={activeCell}>{data.step_min}단계</td>
          <td style={normalCell}>최고</td>
          <td style={activeCell}>{data.step_max}단계</td>
          <td style={normalCell}></td>
        </tr>
        {[0, 1, 2, 3].map((rowIdx) => (
          <tr key={`amt-${rowIdx}`}>
            {rowIdx === 0 && <td rowSpan={4} style={labelCellStyle}>금액설정</td>}
            {data.amounts.slice(rowIdx * 5, rowIdx * 5 + 5).map((amt, i) => {
              const idx = rowIdx * 5 + i;
              const step = idx + 1;
              const inRange = step >= data.step_min && step <= data.step_max;
              return (
                <td key={idx} style={normalCell}>
                  {step}:{inRange ? amt : 0}P
                </td>
              );
            })}
            <td style={normalCell}></td>
          </tr>
        ))}
        <tr>
          <td style={labelCellStyle}>게임설정</td>
          <td style={normalCell}>{data.game_start === 0 ? "1회시작" : `${data.game_start}회시작`}</td>
          <td style={normalCell}>{data.game_end === 0 ? "끝까지" : `${data.game_end}회마감`}</td>
          <td style={labelCellStyle}>단계미처리시</td>
          <td style={data.step_carry_over ? activeCell : normalCell}>
            {data.step_carry_over ? "다음게임적용" : "초기화"}
          </td>
          <td style={normalCell}></td>
          <td style={normalCell}></td>
        </tr>
      </tbody>
    </table>
  );
}

function ReadOnlyGlobalHitSection({ data }) {
  if (!data) return null;
  const patterns = ["PPP", "BBB", "PBP", "BPB", "PPB", "BBP", "PBB", "BPP"];

  return (
    <table style={{ borderCollapse: "collapse", width: "fit-content", marginBottom: 16 }}>
      <thead>
        <tr><td colSpan={6} style={headerStyle}>globalhit</td></tr>
      </thead>
      <tbody>
        <tr>
          <td style={labelCellStyle}>배팅종류</td>
          {["martin", "kkangbet", "fixed", "manual", "cruise"].map((t) => (
            <td key={t} style={data.bet_type === t ? activeCell : normalCell}>
              {BET_TYPE_LABELS[t]}
            </td>
          ))}
        </tr>
        <tr>
          <td style={labelCellStyle}>단계설정</td>
          <td style={normalCell}>최저</td>
          <td style={activeCell}>{data.step_min}단계</td>
          <td style={normalCell}>최고</td>
          <td style={activeCell}>{data.step_max}단계</td>
          <td style={normalCell}></td>
        </tr>
        {[0, 1, 2, 3].map((rowIdx) => (
          <tr key={`gh-amt-${rowIdx}`}>
            {rowIdx === 0 && <td rowSpan={4} style={labelCellStyle}>금액설정</td>}
            {data.amounts.slice(rowIdx * 5, rowIdx * 5 + 5).map((amt, i) => {
              const idx = rowIdx * 5 + i;
              const step = idx + 1;
              const inRange = step >= data.step_min && step <= data.step_max;
              return (
                <td key={idx} style={normalCell}>
                  {step}:{inRange ? amt : 0}P
                </td>
              );
            })}
          </tr>
        ))}
        {patterns.map((pat) => (
          <tr key={pat}>
            <td style={{ ...labelCellStyle, fontSize: 12 }}>
              {pat.split("").map((c, i) => (
                <span key={i} style={{ color: c === "P" ? "#1565c0" : "#f44336", fontWeight: "bold" }}>{c}</span>
              ))}
            </td>
            {[0, 1, 2].map((secIdx) => (
              <td key={secIdx} style={data.patterns?.[pat]?.[secIdx] ? activeCell : normalCell}>
                {data.patterns?.[pat]?.[secIdx] ? `섹션${secIdx + 1}운영하기` : `섹션${secIdx + 1}중지`}
              </td>
            ))}
            <td style={normalCell}></td>
            <td style={normalCell}></td>
          </tr>
        ))}
        <tr>
          <td style={labelCellStyle}>게임설정</td>
          {["섹션1", "섹션2", "섹션3"].map((s, i) => (
            <td key={i} style={labelCellStyle}>{s}</td>
          ))}
          <td style={normalCell}></td>
          <td style={normalCell}></td>
        </tr>
        <tr>
          <td style={labelCellStyle}>게임시작</td>
          {[0, 1, 2].map((i) => (
            <td key={i} style={normalCell}>
              {data.game_start[i] === 0 ? "(1회시작)" : `${data.game_start[i]}회시작`}
            </td>
          ))}
          <td style={normalCell}></td>
          <td style={normalCell}></td>
        </tr>
        <tr>
          <td style={labelCellStyle}>게임마감</td>
          {[0, 1, 2].map((i) => (
            <td key={i} style={normalCell}>
              {data.game_end[i] === 0 ? "(끝까지)" : `${data.game_end[i]}회마감`}
            </td>
          ))}
          <td style={normalCell}></td>
          <td style={normalCell}></td>
        </tr>
        <tr>
          <td style={labelCellStyle}>단계미처리시</td>
          {[0, 1, 2].map((i) => (
            <td key={i} style={data.step_carry_over ? activeCell : normalCell}>
              {data.step_carry_over ? "다음게임적용" : "초기화"}
            </td>
          ))}
          <td style={normalCell}></td>
          <td style={normalCell}></td>
        </tr>
      </tbody>
    </table>
  );
}

function ReadOnlyPinchSection({ data, triplenineData }) {
  if (!data) return null;

  const totalLoss = triplenineData
    ? Array.from({ length: triplenineData.step_max - triplenineData.step_min + 1 }, (_, i) => triplenineData.amounts[triplenineData.step_min - 1 + i] || 0).reduce((a, b) => a + b, 0)
    : 0;

  const rawDist = data.pinch_distribution || {};
  const lastMethod = PINCH_METHODS[PINCH_METHODS.length - 1];
  const othersSum = PINCH_METHODS.slice(0, -1).reduce((sum, m) => sum + (rawDist[m] || 0), 0);
  const dist = { ...rawDist, [lastMethod]: Math.max(totalLoss - othersSum, 0) };

  return (
    <table style={{ borderCollapse: "collapse", width: "fit-content", marginBottom: 16 }}>
      <thead>
        <tr><td colSpan={7} style={headerStyle}>pinch</td></tr>
      </thead>
      <tbody>
        <tr>
          <td style={labelCellStyle}>배팅종류</td>
          {["martin", "kkangbet", "fixed", "manual", "cruise"].map((t) => (
            <td key={t} style={data.bet_type === t ? activeCell : normalCell}>
              {BET_TYPE_LABELS[t]}
            </td>
          ))}
          <td style={normalCell}></td>
        </tr>
        <tr>
          <td style={labelCellStyle}>단계설정</td>
          <td style={normalCell}>최저</td>
          <td style={activeCell}>{data.step_min}단계</td>
          <td style={normalCell}>최고</td>
          <td style={activeCell}>{data.step_max}단계</td>
          <td style={normalCell}></td>
        </tr>
        {[0, 1, 2, 3].map((rowIdx) => (
          <tr key={`amt-${rowIdx}`}>
            {rowIdx === 0 && <td rowSpan={4} style={labelCellStyle}>금액설정</td>}
            {data.amounts.slice(rowIdx * 5, rowIdx * 5 + 5).map((amt, i) => {
              const idx = rowIdx * 5 + i;
              const step = idx + 1;
              const inRange = step >= data.step_min && step <= data.step_max;
              return (
                <td key={idx} style={normalCell}>
                  {step}:{inRange ? amt : 0}P
                </td>
              );
            })}
            <td style={normalCell}></td>
          </tr>
        ))}
        <tr>
          <td style={labelCellStyle}>게임설정</td>
          <td style={normalCell}>{data.game_start === 0 ? "1회시작" : `${data.game_start}회시작`}</td>
          <td style={normalCell}>{data.game_end === 0 ? "끝까지" : `${data.game_end}회마감`}</td>
          <td style={labelCellStyle}>단계미처리시</td>
          <td style={data.step_carry_over ? activeCell : normalCell}>
            {data.step_carry_over ? "다음게임적용" : "초기화"}
          </td>
          <td style={normalCell}></td>
          <td style={normalCell}></td>
        </tr>
        <tr>
          <td style={{ ...labelCellStyle, color: "#ff9800" }}>손실분배</td>
          {PINCH_METHODS.map((m) => (
            <td key={m} style={{ ...normalCell, color: "#00bcd4", fontWeight: "bold" }}>{m}</td>
          ))}
        </tr>
        <tr>
          <td style={labelCellStyle}>
            <span style={{ fontSize: 9, color: "#888" }}>{totalLoss.toLocaleString()}P</span>
          </td>
          {PINCH_METHODS.map((m, i) => (
            <td key={m} style={{ ...normalCell, color: i === PINCH_METHODS.length - 1 ? "#ff9800" : undefined }}>
              {(dist[m] || 0).toLocaleString()}P
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

export default function CurrentSetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get("gameId");

  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchConfig = useCallback(async () => {
    if (!gameId) {
      setError("게임 ID가 없습니다.");
      setLoading(false);
      return;
    }
    try {
      const res = await apiCaller.get(`/api/v1/games/${gameId}/state`);
      setConfig(res.data.config);
    } catch (err) {
      setError(err.response?.data?.detail || "설정을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  if (loading) return <Box sx={{ p: 2, color: "#888" }}>불러오는 중...</Box>;
  if (error) return <Box sx={{ p: 2, color: "#f44336" }}>{error}</Box>;

  return (
    <Box sx={{ p: 2 }}>
      {/* 상단 바 */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Box
          onClick={() => navigate(gameId ? `/t9game?gameId=${gameId}` : "/t9game")}
          sx={{
            display: "inline-flex", alignItems: "center",
            border: "1px solid rgba(255,255,255,0.3)", borderRadius: 1,
            px: 1.5, py: 0.5, cursor: "pointer", backgroundColor: "background.paper",
            "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" },
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 12 }}>&larr; 뒤로가기</Typography>
        </Box>
      </Box>

      {/* 경고 문구 */}
      <Box sx={{
        mb: 2, p: 1.5, border: "1px solid #ff9800", borderRadius: 1,
        backgroundColor: "rgba(255, 152, 0, 0.08)",
      }}>
        <Typography sx={{ color: "#ff9800", fontSize: 13 }}>
          게임 시작 시 설정이 고정됩니다. 진행 중인 게임의 설정은 변경할 수 없습니다.
        </Typography>
      </Box>

      {/* 테이블 */}
      <Box sx={{ overflowX: "auto" }}>
        <ReadOnlyBettingSection title="Triplenine" data={config?.triplenine} />
        <ReadOnlyGlobalHitSection data={config?.globalhit} />
        <ReadOnlyPinchSection data={config?.pinch} triplenineData={config?.triplenine} />
      </Box>
    </Box>
  );
}
