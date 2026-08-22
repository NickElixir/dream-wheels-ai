"""Run one explicit, billable Wan image-editing smoke request."""

import argparse
import asyncio
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.rendering import create_image_generation_provider
from src.rendering.base import wheel_fitment_request


async def _run(car_path: Path, wheel_path: Path, output_path: Path) -> None:
    provider = create_image_generation_provider()
    if provider.name != "wan":
        raise RuntimeError("Set IMAGE_GENERATION_PROVIDER=wan before running this smoke test")
    result = await provider.edit(
        wheel_fitment_request(
            car_path.read_bytes(),
            wheel_path.read_bytes(),
        )
    )
    if not result:
        raise RuntimeError("Wan returned no images")
    output_path.write_bytes(result[0].data)
    print(
        "Wan smoke succeeded: "
        f"model={result[0].model} request_id={result[0].request_id} "
        f"task_id={result[0].task_id} output={output_path}"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("car", type=Path)
    parser.add_argument("wheel", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    asyncio.run(_run(args.car, args.wheel, args.output))


if __name__ == "__main__":
    main()
