"""
Unit tests for the Sentry before_send scrubber in backend/app/__init__.py.
No DB or Flask app needed — pure function test.

Must pop SENTRY_DSN before importing app so the Sentry init block is skipped.
"""
import os
os.environ.pop("SENTRY_DSN", None)  # must happen before `from app import ...`

from app import _before_send  # noqa: E402


def test_strips_authorization_header():
    event = {"request": {"headers": {"Authorization": "Bearer secret", "Content-Type": "application/json"}}}
    result = _before_send(event, {})
    assert result["request"]["headers"]["Authorization"] == "[FILTERED]"
    assert result["request"]["headers"]["Content-Type"] == "application/json"


def test_strips_cookie_header():
    event = {"request": {"headers": {"Cookie": "session=abc123", "Accept": "*/*"}}}
    result = _before_send(event, {})
    assert result["request"]["headers"]["Cookie"] == "[FILTERED]"
    assert result["request"]["headers"]["Accept"] == "*/*"


def test_strips_set_cookie_header():
    event = {"request": {"headers": {"Set-Cookie": "token=xyz; HttpOnly"}}}
    result = _before_send(event, {})
    assert result["request"]["headers"]["Set-Cookie"] == "[FILTERED]"


def test_strips_pii_keys_case_insensitive():
    event = {
        "request": {"headers": {}},
        "extra": {
            "Phone": "13800138000",
            "EMAIL": "user@example.com",
            "resume": "base64content...",
            "other": "safe",
        },
    }
    result = _before_send(event, {})
    assert result["extra"]["Phone"] == "[FILTERED]"
    assert result["extra"]["EMAIL"] == "[FILTERED]"
    assert result["extra"]["resume"] == "[FILTERED]"
    assert result["extra"]["other"] == "safe"


def test_clears_request_data():
    event = {"request": {"headers": {}, "data": {"password": "secret123", "username": "user"}}}
    result = _before_send(event, {})
    assert result["request"]["data"] is None


def test_clears_request_data_when_absent():
    event = {"request": {"headers": {}}}  # no "data" key
    result = _before_send(event, {})
    assert result["request"].get("data") is None


def test_always_returns_event_not_none():
    event = {"request": {"headers": {"X-Custom": "value"}}, "extra": {}}
    result = _before_send(event, {})
    assert result is not None


def test_handles_missing_request_keys_gracefully():
    event = {}  # no "request", no "extra"
    result = _before_send(event, {})
    assert result is not None


def test_strips_chinese_pii_keys_in_extra():
    event = {
        "request": {"headers": {}},
        "extra": {"手机号": "13800138000", "邮箱": "u@e.com", "身份证": "11010519491231002X"},
    }
    result = _before_send(event, {})
    assert result["extra"]["手机号"] == "[FILTERED]"
    assert result["extra"]["邮箱"] == "[FILTERED]"
    assert result["extra"]["身份证"] == "[FILTERED]"


def test_strips_nested_pii_in_extra():
    event = {
        "request": {"headers": {}},
        "extra": {
            "user": {"email": "x@y.com", "name": "Alice"},
            "safe_top": "value",
        },
    }
    result = _before_send(event, {})
    assert result["extra"]["user"]["email"] == "[FILTERED]"
    assert result["extra"]["user"]["name"] == "Alice"
    assert result["extra"]["safe_top"] == "value"
