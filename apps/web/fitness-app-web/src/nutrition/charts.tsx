import { useState } from 'react';

export function Ring({ value, max, label, unit, color = 'var(--accent)', size = 112 }: { value: number; max: number; label: string; unit: string; color?: string; size?: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const over = max > 0 && value > max * 1.1;
  return (
    <figure className="nai-ring" style={{ width: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${label}: ${Math.round(value)} de ${Math.round(max)} ${unit}`}>
        <circle cx="50" cy="50" r={radius} className="nai-ring-track" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          className="nai-ring-fill"
          style={{ stroke: over ? '#ff5d5d' : color }}
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="49" textAnchor="middle" className="nai-ring-value">{Math.round(value)}</text>
        <text x="50" y="64" textAnchor="middle" className="nai-ring-sub">/ {Math.round(max)} {unit}</text>
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export function ProgressBar({ value, max, label, unit, color = 'var(--accent)' }: { value: number; max: number; label: string; unit: string; color?: string }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="nai-bar">
      <div className="nai-bar-head">
        <span>{label}</span>
        <strong>{Math.round(value)} <small>/ {Math.round(max)} {unit}</small></strong>
      </div>
      <div className="nai-bar-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)}>
        <span style={{ width: `${ratio * 100}%`, background: color }} />
      </div>
    </div>
  );
}

export type ChartPoint = { label: string; value: number | null };
export type ChartSeries = { name: string; color: string; points: ChartPoint[] };

const W = 560;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

function niceRange(values: number[], reference?: number) {
  const all = reference !== undefined ? [...values, reference] : values;
  if (!all.length) return { min: 0, max: 1 };
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.12;
  return { min: Math.max(0, min - pad), max: max + pad };
}

/** Gráfico interactivo (SVG). Pasa el cursor o enfoca un punto para ver su valor. */
export function LineChart({ series, unit, reference, referenceLabel, emptyText }: { series: ChartSeries[]; unit: string; reference?: number; referenceLabel?: string; emptyText: string }) {
  const [active, setActive] = useState<number | null>(null);
  const labels = series[0]?.points.map((point) => point.label) ?? [];
  const values = series.flatMap((item) => item.points.map((point) => point.value).filter((value): value is number => value !== null));
  if (values.length === 0) return <p className="nai-empty">{emptyText}</p>;

  const { min, max } = niceRange(values, reference);
  const count = labels.length;
  const x = (index: number) => PAD.left + (count <= 1 ? (W - PAD.left - PAD.right) / 2 : (index / (count - 1)) * (W - PAD.left - PAD.right));
  const y = (value: number) => PAD.top + (1 - (value - min) / (max - min)) * (H - PAD.top - PAD.bottom);
  const ticks = [0, 0.5, 1].map((t) => min + (max - min) * t);
  const labelStep = Math.max(1, Math.ceil(count / 6));

  return (
    <div className="nai-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((item) => item.name).join(', ')} onMouseLeave={() => setActive(null)}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="nai-grid" />
            <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" className="nai-axis">{Math.round(tick * 10) / 10}</text>
          </g>
        ))}
        {reference !== undefined && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(reference)} y2={y(reference)} className="nai-reference" />
            {referenceLabel && <text x={W - PAD.right} y={y(reference) - 4} textAnchor="end" className="nai-axis">{referenceLabel}</text>}
          </g>
        )}
        {labels.map((label, index) => (index % labelStep === 0 ? <text key={label + index} x={x(index)} y={H - 8} textAnchor="middle" className="nai-axis">{label}</text> : null))}
        {series.map((item) => {
          const segments: string[] = [];
          let current = '';
          item.points.forEach((point, index) => {
            if (point.value === null) {
              if (current) segments.push(current);
              current = '';
            } else current += `${current ? 'L' : 'M'}${x(index)},${y(point.value)}`;
          });
          if (current) segments.push(current);
          return (
            <g key={item.name}>
              {segments.map((path) => <path key={path} d={path} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />)}
              {item.points.map((point, index) =>
                point.value === null ? null : (
                  <circle
                    key={index}
                    cx={x(index)}
                    cy={y(point.value)}
                    r={active === index ? 6 : 3.5}
                    fill={item.color}
                    tabIndex={0}
                    aria-label={`${item.name} ${point.label}: ${Math.round(point.value * 10) / 10} ${unit}`}
                    onMouseEnter={() => setActive(index)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                  />
                ),
              )}
            </g>
          );
        })}
      </svg>
      <div className="nai-chart-readout" aria-live="polite">
        {active === null ? (
          <span className="nai-muted">Pasa el cursor o toca un punto para ver el valor.</span>
        ) : (
          <>
            <strong>{labels[active]}</strong>
            {series.map((item) => {
              const value = item.points[active]?.value;
              return <span key={item.name}><i style={{ background: item.color }} />{item.name}: {value === null || value === undefined ? '—' : `${Math.round(value * 10) / 10} ${unit}`}</span>;
            })}
          </>
        )}
      </div>
      {series.length > 1 && (
        <div className="nai-legend">
          {series.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>)}
        </div>
      )}
    </div>
  );
}

/** Barras interactivas con línea de objetivo opcional. */
export function BarChart({ points, unit, target, color = 'var(--accent)', emptyText }: { points: ChartPoint[]; unit: string; target?: number; color?: string; emptyText: string }) {
  const [active, setActive] = useState<number | null>(null);
  const values = points.map((point) => point.value ?? 0);
  if (!points.some((point) => point.value !== null && point.value > 0)) return <p className="nai-empty">{emptyText}</p>;
  const max = Math.max(...values, target ?? 0) * 1.1 || 1;
  const innerW = W - PAD.left - PAD.right;
  const step = innerW / points.length;
  const barW = Math.max(3, Math.min(28, step * 0.62));
  const y = (value: number) => PAD.top + (1 - value / max) * (H - PAD.top - PAD.bottom);
  const labelStep = Math.max(1, Math.ceil(points.length / 7));
  return (
    <div className="nai-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Barras en ${unit}`} onMouseLeave={() => setActive(null)}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(max * t)} y2={y(max * t)} className="nai-grid" />
            <text x={PAD.left - 6} y={y(max * t) + 4} textAnchor="end" className="nai-axis">{Math.round(max * t)}</text>
          </g>
        ))}
        {points.map((point, index) => {
          const value = point.value ?? 0;
          const cx = PAD.left + step * index + step / 2;
          return (
            <g key={index}>
              <rect
                x={cx - barW / 2}
                y={y(value)}
                width={barW}
                height={Math.max(0, H - PAD.bottom - y(value))}
                rx="3"
                fill={color}
                opacity={active === null || active === index ? 1 : 0.45}
                tabIndex={0}
                aria-label={`${point.label}: ${Math.round(value)} ${unit}`}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
              />
              {index % labelStep === 0 && <text x={cx} y={H - 8} textAnchor="middle" className="nai-axis">{point.label}</text>}
            </g>
          );
        })}
        {target !== undefined && <line x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} className="nai-reference" />}
      </svg>
      <div className="nai-chart-readout" aria-live="polite">
        {active === null ? (
          <span className="nai-muted">{target !== undefined ? `Línea discontinua: objetivo (${Math.round(target)} ${unit}). ` : ''}Pasa el cursor o toca una barra.</span>
        ) : (
          <>
            <strong>{points[active].label}</strong>
            <span>{Math.round(points[active].value ?? 0)} {unit}</span>
          </>
        )}
      </div>
    </div>
  );
}
