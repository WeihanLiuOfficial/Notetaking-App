import re
import subprocess
import os

NODE_PATH = r"C:\Program Files\Adobe\Adobe Creative Cloud Experience\libs\node.exe"

def strip_types(code: str) -> str:
    # Remove import type statements
    code = re.sub(r'import\s+type\s+[^;]+;', '', code)
    # Remove import ... from type files
    code = re.sub(r'import\s+\{[^}]*\}\s+from\s+[\'"][^\'"]*types[^\'"]*[\'"];?', '', code)
    # Remove export interface / type definitions
    code = re.sub(r'export\s+(interface|type)\s+[\s\S]*?(\n\n|\n(?=export|\/\*|\/\/|function|class|const|let|var))', '', code)
    code = re.sub(r'(interface|type)\s+[\s\S]*?(\n\n|\n(?=export|\/\*|\/\/|function|class|const|let|var))', '', code)
    # Remove type annotations on parameters, variables, return types
    # Replace : type in parameters and variables
    # Simple regex for function signatures & type casting
    code = re.sub(r':\s*[A-Za-z0-9_\[\]\|<>\s,\.\{\}\?]+(\s*=\s*|\s*[\)\},\;])', r'\1', code)
    code = re.sub(r'as\s+[A-Za-z0-9_\[\]\|<>\s,\.\{\}]+', '', code)
    return code

print("Python runner ready.")
