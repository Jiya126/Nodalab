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
}

export function generateTrainingCode(modelCode: string, params: TrainingParams): string {
  if (params.algorithm === 'PPO') {
    return generatePPOTrainingCode(modelCode, params);
  }

  const lines: string[] = [];

  lines.push(modelCode);
  lines.push('');
  lines.push('');
  lines.push('# --- Training Configuration ---');
  lines.push('');
  lines.push('device = torch.device("cuda" if torch.cuda.is_available() else "cpu")');
  lines.push('model = NeuralNetwork().to(device)');
  lines.push('');

  lines.push(`criterion = nn.${params.loss}()`);

  const optArgs = [`model.parameters()`, `lr=${params.learningRate}`];
  if (params.weightDecay > 0) optArgs.push(`weight_decay=${params.weightDecay}`);
  if (params.optimizer === 'SGD') optArgs.push('momentum=0.9');
  lines.push(`optimizer = torch.optim.${params.optimizer}(${optArgs.join(', ')})`);

  if (params.scheduler !== 'none') {
    if (params.scheduler === 'StepLR') {
      lines.push(`scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=${params.schedulerStepSize}, gamma=${params.schedulerGamma})`);
    } else if (params.scheduler === 'CosineAnnealingLR') {
      lines.push(`scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=${params.epochs})`);
    } else if (params.scheduler === 'ReduceLROnPlateau') {
      lines.push(`scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5)`);
    }
  }

  if (params.mixedPrecision) {
    lines.push('scaler = torch.amp.GradScaler()');
  }

  lines.push('');
  lines.push('');
  lines.push('# --- Training Loop ---');
  lines.push('');
  lines.push(`EPOCHS = ${params.epochs}`);
  lines.push(`BATCH_SIZE = ${params.batchSize}`);
  lines.push('');
  lines.push('# TODO: Replace with your DataLoader');
  lines.push('# train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)');
  lines.push('');
  lines.push('for epoch in range(EPOCHS):');
  lines.push('    model.train()');
  lines.push('    running_loss = 0.0');
  lines.push('');
  lines.push('    # for batch_idx, (data, target) in enumerate(train_loader):');
  lines.push('    #     data, target = data.to(device), target.to(device)');

  if (params.mixedPrecision) {
    lines.push('    #');
    lines.push('    #     optimizer.zero_grad()');
    lines.push('    #     with torch.amp.autocast(device_type="cuda"):');
    lines.push('    #         output = model(data)');
    lines.push('    #         loss = criterion(output, target)');
    lines.push('    #     scaler.scale(loss).backward()');
    if (params.gradClip > 0) {
      lines.push('    #     scaler.unscale_(optimizer)');
      lines.push(`    #     torch.nn.utils.clip_grad_norm_(model.parameters(), ${params.gradClip})`);
    }
    lines.push('    #     scaler.step(optimizer)');
    lines.push('    #     scaler.update()');
  } else {
    lines.push('    #');
    lines.push('    #     optimizer.zero_grad()');
    lines.push('    #     output = model(data)');
    lines.push('    #     loss = criterion(output, target)');
    lines.push('    #     loss.backward()');
    if (params.gradClip > 0) {
      lines.push(`    #     torch.nn.utils.clip_grad_norm_(model.parameters(), ${params.gradClip})`);
    }
    lines.push('    #     optimizer.step()');
  }

  lines.push('    #     running_loss += loss.item()');
  lines.push('    #');
  lines.push('    # avg_loss = running_loss / len(train_loader)');

  if (params.scheduler === 'ReduceLROnPlateau') {
    lines.push('    # scheduler.step(avg_loss)');
  } else if (params.scheduler !== 'none') {
    lines.push('    # scheduler.step()');
  }

  lines.push('    # print(f"Epoch {epoch+1}/{EPOCHS}, Loss: {avg_loss:.4f}")');
  lines.push('');
  lines.push('print("Training complete!")');
  lines.push('');

  return lines.join('\n');
}

function generatePPOTrainingCode(modelCode: string, params: TrainingParams): string {
  const lines: string[] = [];

  lines.push(modelCode);
  lines.push('');
  lines.push('');
  lines.push('# --- PPO Reinforcement Learning Training ---');
  lines.push('# Requires: pip install gymnasium');
  lines.push('# Assumption: NeuralNetwork.forward(obs) returns discrete action logits.');
  lines.push('# The value head below learns state values from those logits for PPO advantage estimation.');
  lines.push('');
  lines.push('import gymnasium as gym');
  lines.push('from torch.distributions import Categorical');
  lines.push('');
  lines.push('device = torch.device("cuda" if torch.cuda.is_available() else "cpu")');
  lines.push('');
  lines.push('');
  lines.push('class PPOAgent(nn.Module):');
  lines.push('    def __init__(self):');
  lines.push('        super().__init__()');
  lines.push('        self.policy = NeuralNetwork()');
  lines.push('        self.value_head = nn.LazyLinear(1)');
  lines.push('');
  lines.push('    def forward(self, obs):');
  lines.push('        logits = self.policy(obs)');
  lines.push('        value = self.value_head(logits).squeeze(-1)');
  lines.push('        return logits, value');
  lines.push('');
  lines.push('');
  lines.push(`ENV_ID = "${params.envId}"`);
  lines.push(`TOTAL_UPDATES = ${params.epochs}`);
  lines.push(`ROLLOUT_STEPS = ${params.rolloutSteps}`);
  lines.push(`PPO_UPDATE_EPOCHS = ${params.ppoUpdateEpochs}`);
  lines.push(`GAMMA = ${params.gamma}`);
  lines.push(`GAE_LAMBDA = ${params.gaeLambda}`);
  lines.push(`CLIP_EPSILON = ${params.clipEpsilon}`);
  lines.push(`ENTROPY_COEF = ${params.entropyCoef}`);
  lines.push(`VALUE_COEF = ${params.valueCoef}`);
  lines.push('');
  lines.push('env = gym.make(ENV_ID)');
  lines.push('agent = PPOAgent().to(device)');
  lines.push(`optimizer = torch.optim.${params.optimizer}(agent.parameters(), lr=${params.learningRate}, weight_decay=${params.weightDecay})`);
  lines.push('');
  lines.push('');
  lines.push('def obs_to_tensor(obs):');
  lines.push('    return torch.as_tensor(obs, dtype=torch.float32, device=device).unsqueeze(0)');
  lines.push('');
  lines.push('');
  lines.push('obs, _ = env.reset()');
  lines.push('');
  lines.push(' for update in range(TOTAL_UPDATES):'.trimStart());
  lines.push('    observations = []');
  lines.push('    actions = []');
  lines.push('    old_log_probs = []');
  lines.push('    rewards = []');
  lines.push('    dones = []');
  lines.push('    values = []');
  lines.push('');
  lines.push('    for _ in range(ROLLOUT_STEPS):');
  lines.push('        obs_tensor = obs_to_tensor(obs)');
  lines.push('        with torch.no_grad():');
  lines.push('            logits, value = agent(obs_tensor)');
  lines.push('            dist = Categorical(logits=logits)');
  lines.push('            action = dist.sample()');
  lines.push('            log_prob = dist.log_prob(action)');
  lines.push('');
  lines.push('        next_obs, reward, terminated, truncated, _ = env.step(action.item())');
  lines.push('        done = terminated or truncated');
  lines.push('');
  lines.push('        observations.append(obs_tensor.squeeze(0))');
  lines.push('        actions.append(action.squeeze(0))');
  lines.push('        old_log_probs.append(log_prob.squeeze(0))');
  lines.push('        rewards.append(torch.tensor(reward, dtype=torch.float32, device=device))');
  lines.push('        dones.append(torch.tensor(done, dtype=torch.float32, device=device))');
  lines.push('        values.append(value.squeeze(0))');
  lines.push('');
  lines.push('        obs = next_obs');
  lines.push('        if done:');
  lines.push('            obs, _ = env.reset()');
  lines.push('');
  lines.push('    with torch.no_grad():');
  lines.push('        _, next_value = agent(obs_to_tensor(obs))');
  lines.push('');
  lines.push('    advantages = []');
  lines.push('    gae = torch.tensor(0.0, device=device)');
  lines.push('    for step in reversed(range(ROLLOUT_STEPS)):');
  lines.push('        next_non_terminal = 1.0 - dones[step]');
  lines.push('        next_val = next_value.squeeze(0) if step == ROLLOUT_STEPS - 1 else values[step + 1]');
  lines.push('        delta = rewards[step] + GAMMA * next_val * next_non_terminal - values[step]');
  lines.push('        gae = delta + GAMMA * GAE_LAMBDA * next_non_terminal * gae');
  lines.push('        advantages.insert(0, gae)');
  lines.push('');
  lines.push('    observations = torch.stack(observations)');
  lines.push('    actions = torch.stack(actions)');
  lines.push('    old_log_probs = torch.stack(old_log_probs).detach()');
  lines.push('    values = torch.stack(values).detach()');
  lines.push('    advantages = torch.stack(advantages).detach()');
  lines.push('    returns = advantages + values');
  lines.push('    advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)');
  lines.push('');
  lines.push('    for _ in range(PPO_UPDATE_EPOCHS):');
  lines.push('        logits, new_values = agent(observations)');
  lines.push('        dist = Categorical(logits=logits)');
  lines.push('        new_log_probs = dist.log_prob(actions)');
  lines.push('        entropy = dist.entropy().mean()');
  lines.push('');
  lines.push('        ratio = (new_log_probs - old_log_probs).exp()');
  lines.push('        unclipped = ratio * advantages');
  lines.push('        clipped = torch.clamp(ratio, 1 - CLIP_EPSILON, 1 + CLIP_EPSILON) * advantages');
  lines.push('        policy_loss = -torch.min(unclipped, clipped).mean()');
  lines.push('        value_loss = F.mse_loss(new_values, returns)');
  lines.push('        loss = policy_loss + VALUE_COEF * value_loss - ENTROPY_COEF * entropy');
  lines.push('');
  lines.push('        optimizer.zero_grad()');
  lines.push('        loss.backward()');
  if (params.gradClip > 0) {
    lines.push(`        torch.nn.utils.clip_grad_norm_(agent.parameters(), ${params.gradClip})`);
  }
  lines.push('        optimizer.step()');
  lines.push('');
  lines.push('    print(f"Update {update + 1}/{TOTAL_UPDATES} | loss={loss.item():.4f} | policy={policy_loss.item():.4f} | value={value_loss.item():.4f}")');
  lines.push('');
  lines.push('env.close()');
  lines.push('');

  return lines.join('\n');
}
