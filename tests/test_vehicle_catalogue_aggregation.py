import asyncio

from src.fitment.vehicle_catalogue import VehicleCatalogueAggregator


class FakeCatalogueProvider:
    async def catalogue_regions(self):
        return [
            {"slug": "chdm", "name": "Китай"},
            {"slug": "russia", "name": "Россия+"},
            {"slug": "eudm", "name": "Европа"},
        ]

    async def catalogue_makes(self, *, region):
        assert tuple(region) == ("chdm", "russia", "eudm")
        return [
            {"slug": "zeekr", "name": "ZEEKR", "regions": ["chdm", "russia"]},
            {"slug": "bmw", "name": "BMW", "regions": ["eudm"]},
        ]

    async def catalogue_models(self, *, make, region):
        assert make == "zeekr"
        assert tuple(region) == ("chdm", "russia")
        return [
            {"slug": "007", "name": "007", "regions": ["chdm", "russia"]},
            {"slug": "001", "name": "001", "regions": ["chdm"]},
        ]

    async def catalogue_years(self, *, make, model, region):
        assert make == "zeekr"
        years = {
            ("007", "chdm"): [{"year": 2025}],
            ("007", "russia"): [{"year": 2025}],
            ("001", "chdm"): [{"year": 2025}],
        }
        return years.get((model, region), [])


def test_make_first_aggregation_preserves_provider_region_identity():
    aggregator = VehicleCatalogueAggregator(FakeCatalogueProvider(), concurrency=2)

    async def run():
        makes = await aggregator.makes()
        models = await aggregator.models("ZEEKR")
        years = await aggregator.years("ZEEKR", "001")
        one_market = await aggregator.markets("ZEEKR", "001", 2025)
        several_markets = await aggregator.markets("ZEEKR", "007", 2025)
        exact = await aggregator.resolve_exact(make="ZEEKR", model="001", year=2025, region="chdm")
        return makes, models, years, one_market, several_markets, exact

    makes, models, years, one_market, several_markets, exact = asyncio.run(run())

    zeekr = next(item for item in makes if item["value"] == "zeekr")
    assert {item["region"] for item in zeekr["identities"]} == {"chdm", "russia"}
    assert {item["value"] for item in models} == {"001", "007"}
    assert next(item for item in models if item["value"] == "001")["identities"] == [
        {"region": "chdm", "provider_id": "001"}
    ]
    assert years[0]["value"] == "2025"
    assert one_market["resolution"] == "single"
    assert one_market["resolved_market"]["value"] == "chdm"
    assert one_market["items"] == []
    assert several_markets["resolution"] == "selection_required"
    assert {item["value"] for item in several_markets["items"]} == {"chdm", "russia"}
    assert exact == {
        "make": "ZEEKR",
        "model": "001",
        "year": 2025,
        "region": "chdm",
        "make_slug": "zeekr",
        "model_slug": "001",
    }
