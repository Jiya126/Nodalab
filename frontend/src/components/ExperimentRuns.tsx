import { useMemo } from 'react';
import { BarChart3, Trash2 } from 'lucide-react';
import { useTrainingStore, type ExperimentRunSummary } from '../store/trainingStore';
import MetricChart, { formatDuration, formatParamCount } from './MetricChart';

interface Props {
  compact?: boolean;
  activeJobId?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#22c55e',
  running: '#6366f1',
  queued: '#f59e0b',
  stopped: '#94a3b8',
  error: '#ef4444',
};

function finalMetric(run: ExperimentRunSummary): string {
  if (run.algorithm === 'PPO' && run.final_reward !== null) {
    return `reward ${run.final_reward.toFixed(1)}`;
  }
  if (run.final_loss !== null) {
    return `loss ${run.final_loss.toFixed(4)}`;
  }
  return '—';
}

function RunSummaryCard({
  run,
  selected,
  active,
  onToggle,
}: {
  run: ExperimentRunSummary;
  selected: boolean;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left rounded p-2 transition-colors"
      style={{
        background: active ? 'rgba(99, 102, 241, 0.12)' : selected ? 'rgba(34, 197, 94, 0.08)' : 'var(--bg-primary)',
        border: `1px solid ${active ? 'var(--accent)' : selected ? '#22c55e' : 'var(--border-color)'}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {run.run_name}
          </div>
          <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
            {run.graph_name} · {run.algorithm} · seed {run.seed}
          </div>
        </div>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded capitalize shrink-0"
          style={{
            color: STATUS_COLORS[run.status] ?? 'var(--text-muted)',
            background: 'var(--bg-tertiary)',
          }}
        >
          {run.status}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
        <span>Final: <span className="font-mono">{finalMetric(run)}</span></span>
        <span>Params: <span className="font-mono">{formatParamCount(run.param_count)}</span></span>
        <span>Steps: <span className="font-mono">{run.step}/{run.total_steps}</span></span>
        <span>Time: <span className="font-mono">{formatDuration(run.duration_sec)}</span></span>
      </div>
    </button>
  );
}

export default function ExperimentRuns({ compact = false, activeJobId = null }: Props) {
  const experimentRuns = useTrainingStore(s => s.experimentRuns);
  const compareRunIds = useTrainingStore(s => s.compareRunIds);
  const toggleCompareRun = useTrainingStore(s => s.toggleCompareRun);
  const clearRunHistory = useTrainingStore(s => s.clearRunHistory);
  const telemetry = useTrainingStore(s => s.telemetry);

  const compareRuns = useMemo(() => {
    const selected = experimentRuns.filter(run => compareRunIds.includes(run.job_id));
    if (selected.length > 0) return selected;
    if (telemetry && ['queued', 'running'].includes(telemetry.status)) {
      return [{
        job_id: telemetry.job_id,
        run_name: telemetry.run_name,
        status: telemetry.status,
        algorithm: telemetry.algorithm,
        graph_name: telemetry.graph_name,
        seed: telemetry.seed,
        param_count: telemetry.param_count,
        step: telemetry.step,
        total_steps: telemetry.total_steps,
        final_loss: telemetry.loss,
        final_reward: telemetry.reward,
        duration_sec: telemetry.duration_sec,
        started_at: telemetry.started_at,
        history: telemetry.history,
      }];
    }
    return experimentRuns.slice(0, 1);
  }, [compareRunIds, experimentRuns, telemetry]);

  const chartMetric: 'loss' | 'reward' = compareRuns.some(run => run.algorithm === 'PPO') ? 'reward' : 'loss';
  const visibleRuns = compact ? experimentRuns.slice(0, 3) : experimentRuns;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <BarChart3 size={12} style={{ color: 'var(--accent)' }} />
          <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Experiment Runs
          </span>
        </div>
        {!compact && experimentRuns.length > 0 && (
          <button
            type="button"
            onClick={clearRunHistory}
            className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded hover:bg-white/10"
            style={{ color: 'var(--text-muted)' }}
          >
            <Trash2 size={10} />
            Clear
          </button>
        )}
      </div>

      <MetricChart runs={compareRuns} metric={chartMetric} compact={compact} height={compact ? 72 : 120} />

      {!compact && compareRunIds.length > 0 && (
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          Comparing {compareRunIds.length} run{compareRunIds.length === 1 ? '' : 's'} on the chart. Click a card to toggle.
        </div>
      )}

      <div className="space-y-2">
        {visibleRuns.length === 0 ? (
          <div className="text-[10px] rounded p-2" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
            Named runs appear here with loss/reward curves so you can compare architectures.
          </div>
        ) : (
          visibleRuns.map(run => (
            <RunSummaryCard
              key={run.job_id}
              run={run}
              selected={compareRunIds.includes(run.job_id)}
              active={activeJobId === run.job_id}
              onToggle={() => toggleCompareRun(run.job_id)}
            />
          ))
        )}
      </div>

      {compact && experimentRuns.length > 3 && (
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          +{experimentRuns.length - 3} more runs — expand panel to see all
        </div>
      )}
    </div>
  );
}
