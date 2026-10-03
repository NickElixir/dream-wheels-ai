from datetime import UTC, datetime
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from src import identity_api
from src.auth_principal import AuthPrincipal
from src.identity.providers.base import VehicleIdentityProviderError
from src.identity.schemas import VehicleIdentityResolution
from src.main import app

client = TestClient(app)
JOB_ID = "11111111-1111-4111-8111-111111111111"


def image_bytes() -> bytes:
    output = BytesIO()
    Image.new("RGB", (320, 240), (20, 30, 40)).save(output, format="PNG")
    return output.getvalue()


def test_proposal_requires_auth_before_database_access(monkeypatch):
    def no_database():
        raise AssertionError("Unauthenticated request must not read the job")

    monkeypatch.setattr(identity_api.db, "get_pool", no_database)
    assert request().status_code == 401


def test_recognition_retains_own_quota_after_create_uploads(monkeypatch, proposal_context):
    quotas = {"identity_resolve": 0, "create_assets": 10}

    async def limit(**kwargs):
        assert kwargs["scope"] == "identity_resolve"
        assert kwargs["limit"] == 20
        assert kwargs["window_sec"] == 3600
        quotas[kwargs["scope"]] += 1

    monkeypatch.setattr(identity_api, "enforce_rate_limit", limit)
    assert request().status_code == 200
    assert quotas == {"identity_resolve": 1, "create_assets": 10}


@pytest.fixture
def proposal_context(monkeypatch):
    row = {"fitment_available": True, "vehicle_revision": 10}
    calls = []

    class Conn:
        async def execute(self, *_args):
            raise AssertionError("Vehicle proposal must not persist anything")

    class Acquire:
        async def __aenter__(self):
            return Conn()

        async def __aexit__(self, *_args):
            return False

    class Pool:
        def acquire(self):
            return Acquire()

    async def auth(_conn, **_kwargs):
        return AuthPrincipal(
            user_id=77, authority="telegram", subject="123", auth_channel="mini_app"
        )

    async def fetch(_conn, *, job_id, user_id):
        calls.append((job_id, user_id))
        return row if row else None

    async def rate_limit(**kwargs):
        calls.append(kwargs["scope"])

    class Resolver:
        async def resolve(self, normalized):
            calls.append("provider")
            return VehicleIdentityResolution.model_validate(
                {
                    "status": "resolved",
                    "primary": {
                        "make": "Porsche",
                        "model": "Cayenne",
                        "year_start": 2020,
                        "year_end": 2022,
                        "confidence": 0.8,
                    },
                    "metadata": {
                        "provider": "test",
                        "model": "test",
                        "prompt_version": "test",
                        "resolver_version": "test",
                        "normalized_input_sha256": normalized.sha256,
                        "captured_at": datetime.now(UTC),
                    },
                }
            )

    monkeypatch.setattr(identity_api, "preflight_auth_credentials", lambda **_kwargs: None)
    monkeypatch.setattr(identity_api, "require_auth_principal", auth)
    monkeypatch.setattr(identity_api.db, "get_pool", lambda: Pool())
    monkeypatch.setattr(identity_api, "_fetch_fitment_job_row", fetch)
    monkeypatch.setattr(identity_api, "enforce_rate_limit", rate_limit)
    monkeypatch.setattr(identity_api, "get_vehicle_identity_resolver", lambda: Resolver())
    return row, calls


def request(*, revision=10, data=None, content_type="image/png"):
    return client.post(
        f"/identity/fitment/{JOB_ID}/vehicle-proposal",
        data={"expected_vehicle_revision": revision},
        files={"car_image": ("car.png", image_bytes() if data is None else data, content_type)},
    )


def test_proposal_is_owned_revision_bound_and_noncanonical(proposal_context):
    row, calls = proposal_context
    response = request()
    assert response.status_code == 200
    assert response.json()["vehicle_revision"] == 10
    primary = response.json()["vehicle"]["primary"]
    assert primary["year"] is None
    assert primary["year_start"] == 2020
    assert "generation" not in primary and "market" not in primary
    assert calls == [(JOB_ID, 77), "identity_resolve", "provider", (JOB_ID, 77)]
    assert row == {"fitment_available": True, "vehicle_revision": 10}


@pytest.mark.parametrize(
    "mutation,status", [("missing", 404), ("unavailable", 409), ("stale", 409)]
)
def test_proposal_rejects_invalid_context_before_provider(proposal_context, mutation, status):
    row, calls = proposal_context
    if mutation == "missing":
        row.clear()
    elif mutation == "unavailable":
        row["fitment_available"] = False
    else:
        row["vehicle_revision"] = 11
    assert request().status_code == status
    assert "provider" not in calls


def test_proposal_rejects_revision_changed_during_provider(proposal_context, monkeypatch):
    row, _calls = proposal_context
    resolver = identity_api.get_vehicle_identity_resolver()

    class RaceResolver:
        async def resolve(self, normalized):
            row["vehicle_revision"] = 11
            return await resolver.resolve(normalized)

    monkeypatch.setattr(identity_api, "get_vehicle_identity_resolver", lambda: RaceResolver())
    assert request().status_code == 409


@pytest.mark.parametrize(
    "data,content_type,status",
    [(b"bad", "image/png", 400), (b"", "image/png", 400), (b"bad", "text/plain", 415)],
)
def test_proposal_rejects_invalid_image_without_provider(
    proposal_context, data, content_type, status
):
    _row, calls = proposal_context
    assert request(data=data, content_type=content_type).status_code == status
    assert "provider" not in calls


def test_proposal_provider_failure_is_retryable_without_writes(proposal_context, monkeypatch):
    class FailedResolver:
        async def resolve(self, _normalized):
            raise VehicleIdentityProviderError("unavailable")

    monkeypatch.setattr(identity_api, "get_vehicle_identity_resolver", lambda: FailedResolver())
    response = request()
    assert response.status_code == 503
    assert response.json()["detail"]["retryable"] is True
