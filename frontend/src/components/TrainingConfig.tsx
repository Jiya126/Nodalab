import { useState } from 'react';
import { useGraphStore } from '../store/graphStore';
import { generateTrainingCode } from '../engine/trainingCodeGen';
import { Copy, Check, Download, X, Settings } from 'lucide-react';

interface TrainingParams {
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
}

const DEFAULT_PARAMS: TrainingParams = {
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
};

interface Props {
  onClose: () => void;
}

export default function TrainingConfig({ onClose }: Props) {
  const [params, setParams] = useState<TrainingParams>(DEFAULT_PARAMS);
  const [copied, setCopied] = useState(false);
  const generatedCode = useGraphStore(s => s.generatedCode);

  const update = <K extends keyof TrainingParams>(key: K, val: TrainingParams[K]) => {
    setParams(p => ({ ...p, [key]: val }));
  };

  const fullCode = generateTrainingCode(generatedCode, params);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-[900px] max-h-[85vh] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2">
            <Settings size={16} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Training Configuration
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="p-1.5 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }} title="Copy">
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
            <button onClick={handleDownload} className="p-1.5 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }} title="Download train.py">
              <Download size={14} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-72 p-4 overflow-y-auto border-r space-y-3" style={{ borderColor: 'var(--border-color)' }}>
            <Section title="Optimizer">
              <SelectField
                value={params.optimizer}
                onChange={v => update('optimizer', v)}
                options={['Adam', 'AdamW', 'SGD', 'RMSprop']}
              />
              <NumberField label="Learning Rate" value={params.learningRate} onChange={v => update('learningRate', v)} step={0.0001} />
              <NumberField label="Weight Decay" value={params.weightDecay} onChange={v => update('weightDecay', v)} step={0.001} />
            </Section>

            <Section title="Training">
              <NumberField label="Epochs" value={params.epochs} onChange={v => update('epochs', v)} step={1} />
              <NumberField label="Batch Size" value={params.batchSize} onChange={v => update('batchSize', v)} step={1} />
              <NumberField label="Grad Clip (0=off)" value={params.gradClip} onChange={v => update('gradClip', v)} step={0.1} />
              <BoolField label="Mixed Precision" value={params.mixedPrecision} onChange={v => update('mixedPrecision', v)} />
            </Section>

            <Section title="Loss Function">
              <SelectField
                value={params.loss}
                onChange={v => update('loss', v)}
                options={['CrossEntropyLoss', 'MSELoss', 'BCEWithLogitsLoss', 'L1Loss', 'NLLLoss']}
              />
            </Section>

            <Section title="LR Scheduler">
              <SelectField
                value={params.scheduler}
                onChange={v => update('scheduler', v)}
                options={['none', 'StepLR', 'CosineAnnealingLR', 'ReduceLROnPlateau']}
              />
              {params.scheduler === 'StepLR' && (
                <>
                  <NumberField label="Step Size" value={params.schedulerStepSize} onChange={v => update('schedulerStepSize', v)} step={1} />
                  <NumberField label="Gamma" value={params.schedulerGamma} onChange={v => update('schedulerGamma', v)} step={0.01} />
                </>
              )}
            </Section>
          </div>

          <pre className="flex-1 overflow-auto p-4 text-xs font-mono leading-relaxed" style={{ color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>
            <code>{fullCode}</code>
          </pre>
        </div>
      </div>
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

function NumberField({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step: number }) {
  return (
    <div>
      <label className="text-[10px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input
        type="number"
        value={value}
        step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-2 py-1 rounded text-xs outline-none"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
      />
    </div>
  );
}

function SelectField({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-2 py-1 rounded text-xs outline-none"
      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function BoolField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} className="accent-indigo-500" />
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </label>
  );
}
