import json
from pathlib import Path

COPY = json.loads(
    Path("webapp/vnext/copy.mjs")
    .read_text(encoding="utf-8")
    .split("export const COPY = ", 1)[1]
    .split(";\n\n", 1)[0]
)


def test_commercial_beta_warnings_are_present_in_their_product_states():
    html = Path("webapp/index.html").read_text(encoding="utf-8")
    app_js = Path("webapp/app.js").read_text(encoding="utf-8")

    expected = (
        "Dream Wheels находится в бета-режиме. Некоторые функции проходят финальное "
        "тестирование, а результат ИИ может содержать визуальные неточности.",
        "Параметры определены автоматически. Проверьте найденные значения перед "
        "технической оценкой.",
        "Предварительная проверка совместимости. Результат основан на доступных "
        "технических параметрах. Перед покупкой рекомендуем подтвердить совместимость "
        "у продавца или установочного центра.",
        "Недостаточно данных для надёжной проверки совместимости. Проверьте отсутствующие "
        "параметры диска вручную.",
        "Генерация временно недоступна.",
    )

    for text in expected:
        assert text in app_js or any(pair["ru"] == text for pair in COPY.values())

    assert 'data-i18n="warnings.beta"' in html
    assert "data-fitment-source-status-title" in html
    assert "data-fitment-source-status-copy" in html
    assert "data-fitment-verdict-warning" in html
    assert "data-fitment-missing-data-warning" not in html
    assert "data-fitment-rim-state" in html
    assert "data-error-support" in html


def test_generation_unavailable_uses_controlled_copy_and_recovery():
    app_js = Path("webapp/app.js").read_text(encoding="utf-8")

    assert 'title: uiCopy("legacy.warnings.generationUnavailable", language)' in app_js
    assert "showSupport: true" in app_js
    assert 'action: "retry"' in app_js


def test_wallet_explains_the_paid_unit_as_a_render_generation():
    assert any(
        pair["ru"] == "1 рендер — 1 генерация виртуальной примерки" for pair in COPY.values()
    )
    assert any(pair["ru"] == "История" for pair in COPY.values())
    assert any(pair["ru"] == "Создать виртуальную примерку" for pair in COPY.values())
