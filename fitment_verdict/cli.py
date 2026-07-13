#!/usr/bin/env python3
"""CLI entrypoint for the standalone fitment verdict pipeline.

Stages:
  preliminary  photos only -> VLM guess + preliminary verdict + editable draft
  confirmed    user-verified structured data -> Wheel-Size check + risk verdict
  legacy       original single-pass pipeline (default, backwards compatible)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys

from fitment_verdict.config import load_config
from fitment_verdict.schemas import (
    ConfirmedCheckRequest,
    FitmentVerdictRequest,
    PreliminaryCheckRequest,
    RimSpec,
    RimUserInput,
    Source,
    VehicleQuery,
    VehicleUserInput,
)
from fitment_verdict.service import FitmentVerdictService


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run fitment verdict pipeline")
    parser.add_argument(
        "--stage",
        choices=["legacy", "preliminary", "confirmed"],
        default="legacy",
    )
    parser.add_argument("--car-image", help="Path to car photo")
    parser.add_argument("--rim-image", help="Path to rim photo")
    parser.add_argument("--make")
    parser.add_argument("--model")
    parser.add_argument("--year", type=int)
    parser.add_argument("--body")
    parser.add_argument("--generation")
    parser.add_argument("--modification")
    parser.add_argument("--region", default="russia")
    parser.add_argument("--rim-brand")
    parser.add_argument("--rim-model")
    parser.add_argument("--rim-sku")
    parser.add_argument("--rim-url")
    parser.add_argument("--rim-diameter", type=float)
    parser.add_argument("--rim-width", type=float)
    parser.add_argument("--rim-offset", type=float)
    parser.add_argument("--rim-bolt-count", type=int)
    parser.add_argument("--rim-pcd", type=float)
    parser.add_argument("--rim-bolt-pattern")
    parser.add_argument("--rim-center-bore", type=float)
    parser.add_argument("--rim-fastener-seat")
    parser.add_argument("--rim-load-rating", type=float)
    parser.add_argument("--rim-ocr-text")
    parser.add_argument("--user-initiated", action="store_true", default=True)
    parser.add_argument("--log-level", default="INFO")
    return parser


def _rim_user_input(args: argparse.Namespace) -> RimUserInput:
    bolt_count = args.rim_bolt_count
    pcd_mm = args.rim_pcd
    if args.rim_bolt_pattern and (bolt_count is None or pcd_mm is None):
        parts = args.rim_bolt_pattern.lower().replace("×", "x").split("x")
        if len(parts) == 2:
            bolt_count = bolt_count or int(parts[0])
            pcd_mm = pcd_mm or float(parts[1])
    return RimUserInput(
        brand=args.rim_brand,
        model=args.rim_model,
        sku=args.rim_sku,
        product_url=args.rim_url,
        diameter=args.rim_diameter,
        width=args.rim_width,
        bolt_count=bolt_count,
        pcd_mm=pcd_mm,
        offset=args.rim_offset,
        center_bore_mm=args.rim_center_bore,
        fastener_seat=args.rim_fastener_seat,
        load_rating=args.rim_load_rating,
    )


async def main_async(args: argparse.Namespace) -> int:
    service = FitmentVerdictService(load_config())

    if args.stage == "preliminary":
        if not args.car_image or not args.rim_image:
            print("preliminary stage requires --car-image and --rim-image", file=sys.stderr)
            return 2
        preliminary = await service.run_preliminary(
            PreliminaryCheckRequest(
                car_image_path=args.car_image,
                rim_image_path=args.rim_image,
            )
        )
        print(json.dumps(preliminary.model_dump(mode="json"), ensure_ascii=False, indent=2))
        return 0 if preliminary.execution_status.value == "completed" else 1

    if args.stage == "confirmed":
        request = ConfirmedCheckRequest(
            vehicle=VehicleUserInput(
                make=args.make,
                model=args.model,
                year=args.year,
                body=args.body,
                generation=args.generation,
                modification=args.modification,
                region=args.region,
            ),
            rim=_rim_user_input(args),
        )
        result = await service.run_confirmed(request)
        print(json.dumps(result.model_dump(mode="json"), ensure_ascii=False, indent=2))
        return 0 if result.execution_status.value == "completed" else 1

    vehicle = None
    if args.make and args.model and args.year:
        vehicle = VehicleQuery(
            make=args.make,
            model=args.model,
            year=args.year,
            region=args.region,
            source=Source.user_confirmed,
            confidence=1.0,
            is_user_confirmed=True,
        )

    rim = None
    if any(
        [
            args.rim_diameter,
            args.rim_width,
            args.rim_offset,
            args.rim_bolt_pattern,
            args.rim_center_bore,
        ]
    ):
        rim = RimSpec(
            diameter=args.rim_diameter,
            width=args.rim_width,
            offset=args.rim_offset,
            bolt_pattern=args.rim_bolt_pattern,
            center_bore_mm=args.rim_center_bore,
            source=Source.user_confirmed,
            confidence=1.0,
            is_user_confirmed=True,
        ).sync_bolt_fields()

    request = FitmentVerdictRequest(
        car_image_path=args.car_image,
        rim_image_path=args.rim_image,
        vehicle=vehicle,
        rim=rim,
        rim_ocr_text=args.rim_ocr_text,
        user_initiated=args.user_initiated,
    )
    result = await service.run(request)
    print(json.dumps(result.model_dump(mode="json"), ensure_ascii=False, indent=2))
    return 0 if result.execution_status.value == "completed" else 1


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    logging.basicConfig(level=getattr(logging, args.log_level.upper(), logging.INFO))
    raise SystemExit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    main()
