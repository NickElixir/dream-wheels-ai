import json
import subprocess
from functools import lru_cache
from pathlib import Path

_EXTRACTOR = Path(__file__).with_name("source-extract.mjs")


@lru_cache(maxsize=4)
def _functions(source: str) -> dict[str, str]:
    result = subprocess.run(
        ["node", str(_EXTRACTOR)],
        input=source,
        text=True,
        capture_output=True,
        check=True,
    )
    return json.loads(result.stdout)


def extract_function(source: str, name: str) -> str:
    """Extract the exact named function; npm ci --prefix webapp supplies Acorn."""
    functions = _functions(source)
    if name not in functions:
        raise ValueError(f"Missing top-level function: {name}")
    return functions[name]
