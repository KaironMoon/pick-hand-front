import { useEffect, useRef } from "react";
import apiCaller from "@/services/api-caller";
import { USER_BET_SETTINGS_API } from "@/constants/api-url";
import { GH_LABOUCHERE_MAX_COUNT } from "../strategy-step-capacity.js";

const defaults = { target: 0, count: 10, mode: "even", sequence: [] };
const inputStyle = { width: 72, background: "#1a1a1a", border: "1px solid #555", color: "#fff", padding: 4 };

export default function MartinLabouchereRows({ label, martin, onChange }) {
  const requestId = useRef(0);
  const latest = useRef(martin);
  latest.current = martin;
  useEffect(() => () => { requestId.current += 1; }, []);
  const config = { ...defaults, ...martin.labouchere };
  const sequence = Array.isArray(config.sequence) ? config.sequence : [];
  const regenerate = async (patch) => {
    const id = ++requestId.current;
    const next = { ...config, ...patch, sequence: null };
    latest.current = { ...latest.current, labouchere: next };
    onChange(latest.current);
    try {
      const response = await apiCaller.post(USER_BET_SETTINGS_API.GH_LABOUCHERE_SEQUENCE, {
        target: next.target, count: next.count, mode: next.mode,
      });
      const current = latest.current.labouchere;
      if (id !== requestId.current || latest.current.bet_type !== "labouchere"
        || current?.sequence !== null || current.target !== next.target
        || current.count !== next.count || current.mode !== next.mode) return;
      onChange({ ...latest.current, labouchere: { ...next, sequence: response.data.sequence } });
    } catch {
      if (id === requestId.current) window.alert("라보쉐르 수열을 불러오지 못했습니다. 설정값을 확인하고 다시 시도해 주세요.");
    }
  };
  const editSequence = (index, value) => {
    requestId.current += 1;
    onChange({ ...martin, labouchere: { ...config, sequence: sequence.map((item, i) => i === index ? value : item) } });
  };
  return <>
    <tr><td colSpan={6} style={{ padding: 8, border: "1px solid #555" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <label>목표금액 <input aria-label={`${label} 라보쉐르 목표금액`} type="number" min={0} step={0.1}
          value={config.target} style={inputStyle} onChange={(event) => regenerate({ target: Math.max(0, Number(event.target.value)) })} /> P</label>
        <label>개수 <input aria-label={`${label} 라보쉐르 개수`} type="number" min={1} max={GH_LABOUCHERE_MAX_COUNT} step={1}
          value={config.count} style={inputStyle} onChange={(event) => regenerate({ count: Math.max(1, Math.min(GH_LABOUCHERE_MAX_COUNT, Math.trunc(Number(event.target.value) || 1))) })} /></label>
        <label>분배 <select aria-label={`${label} 라보쉐르 분배 방식`} value={config.mode}
          style={inputStyle} onChange={(event) => regenerate({ mode: event.target.value })}>
          <option value="even">균등</option><option value="asc">증가</option><option value="desc">감소</option>
        </select></label>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {sequence.map((value, index) => <label key={index}>{index + 1}:
          <input aria-label={`${label} 라보쉐르 초기 수열 ${index + 1}`} type="number" min={0} step={0.1}
            value={value} style={{ ...inputStyle, width: 58 }}
            onChange={(event) => editSequence(index, Math.max(0, Number(event.target.value)))} />
        </label>)}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#aaa" }}>
        남은 수열의 양끝 합으로 배팅합니다. 적중하면 양끝을 지우고, 실패하면 배팅액을 끝에 추가합니다. 수열이 비면 종료합니다.
      </div>
    </td></tr>
  </>;
}
