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
