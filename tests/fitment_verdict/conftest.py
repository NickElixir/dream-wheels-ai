"""Shared fixtures for fitment verdict tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from fitment_verdict.config import FitmentConfig
from fitment_verdict.identification.rim_vlm import MockRimVLM
from fitment_verdict.identification.vehicle_vlm import MockVehicleVLM
from fitment_verdict.providers.cache import FileCache
from fitment_verdict.providers.wheel_size import normalize_vehicle_payload
from fitment_verdict.schemas import FitmentProfile, VehicleQuery

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def config(tmp_path) -> FitmentConfig:
    return FitmentConfig(
        wheel_size_api_key="test-key",
        wheel_size_base_url="https://api.wheel-size.com/v2",
        cache_dir=str(tmp_path / "cache"),
        openai_api_key=None,
    )


@pytest.fixture
def cache(tmp_path) -> FileCache:
    return FileCache(tmp_path / "cache")


@pytest.fixture
def sample_vehicle_query() -> VehicleQuery:
    return VehicleQuery(
        make="Haval",
        model="Chitu",
        year=2022,
        region="chdm",
        make_slug="haval",
        model_slug="chitu",
        is_user_confirmed=True,
    )


@pytest.fixture
def sample_profile(sample_vehicle_query: VehicleQuery) -> FitmentProfile:
    payload = json.loads((FIXTURES / "wheel_size_vehicle.json").read_text(encoding="utf-8"))
    return normalize_vehicle_payload(
        payload,
        provider="wheel_size",
        vehicle_query=sample_vehicle_query,
        raw_response_ref="fixture",
    )


@pytest.fixture
def mock_vehicle_vlm() -> MockVehicleVLM:
    return MockVehicleVLM(
        {
            "make": "Haval",
            "model": "Chitu",
            "year_from": 2022,
            "year_to": 2022,
            "body_type": "SUV",
            "market_guess": "chdm",
            "confidence": 0.91,
            "notes": "fixture",
        }
    )


@pytest.fixture
def mock_rim_vlm() -> MockRimVLM:
    return MockRimVLM(
        {
            "style": "multi-spoke",
            "finish": "gloss",
            "confidence": 0.4,
        }
    )


@pytest.fixture
def tiny_jpeg(tmp_path) -> str:
    from PIL import Image

    path = tmp_path / "tiny.jpg"
    Image.new("RGB", (64, 64), color=(120, 120, 120)).save(path, format="JPEG")
    return str(path)
