import { useMemo, useRef, useState } from "react";
import type { SeriesPoint } from "../lib/api";
import { fmt } from "../lib/format";
import { useWidth } from "./useWidth";

export interface Metric {
  id: string;
  label: string;
  pick: (p: SeriesPoint) => number;
  format: (n: number) => string;
}

interface Props {
  series: SeriesPoint[];
  prevSeries: SeriesPoint[];
  from: number;
  to: number;
  bucket: number;
  metric: Metric;
}

const HEIGHT = 260;
const PAD = { top: 16, right: 12, bottom: 28, left: 48 };

function niceMax(v: number) {
  if (v <= 0) return 4;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * exp * 4 >= v) ?? 10;
  return step * exp * 4;
}

export function TrafficChart({ series, prevSeries, from, to, bucket, metric }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const n = Math.max(1, Math.ceil((to - from) / bucket));
  const { cur, prev } = useMemo(() => {
    const cur = new Array<number | null>(n).fill(0);
    const prev = new Array<number>(n).fill(0);
    for (const p of series) if (p.b >= 0 && p.b < n) cur[p.b] = metric.pick(p);
    for (const p of prevSeries) if (p.b >= 0 && p.b < n) prev[p.b] = metric.pick(p);
    // Buckets that have not happened yet are left out, not drawn as zero.
    const now = Date.now();
    for (let i = 0; i < n; i++) if (from + i * bucket > now) cur[i] = null;
    return { cur, prev };
  }, [series, prevSeries, n, from, bucket, metric]);

  const max = niceMax(Math.max(...cur.map((v) => v ?? 0), ...prev, 0));
  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const line = (vals: (number | null)[]) => {
    let d = "";
    vals.forEach((v, i) => {
      if (v == null) return;
      d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    });
    return d;
  };
  const lastReal = cur.reduce<number>((acc, v, i) => (v == null ? acc : i), 0);
  const curLine = line(cur);
  const area = curLine ? `${curLine}L${x(lastReal)},${y(0)}L${x(0)},${y(0)}Z` : "";

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 90))));
  const label = (i: number) => {
    const t = from + i * bucket;
    return bucket < 24 * 3600_000 ? fmt.hour(t) : fmt.day(t);
  };

  function onMove(e: React.PointerEvent) {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    const rel = (e.clientX - box.left - PAD.left) / innerW;
    const i = Math.round(rel * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  }

  const h = hover != null && cur[hover] != null ? hover : null;
  const tipLeft = h != null ? Math.min(Math.max(x(h), 90), width - 90) : 0;

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg
          ref={svgRef}
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${metric.label} over the selected period`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line className="chart-grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
              <text className="chart-axis" x={PAD.left - 10} y={y(t)} dy="0.32em" textAnchor="end">
                {metric.format(t)}
              </text>
            </g>
          ))}
          {cur.map((_, i) =>
            i % labelEvery === 0 ? (
              <text key={i} className="chart-axis" x={x(i)} y={HEIGHT - 6} textAnchor="middle">
                {label(i)}
              </text>
            ) : null,
          )}
          <path className="chart-prev" d={line(prev)} />
          <path className="chart-area" d={area} />
          <path className="chart-line" d={curLine} />
          {h != null && (
            <g>
              <line className="chart-cursor" x1={x(h)} x2={x(h)} y1={PAD.top} y2={PAD.top + innerH} />
              <circle className="chart-dot" cx={x(h)} cy={y(cur[h] ?? 0)} r={4.5} />
            </g>
          )}
        </svg>
      )}
      {h != null && (
        <div className="chart-tip stock" style={{ transform: `translateX(${tipLeft}px)` }}>
          <p className="chart-tip-when">{bucket < 24 * 3600_000 ? fmt.full(from + h * bucket) : fmt.dayYear(from + h * bucket)}</p>
          <p className="chart-tip-value">
            <span className="fig">{metric.format(cur[h] ?? 0)}</span> {metric.label.toLowerCase()}
          </p>
          <p className="chart-tip-prev">
            <span className="fig">{metric.format(prev[h])}</span> the period before
          </p>
        </div>
      )}
    </div>
  );
}
