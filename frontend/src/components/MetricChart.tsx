import type { ExperimentRunSummary } from '../store/trainingStore';

const RUN_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#06b6d4', '#f97316', '#ec4899'];

interface MetricChartProps {
  runs: ExperimentRunSummary[];
  metric: 'loss' | 'reward';
  height?: number;
  compact?: boolean;
}

function getMetricValue(point: { loss: number | null; reward: number | null }, metric: 'loss' | 'reward'): number | null {
  return metric === 'loss' ? point.loss : point.reward;
}

function buildPath(
  values: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  padding: number,
): string {
  if (values.length === 0) return '';
  const xs = values.map(v => v.x);
  const ys = values.map(v => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xSpan = maxX - minX || 1;
  const ySpan = maxY - minY || 1;

  return values
    .map((value, index) => {
      const x = padding + ((value.x - minX) / xSpan) * (width - padding * 2);
      const y = height - padding - ((value.y - minY) / ySpan) * (height - padding * 2);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export default function MetricChart({ runs, metric, height = 120, compact = false }: MetricChartProps) {
  const width = compact ? 240 : 360;
  const padding = 12;

  const series = runs
    .map((run, index) => {
      const points = run.history
        .map(point => {
          const value = getMetricValue(point, metric);
          if (value === null) return null;
          return { x: point.step, y: value };
        })
        .filter((point): point is { x: number; y: number } => point !== null);
      return { run, points, color: RUN_COLORS[index % RUN_COLORS.length] };
    })
    .filter(item => item.points.length > 0);

  if (series.length === 0) {
    return (
      <div
        className="rounded text-[10px] flex items-center justify-center"
        style={{ height, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
      >
        No {metric} history yet
      </div>
    );
  }

  return (
    <div className="rounded p-2" style={{ background: 'var(--bg-tertiary)' }}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="block">
        {series.map(({ run, points, color }) => (
          <path
            key={run.job_id}
            d={buildPath(points, width, height, padding)}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>
      {!compact && (
        <div className="flex flex-wrap gap-2 mt-1">
          {series.map(({ run, color }) => (
            <div key={run.job_id} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="truncate max-w-[120px]">{run.run_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function formatParamCount(n: number): string {
  if (n === 0) return '0';
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000_000_000).toFixed(2)}B`;
}
