import io
import tempfile

import torch
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas.graph import GraphPayload
from app.services.model_builder import execute_model
from app.services.code_generator import generate_pytorch_code

router = APIRouter(prefix="/api/export", tags=["export"])


@router.post("/code")
async def export_code(graph: GraphPayload) -> dict:
    code = generate_pytorch_code(graph)
    return {"code": code}


@router.post("/onnx")
async def export_onnx(graph: GraphPayload):
    result = execute_model(graph)
    if not result.success:
        return {"error": result.error}

    input_nodes = [n for n in graph.nodes if n.data.blockType == "Input"]
    if not input_nodes:
        return {"error": "No input node found"}

    dims_str = str(input_nodes[0].data.params.get("dims", "null,512"))
    shape = []
    for d in dims_str.split(","):
        d = d.strip()
        shape.append(2 if d in ("null", "N", "B") else int(d))

    try:
        from app.services.model_builder import _build_layer, _topological_sort
        import torch.nn as nn
        import torch.nn.functional as F

        sorted_ids = _topological_sort(graph.nodes, graph.edges)
        node_map = {n.id: n for n in graph.nodes}

        layers = {}
        for nid in sorted_ids:
            node = node_map[nid]
            bt = node.data.blockType
            if bt in ("Input", "Output", "ReLU", "GELU", "Sigmoid", "Softmax", "Add", "Concat", "Reshape"):
                continue
            layer = _build_layer(bt, node.data.params)
            if layer:
                layers[node.data.label] = layer

        class ExportModel(nn.Module):
            def __init__(self):
                super().__init__()
                for name, layer in layers.items():
                    self.add_module(name, layer)

            def forward(self, x):
                for name, layer in layers.items():
                    if isinstance(layer, nn.LSTM):
                        x, _ = layer(x)
                    elif isinstance(layer, nn.MultiheadAttention):
                        x, _ = layer(x, x, x)
                    else:
                        x = layer(x)
                return x

        model = ExportModel()
        model.eval()
        first_layer = next(iter(layers.values()), None)
        if isinstance(first_layer, nn.Embedding):
            dummy = torch.randint(0, first_layer.num_embeddings, shape, dtype=torch.long)
        else:
            dummy = torch.randn(*shape)

        with tempfile.NamedTemporaryFile(suffix=".onnx", delete=False) as f:
            torch.onnx.export(
                model,
                dummy,
                f.name,
                opset_version=18,
                input_names=["input"],
                output_names=["output"],
            )
            f.seek(0)
            buf = io.BytesIO(open(f.name, "rb").read())

        return StreamingResponse(
            buf,
            media_type="application/octet-stream",
            headers={"Content-Disposition": "attachment; filename=model.onnx"},
        )

    except Exception as e:
        return {"error": str(e)}
