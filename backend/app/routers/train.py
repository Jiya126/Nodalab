from fastapi import APIRouter, HTTPException

from app.schemas.training import TrainingStartRequest, TrainingStartResponse, TrainingTelemetry, ExperimentRunSummary
from app.services.training_runner import get_training_job, list_experiment_runs, start_training_job, stop_training_job, validate_ppo_setup

router = APIRouter(prefix="/api/train", tags=["train"])


@router.post("/start", response_model=TrainingStartResponse)
async def start_training(payload: TrainingStartRequest) -> TrainingStartResponse:
    if payload.config.algorithm == "PPO":
        try:
            validate_ppo_setup(payload.graph, payload.config.env_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    job_id = start_training_job(payload.graph, payload.config)
    return TrainingStartResponse(job_id=job_id)


@router.get("/runs", response_model=list[ExperimentRunSummary])
async def list_runs() -> list[ExperimentRunSummary]:
    return list_experiment_runs()


@router.get("/status/{job_id}", response_model=TrainingTelemetry)
async def training_status(job_id: str) -> TrainingTelemetry:
    telemetry = get_training_job(job_id)
    if telemetry is None:
        raise HTTPException(status_code=404, detail="Training job not found")
    return telemetry


@router.post("/stop/{job_id}")
async def stop_training(job_id: str) -> dict:
    if not stop_training_job(job_id):
        raise HTTPException(status_code=404, detail="Training job not found")
    return {"status": "stopping"}

