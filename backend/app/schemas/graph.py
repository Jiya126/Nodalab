from pydantic import BaseModel


class NodePosition(BaseModel):
    x: float
    y: float


class BlockParams(BaseModel):
    model_config = {"extra": "allow"}


class NodeData(BaseModel):
    blockType: str
    label: str
    params: dict
    inputShapes: list[list[int | None]] | None = None
    outputShapes: list[list[int | None]] | None = None
    shapeError: str | None = None


class GraphNode(BaseModel):
    id: str
    type: str
    position: NodePosition
    data: NodeData


class GraphEdge(BaseModel):
    id: str
    source: str
    sourceHandle: str | None = None
    target: str
    targetHandle: str | None = None


class GraphPayload(BaseModel):
    id: str
    name: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class CustomBlockCode(BaseModel):
    code: str
    input_names: list[str]
    output_names: list[str]
    params: dict = {}


class ShapeResult(BaseModel):
    node_id: str
    output_shapes: list[list[int | None]]
    error: str | None = None


class ShapeResponse(BaseModel):
    shapes: list[ShapeResult]
    errors: list[str] = []


class ValidationResult(BaseModel):
    valid: bool
    errors: list[str] = []
    output_shapes: list[list[int | None]] | None = None


class ExecutionResult(BaseModel):
    success: bool
    output_shape: list[int] | None = None
    error: str | None = None
    code: str | None = None
