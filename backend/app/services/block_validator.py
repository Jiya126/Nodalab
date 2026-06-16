import ast
import math
import traceback

import torch
import torch.nn as nn
import torch.nn.functional as F

from app.schemas.graph import CustomBlockCode, ValidationResult


ALLOWED_BUILTINS = {
    "abs": abs,
    "bool": bool,
    "dict": dict,
    "enumerate": enumerate,
    "float": float,
    "int": int,
    "len": len,
    "list": list,
    "max": max,
    "min": min,
    "pow": pow,
    "range": range,
    "round": round,
    "sum": sum,
    "tuple": tuple,
}


def validate_custom_block(block: CustomBlockCode) -> ValidationResult:
    errors = validate_custom_code_safety(block.code)
    if errors:
        return ValidationResult(valid=False, errors=errors)

    forward_code = build_custom_forward_code(block.code, block.input_names)

    try:
        compile_custom_forward(block.code, block.input_names)
    except Exception as e:
        return ValidationResult(
            valid=False,
            errors=[f"Compilation error: {traceback.format_exception_only(type(e), e)[-1].strip()}"],
            generated_wrapper=forward_code,
        )

    return ValidationResult(valid=True, errors=[], generated_wrapper=forward_code)


def build_custom_forward_code(code: str, input_names: list[str]) -> str:
    return f"""
import torch
import torch.nn as nn
import torch.nn.functional as F
import math

def forward({', '.join(input_names)}):
{_indent_code(code, 4)}
""".strip()


def validate_custom_code_safety(code: str) -> list[str]:
    errors: list[str] = []

    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return [f"Syntax error: {e}"]

    forbidden = {"exec", "eval", "compile", "__import__", "open", "os", "sys", "subprocess"}
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and node.id in forbidden:
            errors.append(f"Forbidden identifier: {node.id}")
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name.split(".")[0] in {"os", "sys", "subprocess", "shutil"}:
                    errors.append(f"Forbidden import: {alias.name}")
        if isinstance(node, ast.ImportFrom):
            if node.module and node.module.split(".")[0] in {"os", "sys", "subprocess", "shutil"}:
                errors.append(f"Forbidden import: {node.module}")

    return errors


def compile_custom_forward(code: str, input_names: list[str] | None = None):
    errors = validate_custom_code_safety(code)
    if errors:
        raise ValueError("; ".join(errors))

    names = input_names or ["x"]
    forward_code = build_custom_forward_code(code, names)
    compile(forward_code, "<custom_block>", "exec")

    namespace = {
        "__builtins__": {**ALLOWED_BUILTINS, "__import__": __import__},
        "torch": torch,
        "nn": nn,
        "F": F,
        "math": math,
    }
    exec(forward_code, namespace)
    return namespace["forward"]


def _indent_code(code: str, spaces: int) -> str:
    prefix = " " * spaces
    lines = code.strip().split("\n")
    return "\n".join(prefix + line if line.strip() else prefix for line in lines)
