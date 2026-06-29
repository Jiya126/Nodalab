import { create } from 'zustand';

export interface NodeTrainingMetrics {
  activation: number;
  gradient: number;
  update: number;
}

export interface MetricPoint {
  step: number;
  loss: number | null;
  reward: number | null;
}

export interface TrainingTelemetry {
  job_id: string;
  status: string;
  algorithm: string;
  step: number;
  total_steps: number;
  loss: number | null;
  reward: number | null;
  message: string | null;
  nodes: Record<string, NodeTrainingMetrics>;
  run_name: string;
  seed: number;
  graph_name: string;
  param_count: number;
  started_at: string | null;
  duration_sec: number | null;
  history: MetricPoint[];
}

export interface ExperimentRunSummary {
  job_id: string;
  run_name: string;
  status: string;
  algorithm: string;
  graph_name: string;
  seed: number;
  param_count: number;
  step: number;
  total_steps: number;
  final_loss: number | null;
  final_reward: number | null;
  duration_sec: number | null;
  started_at: string | null;
  history: MetricPoint[];
}

const RUNS_STORAGE_KEY = 'nodalab-experiment-runs';

function loadStoredRuns(): ExperimentRunSummary[] {
  try {
    const raw = localStorage.getItem(RUNS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExperimentRunSummary[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredRuns(runs: ExperimentRunSummary[]) {
  localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(runs.slice(0, 50)));
}

function mergeRuns(serverRuns: ExperimentRunSummary[], storedRuns: ExperimentRunSummary[]): ExperimentRunSummary[] {
  const byId = new Map<string, ExperimentRunSummary>();
  for (const run of storedRuns) byId.set(run.job_id, run);
  for (const run of serverRuns) byId.set(run.job_id, run);
  return Array.from(byId.values()).sort((a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? ''));
}

interface TrainingState {
  telemetry: TrainingTelemetry | null;
  experimentRuns: ExperimentRunSummary[];
  compareRunIds: string[];
  setTelemetry: (telemetry: TrainingTelemetry | null) => void;
  fetchExperimentRuns: () => Promise<void>;
  toggleCompareRun: (jobId: string) => void;
  clearCompareRuns: () => void;
  archiveRun: (run: ExperimentRunSummary) => void;
  clearRunHistory: () => void;
}

export const useTrainingStore = create<TrainingState>((set, get) => ({
  telemetry: null,
  experimentRuns: loadStoredRuns(),
  compareRunIds: [],

  setTelemetry: (telemetry) => {
    set({ telemetry });
    if (telemetry && !['queued', 'running'].includes(telemetry.status)) {
      const run: ExperimentRunSummary = {
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
      };
      get().archiveRun(run);
    }
  },

  fetchExperimentRuns: async () => {
    try {
      const response = await fetch('/api/train/runs');
      if (!response.ok) return;
      const serverRuns = await response.json() as ExperimentRunSummary[];
      const merged = mergeRuns(serverRuns, loadStoredRuns());
      saveStoredRuns(merged);
      set({ experimentRuns: merged });
    } catch {
      set({ experimentRuns: loadStoredRuns() });
    }
  },

  toggleCompareRun: (jobId) => {
    set((state) => {
      const selected = state.compareRunIds.includes(jobId)
        ? state.compareRunIds.filter(id => id !== jobId)
        : [...state.compareRunIds, jobId].slice(-4);
      return { compareRunIds: selected };
    });
  },

  clearCompareRuns: () => set({ compareRunIds: [] }),

  archiveRun: (run) => {
    const merged = mergeRuns([run], get().experimentRuns);
    saveStoredRuns(merged);
    set({ experimentRuns: merged });
  },

  clearRunHistory: () => {
    localStorage.removeItem(RUNS_STORAGE_KEY);
    set({ experimentRuns: [], compareRunIds: [] });
  },
}));
