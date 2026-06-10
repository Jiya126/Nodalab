from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from app.schemas.graph import GraphPayload


TEMPLATE_DIR = Path(__file__).parent.parent / "templates"
env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))


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


def generate_pytorch_code(graph: GraphPayload) -> str:
    sorted_ids = _topological_sort(graph.nodes, graph.edges)
    node_map = {n.id: n for n in graph.nodes}

    layers = []
    forwards = []
    inputs = []
    var_names: dict[str, str] = {}

    for node_id in sorted_ids:
        node = node_map[node_id]
        bt = node.data.blockType
        label = node.data.label
        params = node.data.params

        if bt == "Input":
            var_names[node_id] = label
            inputs.append(label)
            continue

        if bt == "Output":
            incoming = [e for e in graph.edges if e.target == node_id]
            if incoming:
                var_names[node_id] = var_names.get(incoming[0].source, "x")
            continue

        incoming = [e for e in graph.edges if e.target == node_id]
        input_var = var_names.get(incoming[0].source, "x") if incoming else "x"

        var_names[node_id] = label

        layers.append({
            "type": bt,
            "label": label,
            "params": params,
            "input_var": input_var,
        })

        forwards.append({
            "type": bt,
            "label": label,
            "params": params,
            "input_var": input_var,
            "output_var": label,
        })

    output_nodes = [n for n in graph.nodes if n.data.blockType == "Output"]
    return_vars = []
    for on in output_nodes:
        incoming = [e for e in graph.edges if e.target == on.id]
        if incoming:
            return_vars.append(var_names.get(incoming[0].source, "x"))

    if not return_vars and sorted_ids:
        return_vars = [var_names.get(sorted_ids[-1], "x")]

    template = env.get_template("model.py.j2")
    return template.render(
        inputs=inputs or ["x"],
        layers=layers,
        forwards=forwards,
        return_vars=return_vars,
    )
