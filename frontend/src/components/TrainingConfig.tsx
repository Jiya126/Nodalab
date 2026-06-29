import { useEffect, useState } from 'react';
import { useGraphStore } from '../store/graphStore';
import { useTrainingStore, type TrainingTelemetry } from '../store/trainingStore';
import { generateTrainingCode } from '../engine/trainingCodeGen';
import ExperimentRuns from './ExperimentRuns';
import FloatingPanel, { centeredDefaultBounds, leftDefaultBounds } from './FloatingPanel';
import { Copy, Check, Download, X, Play, Square, Maximize2, Minimize2 } from 'lucide-react';

interface TrainingParams {
  algorithm: string;
  optimizer: string;
  learningRate: number;
  weightDecay: number;
  epochs: number;
  batchSize: number;
  loss: string;
  scheduler: string;
  schedulerStepSize: number;
  schedulerGamma: number;
  gradClip: number;
  mixedPrecision: boolean;
  envId: string;
  rolloutSteps: number;
  ppoUpdateEpochs: number;
  gamma: number;
  gaeLambda: number;
  clipEpsilon: number;
  entropyCoef: number;
  valueCoef: number;
  runName: string;
  seed: number;
}

const DEFAULT_PARAMS: TrainingParams = {
  algorithm: 'Supervised',
  optimizer: 'Adam',
  learningRate: 0.001,
  weightDecay: 0.0,
  epochs: 10,
  batchSize: 32,
  loss: 'CrossEntropyLoss',
  scheduler: 'none',
  schedulerStepSize: 10,
  schedulerGamma: 0.1,
  gradClip: 0.0,
  mixedPrecision: false,
  envId: 'CartPole-v1',
  rolloutSteps: 128,
  ppoUpdateEpochs: 4,
  gamma: 0.99,
  gaeLambda: 0.95,
  clipEpsilon: 0.2,
  entropyCoef: 0.01,
  valueCoef: 0.5,
  runName: '',
  seed: 42,
};

interface Props {
  onClose: () => void;
}

type PanelMode = 'modal' | 'dock-compact' | 'dock-full';

export default function TrainingConfig({ onClose }: Props) {
  const [params, setParams] = useState<TrainingParams>(DEFAULT_PARAMS);
  const [copied, setCopied] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('modal');
  const generatedCode = useGraphStore(s => s.generatedCode);
  const nodes = useGraphStore(s => s.nodes);
  const edges = useGraphStore(s => s.edges);
  const projectId = useGraphStore(s => s.projectId);
  const projectName = useGraphStore(s => s.projectName);
  const telemetry = useTrainingStore(s => s.telemetry);
  const setTelemetry = useTrainingStore(s => s.setTelemetry);
  const fetchExperimentRuns = useTrainingStore(s => s.fetchExperimentRuns);

  const update = <K extends keyof TrainingParams>(key: K, val: TrainingParams[K]) => {
    setParams(p => ({ ...p, [key]: val }));
  };

  const fullCode = generateTrainingCode(generatedCode, params);
  const isTraining = telemetry?.job_id === jobId && ['queued', 'running'].includes(telemetry.status);
  const isDocked = panelMode === 'dock-compact' || panelMode === 'dock-full';
  const settingsDisabled = isTraining;

  useEffect(() => {
    void fetchExperimentRuns();
  }, [fetchExperimentRuns]);

  useEffect(() => {
    if (isTraining && panelMode === 'modal') {
      setPanelMode('dock-compact');
    }
  }, [isTraining, panelMode]);

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const response = await fetch(`/api/train/status/${jobId}`);
        if (!response.ok) throw new Error(`Training status failed: ${response.status}`);
        const data = await response.json() as TrainingTelemetry;
        setTelemetry(data);
        if (!['queued', 'running'].includes(data.status)) {
          setJobId(null);
          void fetchExperimentRuns();
        }
      } catch (error) {
        setRunError(error instanceof Error ? error.message : 'Could not poll training status');
        setJobId(null);
      }
    };

    void poll();
    const interval = window.setInterval(poll, 750);
    return () => window.clearInterval(interval);
  }, [jobId, setTelemetry, fetchExperimentRuns]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([fullCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'train.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  const graphPayload = () => ({
    id: projectId,
    name: projectName,
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.data.blockType,
      position: n.position,
      data: n.data,
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.source,
      sourceHandle: e.sourceHandle ?? null,
      target: e.target,
      targetHandle: e.targetHandle ?? null,
    })),
  });

  const handleStartTraining = async () => {
    if (nodes.length === 0) {
      setRunError('Add blocks to the canvas before training.');
      return;
    }

    setIsStarting(true);
    setRunError(null);

    try {
      const response = await fetch('/api/train/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph: graphPayload(),
          config: {
            algorithm: params.algorithm,
            learning_rate: params.learningRate,
            steps: params.epochs,
            batch_size: params.batchSize,
            env_id: params.envId,
            rollout_steps: params.rolloutSteps,
            ppo_update_epochs: params.ppoUpdateEpochs,
            gamma: params.gamma,
            gae_lambda: params.gaeLambda,
            clip_epsilon: params.clipEpsilon,
            entropy_coef: params.entropyCoef,
            value_coef: params.valueCoef,
            grad_clip: params.gradClip,
            seed: params.seed,
            run_name: params.runName,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const detail = data.detail
        const message = typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join('; ')
            : data.error
        throw new Error(message || 'Could not start training')
      }
      setJobId(data.job_id);
      setPanelMode('dock-compact');
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Could not start training');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopTraining = async () => {
    if (!jobId) return;
    await fetch(`/api/train/stop/${jobId}`, { method: 'POST' });
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <button
        onClick={isTraining ? handleStopTraining : handleStartTraining}
        disabled={isStarting}
        className="flex items-center gap-1 px-2 py-1.5 rounded text-xs hover:bg-white/10"
        style={{ color: 'var(--accent)' }}
        title={isTraining ? 'Stop live training' : 'Start live training visualization'}
      >
        {isTraining ? <Square size={14} /> : <Play size={14} />}
        {isStarting ? 'Starting...' : isTraining ? 'Stop' : 'Train'}
      </button>
      {!isDocked && (
        <>
          <button onClick={handleCopy} className="p-1.5 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }} title="Copy">
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
          <button onClick={handleDownload} className="p-1.5 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }} title="Download train.py">
            <Download size={14} />
          </button>
        </>
      )}
      {isDocked && (
        <button
          onClick={() => setPanelMode(panelMode === 'dock-compact' ? 'dock-full' : 'dock-compact')}
          className="p-1.5 rounded hover:bg-white/10"
          style={{ color: 'var(--text-muted)' }}
          title={panelMode === 'dock-compact' ? 'Expand panel' : 'Compact panel'}
        >
          {panelMode === 'dock-compact' ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
        </button>
      )}
      <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>
        <X size={14} />
      </button>
    </div>
  );

  const configFields = (
    <div className="space-y-3">
      <Section title="Experiment">
        <StringField
          label="Run Name"
          value={params.runName}
          onChange={v => update('runName', v)}
          disabled={settingsDisabled}
          placeholder={`e.g. ${projectName} MLP`}
        />
        <NumberField label="Seed" value={params.seed} onChange={v => update('seed', v)} step={1} disabled={settingsDisabled} />
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          Use the same seed when comparing architectures for fair, reproducible runs.
        </div>
      </Section>

      <Section title="Algorithm">
        <SelectField
          value={params.algorithm}
          onChange={v => update('algorithm', v)}
          options={['Supervised', 'PPO']}
          disabled={settingsDisabled}
        />
      </Section>

      <Section title="Optimizer">
        <SelectField
          value={params.optimizer}
          onChange={v => update('optimizer', v)}
          options={['Adam', 'AdamW', 'SGD', 'RMSprop']}
          disabled={settingsDisabled}
        />
        <NumberField label="Learning Rate" value={params.learningRate} onChange={v => update('learningRate', v)} step={0.0001} disabled={settingsDisabled} />
        <NumberField label="Weight Decay" value={params.weightDecay} onChange={v => update('weightDecay', v)} step={0.001} disabled={settingsDisabled} />
      </Section>

      <Section title="Training">
        <NumberField label={params.algorithm === 'PPO' ? 'PPO Updates' : 'Epochs'} value={params.epochs} onChange={v => update('epochs', v)} step={1} disabled={settingsDisabled} />
        {params.algorithm === 'Supervised' && (
          <NumberField label="Batch Size" value={params.batchSize} onChange={v => update('batchSize', v)} step={1} disabled={settingsDisabled} />
        )}
        <NumberField label="Grad Clip (0=off)" value={params.gradClip} onChange={v => update('gradClip', v)} step={0.1} disabled={settingsDisabled} />
        {params.algorithm === 'Supervised' && (
          <BoolField label="Mixed Precision" value={params.mixedPrecision} onChange={v => update('mixedPrecision', v)} disabled={settingsDisabled} />
        )}
      </Section>

      {params.algorithm === 'Supervised' ? (
        <>
          <Section title="Loss Function">
            <SelectField
              value={params.loss}
              onChange={v => update('loss', v)}
              options={['CrossEntropyLoss', 'MSELoss', 'BCEWithLogitsLoss', 'L1Loss', 'NLLLoss']}
              disabled={settingsDisabled}
            />
          </Section>

          <Section title="LR Scheduler">
            <SelectField
              value={params.scheduler}
              onChange={v => update('scheduler', v)}
              options={['none', 'StepLR', 'CosineAnnealingLR', 'ReduceLROnPlateau']}
              disabled={settingsDisabled}
            />
            {params.scheduler === 'StepLR' && (
              <>
                <NumberField label="Step Size" value={params.schedulerStepSize} onChange={v => update('schedulerStepSize', v)} step={1} disabled={settingsDisabled} />
                <NumberField label="Gamma" value={params.schedulerGamma} onChange={v => update('schedulerGamma', v)} step={0.01} disabled={settingsDisabled} />
              </>
            )}
          </Section>
        </>
      ) : (
        <>
          <Section title="Environment">
            <StringField label="Gymnasium Env ID" value={params.envId} onChange={v => update('envId', v)} disabled={settingsDisabled} />
            {panelMode !== 'dock-compact' && (
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                PPO feeds environment observations into your graph. If the env obs size does not match the Input block,
                an automatic adapter is added. For CartPole-v1, use a policy like Input(null,4) → Linear → Linear(out=2).
              </div>
            )}
          </Section>

          <Section title="PPO Policy">
            <NumberField label="Rollout Steps" value={params.rolloutSteps} onChange={v => update('rolloutSteps', v)} step={1} disabled={settingsDisabled} />
            <NumberField label="Update Epochs" value={params.ppoUpdateEpochs} onChange={v => update('ppoUpdateEpochs', v)} step={1} disabled={settingsDisabled} />
            <NumberField label="Gamma" value={params.gamma} onChange={v => update('gamma', v)} step={0.01} disabled={settingsDisabled} />
            <NumberField label="GAE Lambda" value={params.gaeLambda} onChange={v => update('gaeLambda', v)} step={0.01} disabled={settingsDisabled} />
            <NumberField label="Clip Epsilon" value={params.clipEpsilon} onChange={v => update('clipEpsilon', v)} step={0.01} disabled={settingsDisabled} />
            <NumberField label="Entropy Coef" value={params.entropyCoef} onChange={v => update('entropyCoef', v)} step={0.001} disabled={settingsDisabled} />
            <NumberField label="Value Coef" value={params.valueCoef} onChange={v => update('valueCoef', v)} step={0.1} disabled={settingsDisabled} />
          </Section>
        </>
      )}
    </div>
  );

  const telemetryPanel = (
    <TelemetryPanel telemetry={telemetry} runError={runError} compact={panelMode === 'dock-compact'} />
  );

  const panelTitle = isTraining ? 'Training Live' : 'Training Configuration';
  const panelStorageKey = 'nodalab-training-panel-bounds';
  const panelDefaultBounds = isDocked
    ? leftDefaultBounds(panelMode === 'dock-compact' ? 300 : 420, 520)
    : centeredDefaultBounds(900, Math.min(700, window.innerHeight - 120));
  const panelMinWidth = isDocked ? 260 : 480;
  const panelMinHeight = isDocked ? 280 : 360;

  const panelBody = isDocked ? (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {telemetryPanel}
        <ExperimentRuns compact={panelMode === 'dock-compact'} activeJobId={jobId ?? telemetry?.job_id ?? null} />
        {panelMode === 'dock-compact' ? (
          <div className="text-[10px] rounded p-2" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
            <div>{params.algorithm} · {params.algorithm === 'PPO' ? params.envId : `${params.epochs} epochs`} · seed {params.seed}</div>
            <div className="mt-1">Drag the header to move · corner grip to resize.</div>
          </div>
        ) : (
          configFields
        )}
      </div>
      {panelMode === 'dock-full' && (
        <div className="h-40 shrink-0 border-t overflow-auto" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
          <pre className="p-3 text-[10px] font-mono leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            <code>{fullCode}</code>
          </pre>
        </div>
      )}
    </>
  ) : (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <div className="w-72 p-4 overflow-y-auto border-r space-y-3 shrink-0" style={{ borderColor: 'var(--border-color)' }}>
        {configFields}
        <Section title="Live Telemetry">
          {telemetryPanel}
        </Section>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0" style={{ background: 'var(--bg-primary)' }}>
          <ExperimentRuns activeJobId={jobId ?? telemetry?.job_id ?? null} />
        </div>
        <div className="h-40 shrink-0 border-t overflow-auto" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
          <pre className="p-4 text-xs font-mono leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            <code>{fullCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );

  return (
    <FloatingPanel
      title={panelTitle}
      storageKey={panelStorageKey}
      defaultBounds={panelDefaultBounds}
      minWidth={panelMinWidth}
      minHeight={panelMinHeight}
      headerActions={headerActions}
    >
      {panelBody}
    </FloatingPanel>
  );
}

function TelemetryPanel({
  telemetry,
  runError,
  compact,
}: {
  telemetry: TrainingTelemetry | null;
  runError: string | null;
  compact?: boolean;
}) {
  const progress = telemetry && telemetry.total_steps > 0
    ? Math.min(100, (telemetry.step / telemetry.total_steps) * 100)
    : 0;

  return (
    <div className="text-xs rounded p-2.5" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
      {telemetry ? (
        <div className="space-y-2">
          {telemetry.run_name && (
            <div className="flex items-center justify-between gap-2">
              <span>Run</span>
              <span className="font-mono truncate max-w-[140px]">{telemetry.run_name}</span>
            </div>
          )}
          {telemetry.param_count > 0 && (
            <div className="flex items-center justify-between gap-2">
              <span>Params</span>
              <span className="font-mono">{telemetry.param_count.toLocaleString()}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span>Status</span>
            <span className="font-mono capitalize" style={{ color: telemetry.status === 'running' ? 'var(--accent)' : 'var(--text-primary)' }}>
              {telemetry.status}
            </span>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span>Step</span>
              <span className="font-mono">{telemetry.step}/{telemetry.total_steps}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: 'var(--accent)' }}
              />
            </div>
          </div>
          {telemetry.loss !== null && (
            <div className="flex items-center justify-between gap-2">
              <span>Loss</span>
              <span className="font-mono">{telemetry.loss.toFixed(5)}</span>
            </div>
          )}
          {telemetry.reward !== null && (
            <div className="flex items-center justify-between gap-2">
              <span>Reward</span>
              <span className="font-mono">{telemetry.reward.toFixed(2)}</span>
            </div>
          )}
          {telemetry.message && !compact && (
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{telemetry.message}</div>
          )}
        </div>
      ) : (
        <div>Click Train to stream activation, gradient, and weight update metrics to the graph.</div>
      )}
      {runError && (
        <div className="mt-2 text-[10px]" style={{ color: 'var(--error)' }}>{runError}</div>
      )}
    </div>
  );
}

function StringField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full px-2 py-1 rounded text-xs outline-none disabled:opacity-60"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function NumberField({ label, value, onChange, step, disabled }: { label: string; value: number; onChange: (v: number) => void; step: number; disabled?: boolean }) {
  return (
    <div>
      <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input
        type="number"
        value={value}
        step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        disabled={disabled}
        className="w-full px-2 py-1 rounded text-xs outline-none disabled:opacity-60"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
      />
    </div>
  );
}

function SelectField({ value, onChange, options, disabled }: { value: string; onChange: (v: string) => void; options: string[]; disabled?: boolean }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-2 py-1 rounded text-xs outline-none disabled:opacity-60"
      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function BoolField({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-2 ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} disabled={disabled} className="accent-indigo-500" />
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </label>
  );
}
