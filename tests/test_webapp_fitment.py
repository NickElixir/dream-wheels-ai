from pathlib import Path


def test_fitment_entrypoints_expose_the_same_flow_mounts() -> None:
    pages = [
        Path("webapp/index.html").read_text(encoding="utf-8"),
        Path("webapp/t/index.html").read_text(encoding="utf-8"),
    ]

    for html in pages:
        assert 'data-nav="fitment"' in html
        assert 'data-view="fitment"' in html
        assert "data-fitment-root" in html
        assert "data-open-fitment" in html
        assert "/app.js?v=20260815-1" in html
        assert "/style.css?v=20260815-1" in html


def test_fitment_frontend_covers_both_pipeline_stages() -> None:
    app_js = Path("webapp/app.js").read_text(encoding="utf-8")
    fitment_js = Path("webapp/fitment.js").read_text(encoding="utf-8")

    assert 'from "./fitment.js?v=20260815-1"' in app_js
    assert "/fitment/preliminary" in fitment_js
    assert "/fitment/vehicle-identities" in fitment_js
    assert "/fitment/rim-setups" in fitment_js
    assert "/fitment/rim-url/resolve" in fitment_js
    assert "/fitment/checks" in fitment_js
    assert '"Idempotency-Key": idempotencyKey' in fitment_js
    assert "is_confirmed: true" in fitment_js
    assert "preliminary_run_id" in fitment_js
    assert "render_job_id" in fitment_js
    assert "data-fitment-resolve-url" in fitment_js
    assert "selection_required" in fitment_js
    assert "data-fitment-variant" in fitment_js
