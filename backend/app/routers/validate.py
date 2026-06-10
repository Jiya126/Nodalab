from fastapi import APIRouter

from app.schemas.graph import CustomBlockCode, ValidationResult
from app.services.block_validator import validate_custom_block

router = APIRouter(prefix="/api/validate", tags=["validate"])


@router.post("/custom-block", response_model=ValidationResult)
async def validate_block(block: CustomBlockCode) -> ValidationResult:
    return validate_custom_block(block)
