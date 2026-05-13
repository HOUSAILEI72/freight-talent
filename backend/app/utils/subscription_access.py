"""subscription_access.py — single source of truth for employer subscription checks.

Replaces the old invitation/application-based privacy unlock.
All routes that need to gate on subscription should import from here.
"""

from __future__ import annotations

from typing import Iterable, Optional, Set

from app.extensions import db
from app.models.subscription import Subscription, CHINA_AREA_CODES, CHINA_SCOPE_KEYS


def _get_active_subscription(employer_id: int) -> Optional[Subscription]:
    """Return the most-recent active subscription for the given employer, or None."""
    if not employer_id:
        return None
    # Prefer active > most recently created
    sub = (
        Subscription.query
        .filter_by(employer_id=employer_id, status="active")
        .order_by(Subscription.created_at.desc())
        .first()
    )
    if sub and sub.is_active():
        return sub
    return None


def employer_has_active_subscription(employer_id: int) -> bool:
    return _get_active_subscription(employer_id) is not None


def employer_can_view_private_profile(employer_id: int, candidate_id: int) -> bool:
    """Gate: can employer see private fields of a specific candidate?

    Requires an active subscription whose scope covers both the candidate's
    function_code AND business_area_code.
    """
    if not employer_id or not candidate_id:
        return False
    sub = _get_active_subscription(employer_id)
    if sub is None:
        return False
    from app.models.candidate import Candidate
    c = db.session.get(Candidate, candidate_id)
    if c is None:
        return False
    return sub.covers_candidate(c.function_code, c.business_area_code)


def employer_unlocked_candidate_ids(
    employer_id: int,
    candidate_ids: Optional[Iterable[int]] = None,
) -> Set[int]:
    """Batched variant: return the subset of candidate_ids the employer can fully see.

    If candidate_ids is None, returns ALL candidates the subscription covers
    (rarely used — list endpoints already pre-filter).
    """
    if not employer_id:
        return set()
    sub = _get_active_subscription(employer_id)
    if sub is None:
        return set()

    from app.models.candidate import Candidate

    q = Candidate.query
    if candidate_ids is not None:
        id_list = list(candidate_ids)
        if not id_list:
            return set()
        q = q.filter(Candidate.id.in_(id_list))

    func_codes = sub.function_codes or []
    area_codes  = sub.business_area_codes or []

    # Pre-compute: does the subscription have China scope expansion?
    sub_has_china_scope = any(c in CHINA_SCOPE_KEYS for c in area_codes)

    unlocked: Set[int] = set()
    for c in q.all():
        fc = c.function_code
        ac = c.business_area_code
        func_ok = ("ALL" in func_codes) or (fc and fc in func_codes)
        area_ok = (
            ("ALL" in area_codes)
            or (ac and ac in area_codes)
            or (sub_has_china_scope and ac and ac in CHINA_AREA_CODES)
        )
        if func_ok and area_ok:
            unlocked.add(c.id)
    return unlocked


def subscription_gate(employer_id: int):
    """Return (subscription_or_None, error_response_or_None).

    Usage::
        sub, err = subscription_gate(user.id)
        if err:
            return err
    """
    from flask import jsonify
    sub = _get_active_subscription(employer_id)
    if sub is None:
        return None, (
            jsonify({
                "success": False,
                "message": "需要有效订阅才能使用此功能",
                "error_code": "subscription_required",
                "pricing_url": "/employer/pricing",
            }),
            402,
        )
    return sub, None
