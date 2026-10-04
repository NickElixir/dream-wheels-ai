import pytest

from tests.helpers.source_extract import extract_function


def test_python_extraction_preserves_unicode_and_nested_javascript_syntax() -> None:
    target = 'async function target() { const a = "}"; return `😀 ${(() => ({x: /[{}]/}))().x}`; }'
    source = f'const prefix = "😀"; {target}\nfunction unrelated() {{}}'
    assert extract_function(source, "target") == target
    assert extract_function(target, "target") == target


def test_python_extraction_fails_on_a_missing_function() -> None:
    with pytest.raises(ValueError, match="Missing top-level function"):
        extract_function("function neighbor() {}", "target")
