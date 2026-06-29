import math
import random
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

import torch
import torch.nn as nn
import torch.nn.functional as F

from app.schemas.graph import GraphPayload
from app.schemas.training import (
    ExperimentRunSummary,
    MetricPoint,
    NodeTrainingMetrics,
    TrainingConfig,
    TrainingTelemetry,
)
from app.services.block_validator import compile_custom_forward
from app.services.model_builder import ACTIVATIONS, _build_layer, _topological_sort


def _parse_shape(dims: str, batch_size: int) -> list[int]:
    shape: list[int] = []
    for dim in dims.split(","):
        dim = dim.strip()
        shape.append(batch_size if dim in ("null", "N", "B") else int(dim))
    return shape


def _graph_input_shape(graph: GraphPayload) -> list[int]:
    input_nodes = [node for node in graph.nodes if node.data.blockType == "Input"]
    if not input_nodes:
        raise ValueError("No Input block found in graph")
    dims_str = str(input_nodes[0].data.params.get("dims", "null,512"))
    shape: list[int] = []
    for dim in dims_str.split(","):
        dim = dim.strip()
        if dim not in ("null", "N", "B"):
            shape.append(int(dim))
    return shape


def _env_obs_dim(env) -> int:
    space = env.observation_space
    if getattr(space, "shape", None) is not None:
        return int(torch.tensor(space.shape).prod().item())
    raise ValueError(f"Unsupported observation space for PPO: {space}")


def _env_action_dim(env) -> int:
    space = env.action_space
    if hasattr(space, "n"):
        return int(space.n)
    raise ValueError(
        f"PPO currently supports discrete action spaces only (env.action_space.n). Got: {space}"
    )


def _set_seed(seed: int) -> None:
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def _count_graph_params(graph: GraphPayload, algorithm: str, env_id: str) -> int:
    model = GraphTrainingModule(graph)
    if algorithm == "PPO":
        import gymnasium as gym

        env = gym.make(env_id)
        try:
            obs_dim = _env_obs_dim(env)
            action_dim = _env_action_dim(env)
            agent = PPOPolicyAgent(model, graph, obs_dim, action_dim)
            return sum(param.numel() for param in agent.parameters())
        finally:
            env.close()
    return sum(param.numel() for param in model.parameters())


def _telemetry_to_summary(telemetry: TrainingTelemetry) -> ExperimentRunSummary:
    return ExperimentRunSummary(
        job_id=telemetry.job_id,
        run_name=telemetry.run_name,
        status=telemetry.status,
        algorithm=telemetry.algorithm,
        graph_name=telemetry.graph_name,
        seed=telemetry.seed,
        param_count=telemetry.param_count,
        step=telemetry.step,
        total_steps=telemetry.total_steps,
        final_loss=telemetry.loss,
        final_reward=telemetry.reward,
        duration_sec=telemetry.duration_sec,
        started_at=telemetry.started_at,
        history=telemetry.history,
    )


def _tensor_norm(tensor: torch.Tensor | None) -> float:
    if tensor is None:
        return 0.0
    return float(tensor.detach().float().norm().item())


def _param_norm(params: list[torch.Tensor]) -> float:
    total = 0.0
    for param in params:
        total += float(param.detach().float().pow(2).sum().item())
    return math.sqrt(total)


def _grad_norm(module: nn.Module | None) -> float:
    if module is None:
        return 0.0
    total = 0.0
    for param in module.parameters():
        if param.grad is not None:
            total += float(param.grad.detach().float().pow(2).sum().item())
    return math.sqrt(total)


class GraphTrainingModule(nn.Module):
    def __init__(self, graph: GraphPayload):
        super().__init__()
        self.graph = graph
        self.sorted_ids = _topological_sort(graph.nodes, graph.edges)
        self.node_map = {node.id: node for node in graph.nodes}
        self.layers = nn.ModuleDict()
        self.custom_forwards = {}

        for node_id in self.sorted_ids:
            node = self.node_map[node_id]
            block_type = node.data.blockType
            if block_type == "Custom":
                self.custom_forwards[node_id] = compile_custom_forward(
                    str(node.data.params.get("code", "return x")),
                    ["x"],
                )
                continue

            layer = _build_layer(block_type, node.data.params)
            if layer is not None:
                self.layers[node_id] = layer

    def forward(self, x: torch.Tensor):
        tensors: dict[str, torch.Tensor] = {}
        activations: dict[str, torch.Tensor] = {}

        for node_id in self.sorted_ids:
            node = self.node_map[node_id]
            block_type = node.data.blockType
            params = node.data.params

            if block_type == "Input":
                tensors[node_id] = x
                activations[node_id] = x
                continue

            incoming = [edge for edge in self.graph.edges if edge.target == node_id]

            if block_type == "Output":
                if incoming and incoming[0].source in tensors:
                    tensors[node_id] = tensors[incoming[0].source]
                    activations[node_id] = tensors[node_id]
                continue

            input_tensors = [tensors[edge.source] for edge in incoming if edge.source in tensors]
            if not input_tensors:
                continue

            current = input_tensors[0]

            if block_type in ACTIVATIONS:
                if block_type == "Softmax":
                    out = F.softmax(current, dim=int(params.get("dim", -1)))
                else:
                    out = ACTIVATIONS[block_type](current)
            elif block_type == "Add" and len(input_tensors) >= 2:
                out = input_tensors[0] + input_tensors[1]
            elif block_type == "Concat" and len(input_tensors) >= 2:
                out = torch.cat(input_tensors, dim=int(params.get("dim", -1)))
            elif block_type == "Reshape":
                new_shape = [int(dim.strip()) for dim in str(params.get("shape", "-1")).split(",")]
                out = current.view(*new_shape)
            elif block_type == "Custom":
                out = self.custom_forwards[node_id](current)
                if not isinstance(out, torch.Tensor):
                    raise ValueError(f"Custom block '{node.data.label}' must return a tensor")
            elif node_id in self.layers:
                layer = self.layers[node_id]
                if block_type == "Embedding":
                    vocab_size = int(params.get("num_embeddings", 10000))
                    current = torch.randint(
                        0,
                        vocab_size,
                        current.shape,
                        dtype=torch.long,
                        device=current.device,
                    )
                    out = layer(current)
                elif block_type == "LSTM":
                    out, _ = layer(current)
                elif block_type == "MultiHeadAttention":
                    out, _ = layer(current, current, current)
                else:
                    out = layer(current)
            else:
                out = current

            tensors[node_id] = out
            activations[node_id] = out

        output_nodes = [node for node in self.graph.nodes if node.data.blockType == "Output"]
        if output_nodes and output_nodes[0].id in tensors:
            return tensors[output_nodes[0].id], activations
        if not tensors:
            raise ValueError("Graph did not produce any tensors")
        return tensors[next(reversed(tensors))], activations

    def node_metrics(
        self,
        activations: dict[str, torch.Tensor],
        before_params: dict[str, list[torch.Tensor]],
    ) -> dict[str, NodeTrainingMetrics]:
        metrics: dict[str, NodeTrainingMetrics] = {}
        for node_id, activation in activations.items():
            layer = self.layers[node_id] if node_id in self.layers else None
            update = 0.0
            if layer is not None and node_id in before_params:
                deltas = [
                    param.detach() - before
                    for param, before in zip(layer.parameters(), before_params[node_id])
                ]
                update = _param_norm(deltas)
            metrics[node_id] = NodeTrainingMetrics(
                activation=_tensor_norm(activation),
                gradient=_grad_norm(layer),
                update=update,
            )
        return metrics

    def snapshot_params(self) -> dict[str, list[torch.Tensor]]:
        snapshots: dict[str, list[torch.Tensor]] = {}
        for node_id, layer in self.layers.items():
            snapshots[node_id] = [param.detach().clone() for param in layer.parameters()]
        return snapshots


class PPOPolicyAgent(nn.Module):
    """Wraps the visual graph policy with env observation + action adapters for PPO."""

    def __init__(
        self,
        policy: GraphTrainingModule,
        graph: GraphPayload,
        obs_dim: int,
        action_dim: int,
    ):
        super().__init__()
        self.policy = policy
        self.expected_shape = _graph_input_shape(graph)
        expected_flat = math.prod(self.expected_shape) if self.expected_shape else obs_dim

        if obs_dim == expected_flat and len(self.expected_shape) <= 1:
            self.obs_adapter: nn.Module = nn.Identity()
            self.uses_obs_adapter = False
        else:
            self.obs_adapter = nn.Linear(obs_dim, expected_flat)
            self.uses_obs_adapter = True

        with torch.no_grad():
            features = self._policy_features(torch.zeros(1, obs_dim))
        feature_dim = features.shape[-1]
        self.action_head = nn.Linear(feature_dim, action_dim)
        self.value_head = nn.Linear(feature_dim, 1)

    def _adapt_obs(self, obs: torch.Tensor) -> torch.Tensor:
        if obs.dim() == 1:
            obs = obs.unsqueeze(0)
        flat = obs.reshape(obs.shape[0], -1)
        adapted = self.obs_adapter(flat)
        if self.expected_shape:
            return adapted.view(obs.shape[0], *self.expected_shape)
        if adapted.dim() == 1:
            return adapted.unsqueeze(-1)
        return adapted

    def _policy_features(self, obs: torch.Tensor) -> torch.Tensor:
        x = self._adapt_obs(obs)
        out, _ = self.policy(x)
        return out.reshape(out.shape[0], -1)

    def forward(self, obs: torch.Tensor):
        x = self._adapt_obs(obs)
        out, activations = self.policy(x)
        features = out.reshape(out.shape[0], -1)
        logits = self.action_head(features)
        value = self.value_head(features).squeeze(-1)
        return logits, value, activations

    def snapshot_params(self) -> dict[str, list[torch.Tensor]]:
        return self.policy.snapshot_params()


def validate_ppo_setup(graph: GraphPayload, env_id: str) -> str | None:
    """Validate env/graph compatibility. Returns an advisory message or None."""
    import gymnasium as gym

    env = gym.make(env_id)
    try:
        obs_dim = _env_obs_dim(env)
        action_dim = _env_action_dim(env)
        expected_shape = _graph_input_shape(graph)
        agent = PPOPolicyAgent(GraphTrainingModule(graph), graph, obs_dim, action_dim)
        with torch.no_grad():
            logits, value, _ = agent(torch.zeros(1, obs_dim))
        if logits.shape[-1] != action_dim:
            raise ValueError(
                f"Policy outputs {logits.shape[-1]} actions but {env_id} expects {action_dim}"
            )
        if value.numel() != 1:
            raise ValueError("Value head must produce one scalar per observation")

        if agent.uses_obs_adapter:
            expected = "x".join(str(d) for d in expected_shape) if expected_shape else str(obs_dim)
            return (
                f"Environment observation dim is {obs_dim}, but Input block expects [{expected}]. "
                f"An automatic observation adapter was added for PPO training."
            )
        return None
    finally:
        env.close()


@dataclass
class TrainingJob:
    job_id: str
    graph: GraphPayload
    config: TrainingConfig
    telemetry: TrainingTelemetry
    should_stop: bool = False
    thread: threading.Thread | None = None
    lock: threading.Lock = field(default_factory=threading.Lock)
    started_monotonic: float = 0.0
    history: list[MetricPoint] = field(default_factory=list)

    def update(self, telemetry: TrainingTelemetry):
        with self.lock:
            self.telemetry = telemetry

    def snapshot(self) -> TrainingTelemetry:
        with self.lock:
            return self.telemetry

    def append_history(self, step: int, loss: float | None, reward: float | None) -> list[MetricPoint]:
        with self.lock:
            if self.history and self.history[-1].step == step:
                self.history[-1] = MetricPoint(step=step, loss=loss, reward=reward)
            else:
                self.history.append(MetricPoint(step=step, loss=loss, reward=reward))
            return list(self.history)

    def finalize(self, status: str) -> TrainingTelemetry:
        with self.lock:
            duration = time.monotonic() - self.started_monotonic if self.started_monotonic else None
            self.telemetry = self.telemetry.model_copy(
                update={
                    "status": status,
                    "duration_sec": duration,
                    "history": list(self.history),
                }
            )
            return self.telemetry


jobs: dict[str, TrainingJob] = {}


def start_training_job(graph: GraphPayload, config: TrainingConfig) -> str:
    advisory: str | None = None
    if config.algorithm == "PPO":
        advisory = validate_ppo_setup(graph, config.env_id)

    job_id = str(uuid.uuid4())
    run_name = config.run_name.strip() or f"{graph.name or 'Run'} {datetime.now(timezone.utc).strftime('%H:%M:%S')}"
    param_count = _count_graph_params(graph, config.algorithm, config.env_id)
    started_at = datetime.now(timezone.utc).isoformat()
    total_steps = config.steps if config.algorithm != "PPO" else config.steps * config.rollout_steps

    job = TrainingJob(
        job_id=job_id,
        graph=graph,
        config=config,
        started_monotonic=time.monotonic(),
        telemetry=TrainingTelemetry(
            job_id=job_id,
            status="queued",
            algorithm=config.algorithm,
            total_steps=total_steps,
            message=advisory or "Training job queued",
            run_name=run_name,
            seed=config.seed,
            graph_name=graph.name or "Untitled",
            param_count=param_count,
            started_at=started_at,
        ),
    )
    jobs[job_id] = job
    target = _run_ppo if config.algorithm == "PPO" else _run_supervised
    job.thread = threading.Thread(target=target, args=(job,), daemon=True)
    job.thread.start()
    return job_id


def get_training_job(job_id: str) -> TrainingTelemetry | None:
    job = jobs.get(job_id)
    return job.snapshot() if job else None


def list_experiment_runs() -> list[ExperimentRunSummary]:
    summaries = [_telemetry_to_summary(job.snapshot()) for job in jobs.values()]
    summaries.sort(key=lambda run: run.started_at or "", reverse=True)
    return summaries


def stop_training_job(job_id: str) -> bool:
    job = jobs.get(job_id)
    if not job:
        return False
    job.should_stop = True
    return True


def _run_supervised(job: TrainingJob):
    try:
        config = job.config
        _set_seed(config.seed)
        model = GraphTrainingModule(job.graph)
        optimizer = torch.optim.Adam(model.parameters(), lr=config.learning_rate)

        input_nodes = [node for node in job.graph.nodes if node.data.blockType == "Input"]
        if not input_nodes:
            raise ValueError("No Input block found")
        input_shape = _parse_shape(
            str(input_nodes[0].data.params.get("dims", "null,512")),
            config.batch_size,
        )

        for step in range(1, config.steps + 1):
            if job.should_stop:
                break

            x = torch.randn(*input_shape)
            target = torch.zeros_like(model(x)[0])

            before = model.snapshot_params()
            optimizer.zero_grad()
            output, activations = model(x)
            loss = F.mse_loss(output, target)
            loss.backward()
            if config.grad_clip > 0:
                torch.nn.utils.clip_grad_norm_(model.parameters(), config.grad_clip)
            optimizer.step()

            loss_value = float(loss.detach().item())
            history = job.append_history(step, loss_value, None)
            job.update(
                TrainingTelemetry(
                    job_id=job.job_id,
                    status="running",
                    algorithm=config.algorithm,
                    step=step,
                    total_steps=config.steps,
                    loss=loss_value,
                    message="Synthetic supervised step",
                    nodes=model.node_metrics(activations, before),
                    run_name=job.telemetry.run_name,
                    seed=config.seed,
                    graph_name=job.telemetry.graph_name,
                    param_count=job.telemetry.param_count,
                    started_at=job.telemetry.started_at,
                    history=history,
                )
            )

        job.finalize("stopped" if job.should_stop else "completed")
    except Exception as exc:
        latest = job.snapshot()
        job.update(latest.model_copy(update={"status": "error", "message": str(exc)}))
        job.finalize("error")


def _run_ppo(job: TrainingJob):
    try:
        import gymnasium as gym
        from torch.distributions import Categorical
    except Exception as exc:
        latest = job.snapshot()
        job.update(
            latest.model_copy(
                update={
                    "status": "error",
                    "message": f"PPO requires gymnasium. Install with: python3.11 -m pip install gymnasium ({exc})",
                }
            )
        )
        return

    try:
        config = job.config
        _set_seed(config.seed)
        env = gym.make(config.env_id)
        obs_dim = _env_obs_dim(env)
        action_dim = _env_action_dim(env)
        agent = PPOPolicyAgent(GraphTrainingModule(job.graph), job.graph, obs_dim, action_dim)

        optimizer = torch.optim.Adam(
            agent.parameters(),
            lr=config.learning_rate,
        )

        step_count = 0
        last_episode_reward = 0.0
        episode_reward = 0.0
        obs, _ = env.reset(seed=config.seed)

        for update in range(1, config.steps + 1):
            if job.should_stop:
                break

            observations = []
            actions = []
            old_log_probs = []
            rewards = []
            dones = []
            values = []
            last_activations = {}

            for _ in range(config.rollout_steps):
                obs_tensor = torch.as_tensor(obs, dtype=torch.float32)
                with torch.no_grad():
                    logits, value, activations = agent(obs_tensor)
                    dist = Categorical(logits=logits)
                    action = dist.sample()
                    log_prob = dist.log_prob(action)

                next_obs, reward, terminated, truncated, _ = env.step(int(action.item()))
                done = terminated or truncated
                episode_reward += float(reward)

                observations.append(obs_tensor.reshape(-1))
                actions.append(action.squeeze(0))
                old_log_probs.append(log_prob.squeeze(0))
                rewards.append(torch.tensor(float(reward), dtype=torch.float32))
                dones.append(torch.tensor(float(done), dtype=torch.float32))
                values.append(value.squeeze(0))
                last_activations = activations
                step_count += 1

                obs = next_obs
                if done:
                    last_episode_reward = episode_reward
                    episode_reward = 0.0
                    obs, _ = env.reset()

            with torch.no_grad():
                _, next_value, _ = agent(torch.as_tensor(obs, dtype=torch.float32))

            advantages = []
            gae = torch.tensor(0.0)
            for rollout_step in reversed(range(config.rollout_steps)):
                next_non_terminal = 1.0 - dones[rollout_step]
                next_val = next_value.squeeze(0) if rollout_step == config.rollout_steps - 1 else values[rollout_step + 1]
                delta = rewards[rollout_step] + config.gamma * next_val * next_non_terminal - values[rollout_step]
                gae = delta + config.gamma * config.gae_lambda * next_non_terminal * gae
                advantages.insert(0, gae)

            observations_t = torch.stack(observations)
            actions_t = torch.stack(actions)
            old_log_probs_t = torch.stack(old_log_probs).detach()
            values_t = torch.stack(values).detach()
            advantages_t = torch.stack(advantages).detach()
            returns_t = advantages_t + values_t
            advantages_t = (advantages_t - advantages_t.mean()) / (advantages_t.std() + 1e-8)

            loss = torch.tensor(0.0)
            before = agent.snapshot_params()
            activations = last_activations
            for _ in range(config.ppo_update_epochs):
                logits, new_values, activations = agent(observations_t)
                dist = Categorical(logits=logits)
                new_log_probs = dist.log_prob(actions_t)
                entropy = dist.entropy().mean()
                ratio = (new_log_probs - old_log_probs_t).exp()
                policy_loss = -torch.min(
                    ratio * advantages_t,
                    torch.clamp(ratio, 1 - config.clip_epsilon, 1 + config.clip_epsilon) * advantages_t,
                ).mean()
                value_loss = F.mse_loss(new_values, returns_t)
                loss = policy_loss + config.value_coef * value_loss - config.entropy_coef * entropy

                optimizer.zero_grad()
                loss.backward()
                if config.grad_clip > 0:
                    torch.nn.utils.clip_grad_norm_(agent.parameters(), config.grad_clip)
                optimizer.step()

            loss_value = float(loss.detach().item())
            history = job.append_history(update, loss_value, last_episode_reward)
            job.update(
                TrainingTelemetry(
                    job_id=job.job_id,
                    status="running",
                    algorithm=config.algorithm,
                    step=step_count,
                    total_steps=config.steps * config.rollout_steps,
                    loss=loss_value,
                    reward=last_episode_reward,
                    message=f"PPO update {update}/{config.steps}",
                    nodes=agent.policy.node_metrics(activations, before),
                    run_name=job.telemetry.run_name,
                    seed=config.seed,
                    graph_name=job.telemetry.graph_name,
                    param_count=job.telemetry.param_count,
                    started_at=job.telemetry.started_at,
                    history=history,
                )
            )

        env.close()
        job.finalize("stopped" if job.should_stop else "completed")
    except Exception as exc:
        latest = job.snapshot()
        job.update(latest.model_copy(update={"status": "error", "message": str(exc)}))
        job.finalize("error")

