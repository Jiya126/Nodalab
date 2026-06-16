import torch
import torch.nn as nn
import torch.nn.functional as F

from app.schemas.graph import GraphPayload, ExecutionResult
from app.services.block_validator import compile_custom_forward


ACTIVATIONS = {
    "ReLU": F.relu,
    "GELU": F.gelu,
    "Sigmoid": torch.sigmoid,
    "Softmax": lambda x, dim=-1: F.softmax(x, dim=dim),
}


def _build_layer(block_type: str, params: dict) -> nn.Module | None:
    if block_type == "Linear":
        return nn.Linear(
            int(params.get("in_features", 512)),
            int(params.get("out_features", 256)),
            bias=bool(params.get("bias", True)),
        )
    if block_type == "Conv2d":
        return nn.Conv2d(
            int(params.get("in_channels", 3)),
            int(params.get("out_channels", 64)),
            kernel_size=int(params.get("kernel_size", 3)),
            stride=int(params.get("stride", 1)),
            padding=int(params.get("padding", 1)),
        )
    if block_type == "Embedding":
        return nn.Embedding(
            int(params.get("num_embeddings", 10000)),
            int(params.get("embedding_dim", 512)),
        )
    if block_type == "MultiHeadAttention":
        return nn.MultiheadAttention(
            int(params.get("embed_dim", 512)),
            int(params.get("num_heads", 8)),
            dropout=float(params.get("dropout", 0.0)),
        )
    if block_type == "LayerNorm":
        return nn.LayerNorm(int(params.get("normalized_shape", 512)))
    if block_type == "BatchNorm2d":
        return nn.BatchNorm2d(int(params.get("num_features", 64)))
    if block_type == "LSTM":
        return nn.LSTM(
            int(params.get("input_size", 512)),
            int(params.get("hidden_size", 256)),
            num_layers=int(params.get("num_layers", 1)),
            bidirectional=bool(params.get("bidirectional", False)),
            batch_first=True,
        )
    if block_type == "Dropout":
        return nn.Dropout(p=float(params.get("p", 0.5)))
    if block_type == "Flatten":
        return nn.Flatten(
            start_dim=int(params.get("start_dim", 1)),
            end_dim=int(params.get("end_dim", -1)),
        )
    return None


def _topological_sort(nodes: list, edges: list) -> list[str]:
    adj: dict[str, list[str]] = {n.id: [] for n in nodes}
    in_deg: dict[str, int] = {n.id: 0 for n in nodes}

    for e in edges:
        adj[e.source].append(e.target)
        in_deg[e.target] = in_deg.get(e.target, 0) + 1

    queue = [nid for nid, d in in_deg.items() if d == 0]
    result: list[str] = []

    while queue:
        c = queue.pop(0)
        result.append(c)
        for nb in adj.get(c, []):
            in_deg[nb] -= 1
            if in_deg[nb] == 0:
                queue.append(nb)

    return result


def execute_model(graph: GraphPayload) -> ExecutionResult:
    try:
        sorted_ids = _topological_sort(graph.nodes, graph.edges)
        node_map = {n.id: n for n in graph.nodes}
        tensors: dict[str, torch.Tensor] = {}
        layers: dict[str, nn.Module] = {}

        for node_id in sorted_ids:
            node = node_map[node_id]
            bt = node.data.blockType
            params = node.data.params

            if bt == "Input":
                dims_str = str(params.get("dims", "null,512"))
                shape = []
                for d in dims_str.split(","):
                    d = d.strip()
                    shape.append(2 if d in ("null", "N", "B") else int(d))
                tensors[node_id] = torch.randn(*shape)
                continue

            incoming = [e for e in graph.edges if e.target == node_id]

            if bt == "Output":
                if incoming:
                    source_id = incoming[0].source
                    if source_id not in tensors:
                        source_node = node_map.get(source_id)
                        source_label = source_node.data.label if source_node else source_id
                        raise ValueError(
                            f"Output is connected to '{source_label}', but that node did not produce a tensor"
                        )
                    tensors[node_id] = tensors[source_id]
                continue

            input_tensors = [tensors[e.source] for e in incoming if e.source in tensors]
            if not input_tensors:
                continue

            x = input_tensors[0]

            if bt in ACTIVATIONS:
                if bt == "Softmax":
                    dim = int(params.get("dim", -1))
                    tensors[node_id] = F.softmax(x, dim=dim)
                else:
                    tensors[node_id] = ACTIVATIONS[bt](x)
                continue

            if bt == "Add":
                if len(input_tensors) >= 2:
                    tensors[node_id] = input_tensors[0] + input_tensors[1]
                continue

            if bt == "Concat":
                if len(input_tensors) >= 2:
                    dim = int(params.get("dim", -1))
                    tensors[node_id] = torch.cat(input_tensors, dim=dim)
                continue

            if bt == "Reshape":
                shape_str = str(params.get("shape", "-1"))
                new_shape = []
                for d in shape_str.split(","):
                    new_shape.append(int(d.strip()))
                tensors[node_id] = x.view(*new_shape)
                continue

            if bt == "Custom":
                forward = compile_custom_forward(str(params.get("code", "return x")), ["x"])
                with torch.no_grad():
                    out = forward(x)
                if not isinstance(out, torch.Tensor):
                    raise ValueError(f"Custom block '{node.data.label}' must return a torch.Tensor")
                tensors[node_id] = out
                continue

            layer = _build_layer(bt, params)
            if layer is not None:
                layers[node_id] = layer
                with torch.no_grad():
                    if bt == "Embedding":
                        vocab_size = int(params.get("num_embeddings", 10000))
                        x = torch.randint(0, vocab_size, x.shape, dtype=torch.long)
                        out = layer(x)
                    elif bt == "LSTM":
                        out, _ = layer(x)
                    elif bt == "MultiHeadAttention":
                        out, _ = layer(x, x, x)
                    else:
                        out = layer(x)
                tensors[node_id] = out

        output_nodes = [n for n in graph.nodes if n.data.blockType == "Output"]
        if output_nodes:
            last_id = output_nodes[0].id
        else:
            last_id = sorted_ids[-1] if sorted_ids else None

        if last_id and last_id in tensors:
            return ExecutionResult(
                success=True,
                output_shape=list(tensors[last_id].shape),
            )

        return ExecutionResult(success=True, output_shape=None)

    except Exception as e:
        return ExecutionResult(success=False, error=str(e))
