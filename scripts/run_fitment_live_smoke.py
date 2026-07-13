"""Production-like live smoke for AITUNNEL + Wheel-Size without starting FastAPI."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.fitment.identification.vlm_client import OpenAICompatibleVlmClient
from src.fitment.images import normalize_fitment_image
from src.fitment.providers.wheel_size import WheelSizeProvider
from src.fitment.repository import InMemoryFitmentRepository
from src.fitment.schemas import FieldValue, RimSetup, RimSpec, Source, VehicleIdentity
from src.fitment.service import FitmentService


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--car-image", type=Path, required=True)
    parser.add_argument("--rim-image", type=Path, required=True)
    parser.add_argument("--make")
    parser.add_argument("--model")
    parser.add_argument("--year", type=int)
    parser.add_argument("--generation")
    parser.add_argument("--modification")
    parser.add_argument("--market", default="europe")
    parser.add_argument("--bolt-count", type=int)
    parser.add_argument("--pcd-mm", type=float)
    parser.add_argument("--center-bore-mm", type=float)
    parser.add_argument("--diameter-in", type=float)
    parser.add_argument("--width-j", type=float)
    parser.add_argument("--offset-et-mm", type=float)
    return parser


def _read_image(path: Path) -> tuple[bytes, dict[str, str | int]]:
    suffix_to_mime = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }
    return normalize_fitment_image(
        path.read_bytes(),
        content_type=suffix_to_mime.get(path.suffix.lower()),
    )


def _confirmed(value):
    if value is None:
        return FieldValue()
    return FieldValue(
        value=value,
        source=Source.user_confirmed,
        confidence=1,
        is_user_confirmed=True,
    )


def _has_confirmed_stage(args: argparse.Namespace) -> bool:
    required = (
        args.make,
        args.model,
        args.year,
        args.bolt_count,
        args.pcd_mm,
        args.center_bore_mm,
        args.diameter_in,
        args.width_j,
    )
    return all(value is not None for value in required)


async def _run(args: argparse.Namespace) -> dict:
    car, car_meta = _read_image(args.car_image)
    rim_image, rim_meta = _read_image(args.rim_image)
    repository = InMemoryFitmentRepository()
    service = FitmentService(
        repository=repository,
        provider=WheelSizeProvider(),
        vlm=OpenAICompatibleVlmClient(),
    )

    preliminary = await service.run_preliminary(
        owner_telegram_user_id=1,
        car_image_bytes=car,
        rim_image_bytes=rim_image,
        car_image_sha256=str(car_meta["sha256"]),
        rim_image_sha256=str(rim_meta["sha256"]),
    )
    output = {"preliminary": preliminary.model_dump(mode="json")}
    if not _has_confirmed_stage(args):
        output["confirmed"] = {
            "skipped": True,
            "reason": "Provide all confirmed vehicle and rim arguments for Stage 2.",
        }
        return output

    identity_id = await repository.save_vehicle_identity(
        VehicleIdentity(
            make=args.make,
            model=args.model,
            year=args.year,
            generation=args.generation,
            modification=args.modification,
            market=args.market,
            source=Source.user_confirmed,
            confidence=1,
            is_user_confirmed=True,
        ),
        owner_telegram_user_id=1,
    )
    rim = RimSpec(
        bolt_count=_confirmed(args.bolt_count),
        pcd_mm=_confirmed(args.pcd_mm),
        center_bore_mm=_confirmed(args.center_bore_mm),
        wheel_diameter_in=_confirmed(args.diameter_in),
        wheel_width_j=_confirmed(args.width_j),
        offset_et_mm=_confirmed(args.offset_et_mm),
    )
    setup_id = await repository.save_rim_setup(
        RimSetup(front=rim, rear=rim.model_copy(deep=True)),
        owner_telegram_user_id=1,
    )
    check = await service.create_check(
        owner_telegram_user_id=1,
        vehicle_identity_id=identity_id,
        rim_setup_id=setup_id,
        render_job_id=None,
        preliminary_run_id=preliminary.id,
        idempotency_key="live-smoke",
    )
    output["confirmed"] = (await service.execute_check(check)).model_dump(mode="json")
    return output


def main() -> None:
    args = _parser().parse_args()
    print(json.dumps(asyncio.run(_run(args)), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
