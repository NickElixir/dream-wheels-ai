from pathlib import Path


def test_wallet_rerenders_after_cabinet_loading_finishes():
    app_js = Path("webapp/app.js").read_text(encoding="utf-8")
    load_cabinet = app_js[
        app_js.index("async function loadCabinet") : app_js.index("function openExternal")
    ]

    finally_section = load_cabinet.rsplit("finally {", maxsplit=1)[1]
    assert (
        finally_section.index("setWalletBusy(false)")
        < finally_section.index("setWalletLoading(false)")
        < finally_section.index("renderWallet()")
    )


def test_dashboard_initialization_does_not_duplicate_cabinet_or_history_requests():
    app_js = Path("webapp/app.js").read_text(encoding="utf-8")

    assert "let cabinetRequestPromise = null;" in app_js
    assert "let renderHistoryRequestPromise = null;" in app_js
    assert "if (cabinetRequestPromise) return cabinetRequestPromise;" in app_js
    assert "if (renderHistoryRequestPromise) return renderHistoryRequestPromise;" in app_js
    assert "const sharedRequest = request.finally(() =>" in app_js
    assert "if (cabinetRequestPromise === sharedRequest) cabinetRequestPromise = null;" in app_js
    assert (
        "if (renderHistoryRequestPromise === sharedRequest) renderHistoryRequestPromise = null;"
        in app_js
    )
    assert 'setView("dashboard", { refreshData: false });' in app_js
