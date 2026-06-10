from fastapi import APIRouter

from app.schemas.graph import GraphPayload, ShapeResponse
from app.services.shape_propagator import propagate_shapes

router = APIRouter(prefix="/api/shapes", tags=["shapes"])


@router.post("/propagate", response_model=ShapeResponse)
async def propagate(graph: GraphPayload) -> ShapeResponse:
    results = propagate_shapes(graph)
    errors = [r.error for r in results if r.error]
    return ShapeResponse(shapes=results, errors=errors)
