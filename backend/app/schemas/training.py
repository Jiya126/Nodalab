from pydantic import BaseModel, Field

from app.schemas.graph import GraphPayload


class TrainingConfig(BaseModel):
    algorithm: str = "Supervised"
    learning_rate: float = 0.001
    steps: int = 50
    batch_size: int = 8
    env_id: str = "CartPole-v1"
    rollout_steps: int = 64
    ppo_update_epochs: int = 3
    gamma: float = 0.99
    gae_lambda: float = 0.95
    clip_epsilon: float = 0.2
    entropy_coef: float = 0.01
    value_coef: float = 0.5
    grad_clip: float = 1.0
    seed: int = 42
    run_name: str = ""


class TrainingStartRequest(BaseModel):
    graph: GraphPayload
    config: TrainingConfig


class NodeTrainingMetrics(BaseModel):
    activation: float = 0.0
    gradient: float = 0.0
    update: float = 0.0


class MetricPoint(BaseModel):
    step: int
    loss: float | None = None
    reward: float | None = None


class TrainingTelemetry(BaseModel):
    job_id: str
    status: str
    algorithm: str
    step: int = 0
    total_steps: int = 0
    loss: float | None = None
    reward: float | None = None
    message: str | None = None
    nodes: dict[str, NodeTrainingMetrics] = Field(default_factory=dict)
    run_name: str = ""
    seed: int = 42
    graph_name: str = ""
    param_count: int = 0
    started_at: str | None = None
    duration_sec: float | None = None
    history: list[MetricPoint] = Field(default_factory=list)


class ExperimentRunSummary(BaseModel):
    job_id: str
    run_name: str
    status: str
    algorithm: str
    graph_name: str
    seed: int
    param_count: int
    step: int
    total_steps: int
    final_loss: float | None = None
    final_reward: float | None = None
    duration_sec: float | None = None
    started_at: str | None = None
    history: list[MetricPoint] = Field(default_factory=list)


class TrainingStartResponse(BaseModel):
    job_id: str
