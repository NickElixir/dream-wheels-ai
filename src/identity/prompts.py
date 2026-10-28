"""Versioned prompts for vehicle visual identity."""

from src.config import VEHICLE_IDENTITY_PROMPT_VERSION

PROMPT_VERSION = VEHICLE_IDENTITY_PROMPT_VERSION
RESOLVER_VERSION = "vehicle_identity_resolver_v1"

VEHICLE_IDENTITY_PROMPT = """Identify the visible passenger vehicle from this single image.
Return only the requested JSON schema. Identify only make, model and a single year or year range.
Do not infer generation, trim, modification, market, engine, drivetrain, rim specifications, or fitment.
A logo alone is not enough to identify a model. Return unknown when the vehicle is not visible,
there are multiple vehicles, the view is insufficient, or make/model/year cannot be stated reliably.
Return at most one primary candidate and two alternatives. Confidence must be between zero and one.
For an exact year set year and set year_start/year_end to null. For a year range set year to null
and set both year_start/year_end. Never return an exact year and a range together."""

_CANDIDATE_BASE_PROPERTIES = {
    "make": {"type": "string", "minLength": 1, "maxLength": 120},
    "model": {"type": "string", "minLength": 1, "maxLength": 160},
    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
    "source": {"type": "string", "enum": ["vlm_visual"]},
}
_EXACT_YEAR_CANDIDATE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        **_CANDIDATE_BASE_PROPERTIES,
        "year": {"type": "integer", "minimum": 1886, "maximum": 2100},
        "year_start": {"type": "null"},
        "year_end": {"type": "null"},
    },
    "required": ["make", "model", "year", "year_start", "year_end", "confidence", "source"],
}
_YEAR_RANGE_CANDIDATE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        **_CANDIDATE_BASE_PROPERTIES,
        "year": {"type": "null"},
        "year_start": {"type": "integer", "minimum": 1886, "maximum": 2100},
        "year_end": {"type": "integer", "minimum": 1886, "maximum": 2100},
    },
    "required": ["make", "model", "year", "year_start", "year_end", "confidence", "source"],
}
_CANDIDATE_SCHEMA = {"anyOf": [_EXACT_YEAR_CANDIDATE_SCHEMA, _YEAR_RANGE_CANDIDATE_SCHEMA]}
VEHICLE_IDENTITY_JSON_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "status": {"enum": ["resolved", "ambiguous", "unknown"]},
        "primary": {"anyOf": [_CANDIDATE_SCHEMA, {"type": "null"}]},
        "alternatives": {"type": "array", "items": _CANDIDATE_SCHEMA, "maxItems": 2},
        "abstention_reason": {
            "anyOf": [
                {
                    "enum": [
                        "vehicle_not_visible",
                        "multiple_vehicles",
                        "image_too_blurry",
                        "vehicle_too_occluded",
                        "unsupported_view",
                        "make_uncertain",
                        "model_uncertain",
                        "year_uncertain",
                        "provider_returned_no_candidates",
                    ]
                },
                {"type": "null"},
            ]
        },
    },
    "required": ["status", "primary", "alternatives", "abstention_reason"],
}
