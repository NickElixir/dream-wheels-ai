"""Allowlisted generation evidence, independent of image bytes and provider secrets."""

import hashlib
import json
import logging
import os
import re

import asyncpg

from src.assets_service import AssetUpload
from src.generation.base import GenerationRequest, GenerationResult
from src.generation.inputs import GenerationInput

logger = logging.getLogger(__name__)


def request_snapshot(
    request: GenerationRequest,
    *,
    vehicle: GenerationInput,
    rim_reference: GenerationInput,
    model: str | None,
) -> dict[str, object]:
    """Never serialize a request/config object: both can contain sensitive data."""
    commit = os.getenv("RENDER_GIT_COMMIT", "")
    snapshot: dict[str, object] = {
        "schema_version": 1,
        "generation_prompt_version": request.prompt_version,
        "prompt_sha256": hashlib.sha256(request.instruction.strip().encode()).hexdigest(),
        "generation_model": model,
        "worker_commit_sha": commit if re.fullmatch(r"[0-9a-fA-F]{40}", commit) else None,
        "requested_output_width": request.output_width,
        "requested_output_height": request.output_height,
        "seed": request.seed,
        "bbox_enabled": request.edit_regions is not None,
    }
    for prefix, image in (("vehicle_input", vehicle), ("rim_input", rim_reference)):
        snapshot.update(
            {
                f"{prefix}_width": image.width,
                f"{prefix}_height": image.height,
                f"{prefix}_content_type": image.content_type,
                f"{prefix}_size_bytes": len(image.data),
                f"{prefix}_sha256": hashlib.sha256(image.data).hexdigest(),
            }
        )
    return snapshot


async def persist_generation_request(
    pool: asyncpg.Pool,
    *,
    job_id: str,
    user_id: int,
    request: GenerationRequest,
    vehicle: GenerationInput,
    rim_reference: GenerationInput,
    model: str | None,
) -> None:
    """Write once before paid submission; never backfill legacy jobs on reads."""
    snapshot = request_snapshot(request, vehicle=vehicle, rim_reference=rim_reference, model=model)
    async with pool.acquire() as conn:
        written = await conn.fetchval(
            """
            UPDATE jobs
            SET render_input_snapshot = COALESCE(render_input_snapshot, '{}'::jsonb)
                || jsonb_build_object('generation', jsonb_build_object('request', $3::jsonb))
            WHERE id = $1::uuid AND user_id = $2
              AND status = 'processing' AND credit_status = 'reserved'
              AND jsonb_typeof(COALESCE(render_input_snapshot, '{}'::jsonb)) = 'object'
              AND NOT (COALESCE(render_input_snapshot, '{}'::jsonb) ? 'generation')
            RETURNING id
            """,
            job_id,
            user_id,
            json.dumps(snapshot),
        )
    if not written:
        # An existing intent must not be silently replaced with a different release.
        raise RuntimeError("Generation intent cannot be recorded for the active job")
    logger.info(
        "generation_request job_id=%s user_id=%s diagnostics=%s",
        job_id,
        user_id,
        json.dumps(snapshot, sort_keys=True),
    )


async def persist_generation_result(
    pool: asyncpg.Pool,
    *,
    job_id: str,
    user_id: int,
    request: GenerationRequest,
    result: GenerationResult,
    candidate: AssetUpload,
) -> None:
    """Append measured output evidence without rewriting the immutable intent."""
    snapshot = {
        "provider_output_width": result.output_width,
        "provider_output_height": result.output_height,
        "provider_output_content_type": result.content_type,
        "provider_output_size_bytes": len(result.image_bytes),
        "provider_output_sha256": hashlib.sha256(result.image_bytes).hexdigest(),
        "stored_output_width": candidate.width,
        "stored_output_height": candidate.height,
        "stored_output_content_type": candidate.content_type,
        "stored_output_size_bytes": candidate.size_bytes,
        "stored_output_sha256": candidate.sha256,
        "output_size_mismatch": (result.output_width, result.output_height)
        != (request.output_width, request.output_height),
    }
    async with pool.acquire() as conn:
        written = await conn.fetchval(
            """
            UPDATE jobs
            SET render_input_snapshot = jsonb_set(
                render_input_snapshot, '{generation,result}', $3::jsonb
            )
            WHERE id = $1::uuid AND user_id = $2
              AND status = 'completed' AND credit_status = 'finalized'
              AND jsonb_typeof(render_input_snapshot->'generation'->'request') = 'object'
              AND NOT ((render_input_snapshot->'generation') ? 'result')
            RETURNING id
            """,
            job_id,
            user_id,
            json.dumps(snapshot),
        )
    if not written:
        raise RuntimeError("Generation result diagnostics cannot be recorded")
    log = logger.warning if snapshot["output_size_mismatch"] else logger.info
    log(
        "generation_result job_id=%s user_id=%s diagnostics=%s",
        job_id,
        user_id,
        json.dumps(snapshot, sort_keys=True),
    )
