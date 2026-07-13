"""Tests for rim OCR parsing."""

from fitment_verdict.identification.rim_ocr import parse_rim_text


def test_parse_full_marking():
    text = "18x7.5 ET40 5x114.3 CB66.6"
    rim = parse_rim_text(text)
    assert rim.diameter == 18.0
    assert rim.width == 7.5
    assert rim.offset == 40.0
    assert rim.bolt_pattern == "5x114.3"
    assert rim.center_bore_mm == 66.6
