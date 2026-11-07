import { Box, Typography } from "@mui/material";

const inputStyle = {
  width: 90, padding: "4px 6px", background: "#16213e", color: "#fff",
  border: "1px solid #2a3a5a", borderRadius: 4, fontSize: 12,
};

export default function FinalBetConditionSettings({ value = {}, onChange }) {
  const patch = (update) => onChange({ ...value, ...update });
  return <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
    <Typography variant="caption" sx={{ fontWeight: "bold" }}>최종 배팅 조건 · 공통</Typography>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
      <label><input type="checkbox" checked={Boolean(value.enabled)}
        onChange={(event) => patch({ enabled: event.target.checked })} />사용</label>
      <input aria-label="최종 배팅 조건 시작 회차" type="number" min="0" step="1"
        value={value.after_round ?? 0} style={inputStyle}
        onChange={(event) => patch({ after_round: event.target.value })} />
      <Typography variant="caption">회차 이후</Typography>
      <select aria-label="최종 배팅 조건 종류" value={value.condition || "pnl"} style={{ ...inputStyle, width: 130 }}
        onChange={(event) => patch({ condition: event.target.value })}>
        <option value="pnl">전체 실배팅 PNL</option><option value="long_runs">긴줄 개수</option>
      </select>
      {value.condition === "long_runs"
        ? <input aria-label="긴줄 개수 기준" type="number" min="0" step="1"
          value={value.long_run_limit ?? 0} style={inputStyle}
          onChange={(event) => patch({ long_run_limit: event.target.value })} />
        : <input aria-label="전체 실배팅 PNL 기준 (P, ×1)" type="number" step="0.1"
          value={value.pnl_limit ?? 0} style={inputStyle}
          onChange={(event) => patch({ pnl_limit: event.target.value })} />}
      <Typography variant="caption">{value.condition === "long_runs" ? "개" : "P"} 이하이면</Typography>
      <select aria-label="최종 배팅 조건 동작" value={value.action || "reverse"} style={{ ...inputStyle, width: 130 }}
        onChange={(event) => patch({ action: event.target.value })}>
        <option value="reverse">반대 배팅</option><option value="stop">배팅 정지</option>
      </select>
      {value.action !== "stop" && <label><input type="checkbox" checked={Boolean(value.restore)}
        onChange={(event) => patch({ restore: event.target.checked })} />조건 해소 시 원래 배팅으로 복귀</label>}
    </Box>
    <Typography variant="caption" color="text.secondary">
      해당 슈 회차 기준 · 긴줄은 5개 이상 연속된 줄입니다.
      정산된 실배팅 PNL을 설정 기준값 × 실배율과 비교합니다. 정지는 해당 슈가 끝날 때까지 유지하며 다음 슈에서 재개합니다.
      {value.action !== "stop" && (value.restore
        ? " 적용 기준값을 초과하면 원래 배팅으로 복귀합니다."
        : " 자동 복귀를 끄면 해당 슈에서는 반대 배팅을 유지합니다.")}
    </Typography>
  </Box>;
}
