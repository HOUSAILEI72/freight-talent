"""candidate_privacy.py — Employer-side privacy access rule.

Single source of truth used by `list_candidates` and `get_candidate_public`.

An employer may see a candidate's private fields when they have an
**active subscription** whose scope covers the candidate's
function_code AND business_area_code.

The old invitation/application-based unlock has been removed (Phase 8).
`admin` and the candidate themselves are handled by the caller, not here.
`contact_visible` is no longer consulted on the employer-facing path.
"""

from typing import Iterable, Optional, Set

# Re-export from subscription_access so existing callers keep working
# without changing their import paths.
from app.utils.subscription_access import (
    employer_can_view_private_profile,
    employer_unlocked_candidate_ids,
)

__all__ = [
    "employer_can_view_private_profile",
    "employer_unlocked_candidate_ids",
]
