export function Sparkline({ values, width = 96, height = 24 }: { values: number[]; width?: number; height?: number }) {
  const max = Math.max(1, ...values);
  const n = values.length;
  if (n < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const pts = values.map((v, i) => `${((i / (n - 1)) * (width - 2) + 1).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`);
  return (
    <svg width={width} height={height} aria-hidden="true" className="spark">
      <polyline points={pts.join(" ")} />
    </svg>
  );
}
