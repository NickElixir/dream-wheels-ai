import json

import pytest

from analysis.marketplace_parser.run_benchmark import load_yaml, validate_manifest


def _manifest(cards):
    return {
        "dataset_version": 1,
        "base_commit": "abc",
        "resolver_commit": "abc",
        "cards": cards,
    }


def _card(case_id="ym-001", url="https://example.test/card/1"):
    return {"id": case_id, "canonical_url": url, "marketplace": "yandex_market"}


def test_manifest_loader_reads_yaml_and_rejects_duplicate_ids_and_urls(tmp_path) -> None:
    manifest_path = tmp_path / "manifest.yaml"
    manifest_path.write_text(
        "dataset_version: 1\nbase_commit: abc\nresolver_commit: abc\ncards: []\n",
        encoding="utf-8",
    )
    assert load_yaml(manifest_path)["dataset_version"] == 1
    with pytest.raises(ValueError, match="Duplicate dataset ID"):
        validate_manifest(
            _manifest([_card(), _card(url="https://example.test/card/2")]),
            {"dataset_version": 1, "ym-001": {}},
        )
    with pytest.raises(ValueError, match="Duplicate canonical URL"):
        validate_manifest(
            _manifest([_card(), _card(case_id="ym-002")]),
            {"dataset_version": 1, "ym-001": {}, "ym-002": {}},
        )


def test_manifest_loader_requires_ground_truth_for_every_card() -> None:
    with pytest.raises(ValueError, match="Ground truth missing"):
        validate_manifest(_manifest([_card()]), {"dataset_version": 1})


def test_results_observation_is_json_serializable_and_nulls_survive() -> None:
    result = {
        "resolver": None,
        "comparison": None,
        "fetch": {"http_status": None},
    }
    round_trip = json.loads(json.dumps(result))
    assert round_trip == result
