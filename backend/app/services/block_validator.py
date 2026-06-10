import ast
import traceback

import torch
import torch.nn as nn

from app.schemas.graph import CustomBlockCode, ValidationResult


def validate_custom_block(block: CustomBlockCode) -> ValidationResult:
    errors: list[str] = []

    try:
        tree = ast.parse(block.code)
    except SyntaxError as e:
        return ValidationResult(valid=False, errors=[f"Syntax error: {e}"])

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

    if errors:
        return ValidationResult(valid=False, errors=errors)

    module_code = f"""
import torch
import torch.nn as nn
import torch.nn.functional as F

class CustomBlock(nn.Module):
    def __init__(self):
        super().__init__()
        {_indent_code(block.code, 8)}

    def forward(self, {', '.join(block.input_names)}):
        {_indent_code(block.code, 8)}
"""

    try:
        forward_code = f"""
import torch
import torch.nn as nn
import torch.nn.functional as F
import math

def forward({', '.join(block.input_names)}):
{_indent_code(block.code, 4)}
"""
        compile(forward_code, "<custom_block>", "exec")
    except Exception as e:
        return ValidationResult(
            valid=False,
            errors=[f"Compilation error: {traceback.format_exception_only(type(e), e)[-1].strip()}"],
        )

    return ValidationResult(valid=True, errors=[])


def _indent_code(code: str, spaces: int) -> str:
    prefix = " " * spaces
    lines = code.strip().split("\n")
    return ("\n" + prefix).join(lines)
