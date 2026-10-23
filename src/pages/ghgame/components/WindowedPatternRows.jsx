import { Fragment, useEffect, useRef, useState } from "react";
import { PATTERN_ROW_HEIGHT, patternRowWindow } from "../pattern-row-window.js";

// Keep the first row for intrinsic table width, plus the visible rows and any focused row.
export default function WindowedPatternRows({ rowCount, renderRow }) {
  const listRef = useRef(null);
  const [range, setRange] = useState({ start: 1, end: 1 });
  const [focusedRow, setFocusedRow] = useState(null);

  useEffect(() => {
    const list = listRef.current;
    let frame = null;
    const update = () => {
      frame = null;
      const next = patternRowWindow(rowCount, list.getBoundingClientRect().top, window.innerHeight);
      setRange((previous) => previous.start === next.start && previous.end === next.end ? previous : next);
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [rowCount]);

  const indices = new Set(rowCount > 0 ? [0] : []);
  for (let index = range.start; index < range.end; index += 1) indices.add(index);
  if (focusedRow !== null && focusedRow < rowCount) indices.add(focusedRow);
  const visible = [...indices].sort((a, b) => a - b);
  let previous = -1;

  return (
    <div
      ref={listRef}
      style={{ width: "max-content", minWidth: "100%", overflowAnchor: "none" }}
      onFocusCapture={(event) => {
        const row = event.target.closest("[data-pattern-row]");
        if (row) setFocusedRow(Number(row.dataset.patternRow));
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusedRow(null);
      }}
    >
      {visible.map((index) => {
        const gap = index - previous - 1;
        previous = index;
        return (
          <Fragment key={index}>
            {gap > 0 && <div aria-hidden="true" style={{ height: gap * PATTERN_ROW_HEIGHT }} />}
            {renderRow(index)}
          </Fragment>
        );
      })}
      {previous < rowCount - 1 && (
        <div aria-hidden="true" style={{ height: (rowCount - previous - 1) * PATTERN_ROW_HEIGHT }} />
      )}
    </div>
  );
}
