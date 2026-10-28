import asyncio
import json
from pathlib import Path

from src import jobs_api
from src.fitment.providers.wheel_size import WheelSizeProvider
from src.fitment.variant_details import VariantDisplayDetails, wheel_size_display_details

ROOT = Path(__file__).resolve().parents[1] / "docs/evidence/p05c0-wheel-size-live-spike/raw"


def test_live_fixture_enrichment_and_identity_snapshot():
    for name in [
        "porsche-cayenne-2021-eudm",
        "tesla-model-3-2023-eudm",
        "volkswagen-golf-2020-eudm",
    ]:
        mods = json.loads((ROOT / f"{name}-modifications.json").read_text())["data"]
        generations = json.loads((ROOT / f"{name}-generations.json").read_text())["data"]
        provider = WheelSizeProvider(api_key="", cache=object())

        async def catalogue(path, params, mods=mods, generations=generations):
            if path == "years":
                return [params.get("year", 2023)] if "year" in params else [2020, 2021, 2023]
            if path == "generations":
                return generations
            return [x for x in mods if x["generation"]["slug"] == params["generation"]]

        provider._cataloging = catalogue
        first = mods[0]
        variants = asyncio.run(
            provider.find_vehicle_variants_exact(
                make_slug=first["make"]["slug"],
                model_slug=first["model"]["slug"],
                region="eudm",
                year=2023 if "tesla" in name else 2021 if "porsche" in name else 2020,
            )
        )
        assert len(variants) == len(mods)
        raw_by_id = {x["slug"]: x for x in mods}
        for variant in variants:
            raw = raw_by_id[variant["modification_slug"]]
            assert variant["power_kw"] == raw["engine"]["power"]["kW"]
            response = jobs_api.VehicleVariantResponse(**variant)
            persisted = jobs_api._canonical_selected_modification(variant)
            assert persisted["power_kw"] == response.power_kw
            changed = {**persisted, "power_kw": 999, "production_year_from": 2000}
            assert jobs_api._variant_selection_matches(persisted, changed)
            selected = jobs_api.FitmentSelectedModificationResponse(
                provider="wheel_size", **persisted
            )
            assert selected.model_dump()["power_kw"] == raw["engine"]["power"]["kW"]


def test_optional_invalid_enrichment_never_breaks_identity():
    details = wheel_size_display_details(
        {
            "engine": {"power": {"kW": "NaN"}, "capacity": {}},
            "trim_attributes": "AWD",
            "start_year": True,
        }
    )
    assert details == {}
    assert (
        VariantDisplayDetails.model_validate({"power_kw": [], "engine_code": {}}).model_dump() == {}
    )
    assert wheel_size_display_details(
        {"trim_attributes": ["AWD", None, "AWD"], "trim_body_types": ["Coupe"]}
    ) == {"trim_attributes": ["AWD"], "trim_body_types": ["Coupe"]}


def test_postgres_selected_display_snapshot_roundtrip():
    import os
    from urllib.parse import urlsplit

    import asyncpg
    import pytest

    dsn = os.getenv("TEST_VEHICLE_CONFIRMATION_DATABASE_URL")
    if not dsn:
        pytest.skip("Set isolated local provenance PostgreSQL URL")
    assert urlsplit(dsn).hostname in {"127.0.0.1", "localhost", "::1"} and not urlsplit(dsn).query

    async def run():
        conn = await asyncpg.connect(dsn)
        try:
            async with conn.transaction():
                await conn.execute(
                    "CREATE TEMP TABLE selected_snapshot_test (mapping jsonb) ON COMMIT DROP"
                )
                raw = json.loads(
                    (ROOT / "porsche-cayenne-2021-eudm-modifications.json").read_text()
                )["data"]
                raw = next(x for x in raw if x["slug"] == "19e5c5a357")
                variant = {
                    "make_slug": "porsche",
                    "model_slug": "cayenne",
                    "region": "eudm",
                    "generation": "E3 (9Y)",
                    "generation_slug": "2794f6a20e",
                    "modification": raw["name"],
                    "modification_slug": raw["slug"],
                    "body": "",
                    "market": "eudm",
                    **wheel_size_display_details(raw),
                }
                selected = jobs_api._canonical_selected_modification(variant)
                mapping = {
                    "wheel_size": {
                        "selected_modification": selected,
                        "modification_state": "confirmed",
                        "selection_source": "user",
                        "modification_vehicle_revision": 2,
                    }
                }
                await conn.execute(
                    "INSERT INTO selected_snapshot_test VALUES ($1::jsonb)", json.dumps(mapping)
                )
                read = json.loads(await conn.fetchval("SELECT mapping FROM selected_snapshot_test"))
                row = {"vehicle_revision": 2, "vehicle_provider_mappings": read}
                state, _, response, revision = jobs_api._modification_from_row(row)
                assert state == "confirmed" and revision == 2
                assert response.trim_body_types == ["Coupe"] and response.power_kw == 250
                assert response.production_year_from == 2019
                legacy = {k: selected[k] for k in jobs_api._SELECTED_MODIFICATION_KEYS}
                read["wheel_size"]["selected_modification"] = legacy
                assert jobs_api._modification_from_row(row)[2].power_kw is None
                assert jobs_api._variant_selection_matches(response, legacy)
        finally:
            await conn.close()

    asyncio.run(run())
