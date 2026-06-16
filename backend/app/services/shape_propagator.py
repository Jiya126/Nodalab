import torch
import torch.nn as nn

from app.schemas.graph import GraphPayload, ShapeResult


LAYER_MAP: dict[str, type] = {
    "Linear": nn.Linear,
    "Conv2d": nn.Conv2d,
    "Embedding": nn.Embedding,
    "MultiHeadAttention": nn.MultiheadAttention,
    "LayerNorm": nn.LayerNorm,
    "BatchNorm2d": nn.BatchNorm2d,
    "LSTM": nn.LSTM,
    "Dropout": nn.Dropout,
    "Flatten": nn.Flatten,
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
    in_degree: dict[str, int] = {n.id: 0 for n in nodes}

    for e in edges:
        adj[e.source].append(e.target)
        in_degree[e.target] = in_degree.get(e.target, 0) + 1

    queue = [nid for nid, deg in in_degree.items() if deg == 0]
    result: list[str] = []

    while queue:
        curr = queue.pop(0)
        result.append(curr)
        for neighbor in adj.get(curr, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    return result


def propagate_shapes(graph: GraphPayload) -> list[ShapeResult]:
    sorted_ids = _topological_sort(graph.nodes, graph.edges)
    node_map = {n.id: n for n in graph.nodes}
    output_shapes: dict[str, list[list[int | None]]] = {}
    results: list[ShapeResult] = []

    for node_id in sorted_ids:
        node = node_map[node_id]
        block_type = node.data.blockType
        params = node.data.params

        try:
            if block_type == "Input":
                dims_str = str(params.get("dims", "null,512"))
                shape = []
                for d in dims_str.split(","):
                    d = d.strip()
                    if d in ("null", "N", "B"):
                        shape.append(None)
                    else:
                        shape.append(int(d))
                output_shapes[node_id] = [shape]
                results.append(ShapeResult(node_id=node_id, output_shapes=[shape]))
                continue

            if block_type == "Output":
                incoming = [e for e in graph.edges if e.target == node_id]
                if incoming:
                    src_shapes = output_shapes.get(incoming[0].source, [])
                    output_shapes[node_id] = src_shapes
                    results.append(ShapeResult(node_id=node_id, output_shapes=src_shapes))
                else:
                    results.append(ShapeResult(node_id=node_id, output_shapes=[]))
                continue

            incoming = [e for e in graph.edges if e.target == node_id]
            input_shape = None
            if incoming:
                src = incoming[0].source
                src_shapes = output_shapes.get(src, [])
                if src_shapes:
                    input_shape = src_shapes[0]

            if input_shape is None:
                results.append(ShapeResult(node_id=node_id, output_shapes=[], error="No input connected"))
                continue

            dummy_shape = [d if d is not None else 2 for d in input_shape]

            layer = _build_layer(block_type, params)

            if block_type in ("ReLU", "GELU", "Sigmoid"):
                output_shapes[node_id] = [input_shape]
                results.append(ShapeResult(node_id=node_id, output_shapes=[input_shape]))
                continue

            if block_type == "Softmax":
                output_shapes[node_id] = [input_shape]
                results.append(ShapeResult(node_id=node_id, output_shapes=[input_shape]))
                continue

            if block_type == "Add":
                output_shapes[node_id] = [input_shape]
                results.append(ShapeResult(node_id=node_id, output_shapes=[input_shape]))
                continue

            if block_type == "Concat":
                output_shapes[node_id] = [input_shape]
                results.append(ShapeResult(node_id=node_id, output_shapes=[input_shape]))
                continue

            if block_type == "Reshape":
                shape_str = str(params.get("shape", "null,-1"))
                shape = []
                for d in shape_str.split(","):
                    d = d.strip()
                    if d in ("null", "-1", "B"):
                        shape.append(None)
                    else:
                        shape.append(int(d))
                output_shapes[node_id] = [shape]
                results.append(ShapeResult(node_id=node_id, output_shapes=[shape]))
                continue

            if block_type == "Custom":
                if params.get("output_shape_rule", "same") == "custom":
                    shape_str = str(params.get("custom_output_shape", "null,256"))
                    shape = []
                    for d in shape_str.split(","):
                        d = d.strip()
                        if d in ("null", "N", "B"):
                            shape.append(None)
                        else:
                            shape.append(int(d))
                else:
                    shape = input_shape
                output_shapes[node_id] = [shape]
                results.append(ShapeResult(node_id=node_id, output_shapes=[shape]))
                continue

            if layer is not None:
                if block_type == "Embedding":
                    vocab_size = int(params.get("num_embeddings", 10000))
                    dummy = torch.randint(0, vocab_size, dummy_shape, dtype=torch.long)
                else:
                    dummy = torch.randn(*dummy_shape)
                with torch.no_grad():
                    if block_type == "LSTM":
                        out, _ = layer(dummy)
                    elif block_type == "MultiHeadAttention":
                        out, _ = layer(dummy, dummy, dummy)
                    else:
                        out = layer(dummy)

                out_shape: list[int | None] = list(out.shape)
                for i, d in enumerate(input_shape):
                    if d is None and i < len(out_shape):
                        out_shape[i] = None

                output_shapes[node_id] = [out_shape]
                results.append(ShapeResult(node_id=node_id, output_shapes=[out_shape]))
            else:
                output_shapes[node_id] = [input_shape]
                results.append(ShapeResult(node_id=node_id, output_shapes=[input_shape]))

        except Exception as e:
            results.append(ShapeResult(node_id=node_id, output_shapes=[], error=str(e)))

    return results
