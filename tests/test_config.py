import importlib

import pytest

from src import config as config_module


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("https://example.com", "https://example.com"),
        ("https://example.com/", "https://example.com"),
        ("http://localhost:3000", "http://localhost:3000"),
        ("https://example.com:8443", "https://example.com:8443"),
    ],
)
def test_normalize_origin_url_accepts_absolute_http_origins(value, expected):
    assert config_module.normalize_origin_url(value, name="WEBAPP_URL") == expected


@pytest.mark.parametrize(
    "value",
    [
        "https://example.com/t/",
        "https://example.com/app",
        "https://example.com/foo/bar",
        "example.com",
        "/t/",
        "ftp://example.com",
        "https://example.com?foo=bar",
        "https://example.com/#section",
    ],
)
def test_normalize_origin_url_rejects_non_origin_values(value):
    with pytest.raises(ValueError, match="WEBAPP_URL must be an origin without a path"):
        config_module.normalize_origin_url(value, name="WEBAPP_URL")


def test_webapp_url_env_is_normalized(monkeypatch):
    monkeypatch.setenv("WEBAPP_URL", "https://example.com/")

    config = importlib.reload(config_module)

    assert config.WEBAPP_URL == "https://example.com"


def test_webapp_url_env_rejects_path_at_import(monkeypatch):
    monkeypatch.setenv("WEBAPP_URL", "https://example.com/t/")

    with pytest.raises(ValueError, match="WEBAPP_URL must be an origin without a path"):
        importlib.reload(config_module)


def test_supabase_project_ref_is_derived_from_supabase_url(monkeypatch):
    monkeypatch.delenv("SUPABASE_PROJECT_REF", raising=False)
    monkeypatch.setenv("SUPABASE_URL", "https://hnawojlnfoaccinlgjyn.supabase.co")

    config = importlib.reload(config_module)

    assert config.SUPABASE_PROJECT_REF == "hnawojlnfoaccinlgjyn"
    assert config.SUPABASE_STORAGE_URL == "https://hnawojlnfoaccinlgjyn.supabase.co/storage/v1"


def test_supabase_project_ref_has_no_hardcoded_fallback(monkeypatch):
    monkeypatch.delenv("SUPABASE_PROJECT_REF", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)

    config = importlib.reload(config_module)

    assert config.SUPABASE_PROJECT_REF == ""
    assert config.SUPABASE_STORAGE_URL == ""


def test_legal_base_url_has_public_default(monkeypatch):
    monkeypatch.delenv("LEGAL_BASE_URL", raising=False)

    config = importlib.reload(config_module)

    assert config.LEGAL_BASE_URL == "https://dream-wheels-ai-legal.vercel.app"


def test_legal_base_url_uses_env_override(monkeypatch):
    monkeypatch.setenv("LEGAL_BASE_URL", "https://example.com/legal/")

    config = importlib.reload(config_module)

    assert config.LEGAL_BASE_URL == "https://example.com/legal"
