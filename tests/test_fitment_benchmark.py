from scripts.fitment_benchmark import run_benchmark


def test_fitment_verdict_v1_benchmark_has_no_false_compatible_results() -> None:
    report = run_benchmark()

    assert report["case_count"] == 33
    assert report["expected_status_mismatches"] == 0
    assert report["false_compatible_count"] == 0
    assert report["false_compatible_rate"] == 0.0
