from fastapi import APIRouter

from app.schemas.graph import GraphPayload, ExecutionResult
from app.services.model_builder import execute_model

router = APIRouter(prefix="/api/execute", tags=["execute"])


@router.post("/run", response_model=ExecutionResult)
async def run_model(graph: GraphPayload) -> ExecutionResult:
    return execute_model(graph)
