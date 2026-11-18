import { Fragment, useEffect, useRef, useState } from "react";
import { PATTERN_ROW_HEIGHT, patternRowWindow } from "../pattern-row-window.js";

// Keep the first row for intrinsic table width, plus the visible rows and any focused row.
export default function WindowedPatternRows({ rowCount, renderRow, constrainWidth = false, columnCount }) {
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

  const Container = columnCount ? "tbody" : "div";
  const spacer = (rows) => {
    const height = rows * PATTERN_ROW_HEIGHT;
    return columnCount
      ? <tr aria-hidden="true"><td colSpan={columnCount} style={{ height, padding: 0, border: 0 }} /></tr>
      : <div aria-hidden="true" style={{ height }} />;
  };

  return (
    <Container
      ref={listRef}
      style={columnCount
        ? { overflowAnchor: "none" }
        : { width: constrainWidth ? "100%" : "max-content", minWidth: "100%", overflowAnchor: "none" }}
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
            {gap > 0 && spacer(gap)}
            {renderRow(index)}
          </Fragment>
        );
      })}
      {previous < rowCount - 1 && spacer(rowCount - previous - 1)}
    </Container>
  );
}
