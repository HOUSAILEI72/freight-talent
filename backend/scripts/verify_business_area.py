"""
backend/scripts/verify_business_area.py

Stand-alone test harness for `backend/app/utils/business_area.py`. Runs the
same 16 fixture cases as the front-end verifier so the two halves of the
system stay in lock-step.

Usage:  ../.venv/bin/python backend/scripts/verify_business_area.py
"""

from __future__ import annotations

import os
import sys

# Allow `python backend/scripts/verify_business_area.py` from repo root.
_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.normpath(os.path.join(_HERE, ".."))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from app.utils.business_area import (  # noqa: E402
    get_business_area_by_location_code,
    is_mainland_china_code,
    is_allowed_special_location_code,
    is_known_overseas_country_code,
    get_province_code,
    is_valid_location_code,
    validate_location_payload,
)


CASES: list[tuple[str, str | None, str]] = [
    ("GLOBAL",          "GLOBAL",         "1.  GLOBAL"),
    ("REMOTE",          "REMOTE",         "2.  REMOTE"),
    ("CN_MAINLAND_ALL", "GREAT_CHINA",    "3.  CN_MAINLAND_ALL → GREAT_CHINA"),
    ("310000",          "EAST_CHINA",     "4.  310000 上海市 → EAST_CHINA"),
    ("310115",          "EAST_CHINA",     "5.  310115 浦东新区 → EAST_CHINA"),
    ("440300",          "SOUTH_CHINA",    "6.  440300 深圳市 → SOUTH_CHINA"),
    ("110000",          "NORTH_CHINA",    "7.  110000 北京市 → NORTH_CHINA"),
    ("510100",          "WEST_CHINA",     "8.  510100 成都市 → WEST_CHINA"),
    ("410100",          "CENTRAL_CHINA",  "9.  410100 郑州市 → CENTRAL_CHINA"),
    ("HK",              "HONG_KONG",      "10. HK → HONG_KONG"),
    ("TW",              "TAIWAN",         "11. TW → TAIWAN"),
    ("DE",              "OVERSEAS",       "12. DE → OVERSEAS"),
    ("710000",          None,             "13. 710000 (台湾省) invalid"),
    ("810000",          None,             "14. 810000 (香港) invalid"),
    ("820000",          None,             "15. 820000 (澳门) invalid"),
    ("999999",          None,             "16. 999999 invalid"),
]


def main() -> int:
    pass_count = 0
    fail_count = 0

    for input_code, expected, label in CASES:
        got = get_business_area_by_location_code(input_code)
        got_code = got["code"] if got else None
        ok = got_code == expected
        status = "PASS" if ok else "FAIL"
        print(f"  {status}  {label:<50}  expected={expected}  got={got_code}")
        if ok:
            pass_count += 1
        else:
            fail_count += 1

    granular: list[tuple[str, object, object]] = [
        ('is_mainland_china_code("310115")',         is_mainland_china_code("310115"),         True),
        ('is_mainland_china_code("710000")',         is_mainland_china_code("710000"),         False),
        ('is_mainland_china_code("810000")',         is_mainland_china_code("810000"),         False),
        ('is_allowed_special_location_code("HK")',   is_allowed_special_location_code("HK"),   True),
        ('is_allowed_special_location_code("MO")',   is_allowed_special_location_code("MO"),   False),
        ('is_known_overseas_country_code("DE")',     is_known_overseas_country_code("DE"),     True),
        ('is_known_overseas_country_code("XX")',     is_known_overseas_country_code("XX"),     False),
        ('get_province_code("440305")',              get_province_code("440305"),              "440000"),
        ('get_province_code("HK")',                  get_province_code("HK"),                  None),
        ('is_valid_location_code("310115")',         is_valid_location_code("310115"),         True),
        ('is_valid_location_code("999999")',         is_valid_location_code("999999"),         False),
    ]

    print("\n  -- granular helpers --")
    for label, got, expected in granular:
        ok = got == expected
        status = "PASS" if ok else "FAIL"
        print(f"  {status}  {label:<50}  expected={expected!r}  got={got!r}")
        if ok:
            pass_count += 1
        else:
            fail_count += 1

    # validate_location_payload smoke test
    print("\n  -- validate_location_payload --")
    payload_ok = {
        "location_code": "440305",
        "location_name": "南山区",
        "location_path": "Great China/广东省/深圳市/南山区",
        "location_type": "mainland_china",
        "business_area_code": "MUST_BE_OVERWRITTEN",  # client lie
        "business_area_name": "MUST_BE_OVERWRITTEN",
    }
    out, err = validate_location_payload(payload_ok)
    case_ok = (
        err is None
        and out
        and out["business_area_code"] == "SOUTH_CHINA"
        and out["business_area_name"] == "South China"
    )
    print(f"  {'PASS' if case_ok else 'FAIL'}  validate_location_payload — happy path + client value discarded   got={out}  err={err}")
    if case_ok:
        pass_count += 1
    else:
        fail_count += 1

    payload_bad = {
        "location_code": "999999",
        "location_name": "x",
        "location_path": "x",
        "location_type": "x",
    }
    out, err = validate_location_payload(payload_bad)
    case_bad = out is None and err and "999999" in err
    print(f"  {'PASS' if case_bad else 'FAIL'}  validate_location_payload — rejects 999999    err={err!r}")
    if case_bad:
        pass_count += 1
    else:
        fail_count += 1

    print(f"\n  TOTAL: {pass_count} pass, {fail_count} fail")
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
