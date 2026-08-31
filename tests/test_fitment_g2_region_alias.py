import asyncio

from src import jobs_api


def test_legacy_cn_vehicle_region_resolves_to_canonical_catalogue_region() -> None:
    class FakeCatalogueProvider:
        async def catalogue_regions(self):
            return [{"slug": "chdm", "name": "China"}]

        async def catalogue_makes(self, *, region):
            assert region == "chdm"
            return [{"slug": "zeekr", "name": "ZEEKR"}]

        async def catalogue_models(self, *, make, region):
            assert (make, region) == ("zeekr", "chdm")
            return [{"slug": "001", "name": "001"}]

        async def catalogue_years(self, *, make, model, region):
            assert (make, model, region) == ("zeekr", "001", "chdm")
            return [{"year": 2022}]

    resolved = asyncio.run(
        jobs_api._resolve_exact_vehicle_catalogue_selection(
            FakeCatalogueProvider(),
            make="ZEEKR",
            model="001",
            region="CN",
            year=2022,
        )
    )

    assert resolved is not None
    assert resolved["region"] == "chdm"
    assert jobs_api._LEGACY_REGION_ALIASES["cn"] == "chdm"
