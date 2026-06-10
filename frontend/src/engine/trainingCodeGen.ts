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

export function generateTrainingCode(modelCode: string, params: TrainingParams): string {
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
