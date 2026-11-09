import json
from datetime import UTC, datetime, timedelta

from src.registration_attribution import parse_registration_touch


def test_registration_touch_validation():
    now = datetime.now(UTC)
    valid = {
        "source": "catalog",
        "locale": "ru",
        "touched_at": (now - timedelta(hours=1)).isoformat(),
        "utm_campaign": "зима",
        "utm_source": "  ad  ",
        "unapproved": "discard",
    }
    result = parse_registration_touch(json.dumps(valid))
    assert result is not None
    assert result["utm"] == {"utm_campaign": "зима", "utm_source": "ad"}
    for changes in (
        {"touched_at": (now - timedelta(hours=25)).isoformat()},
        {"touched_at": (now + timedelta(hours=1)).isoformat()},
        {"locale": "other"},
        {"source": "direct"},
    ):
        assert parse_registration_touch(json.dumps(valid | changes)) is None
    assert parse_registration_touch("broken") is None
