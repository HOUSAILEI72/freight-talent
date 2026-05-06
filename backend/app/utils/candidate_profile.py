"""Server-side mirror of the CAND-1 / CAND-2A profile-completeness rule.

This rule is the single source of truth that decides whether a candidate
may apply to jobs (CAND-4) and subscribe to tag feeds (CAND-1 gate). The
14 individual checks are intentionally identical to the front-end's
`src/utils/candidateProfile.js` so the two never disagree.
"""

from typing import Iterable, Optional


def _is_nonempty_str(v) -> bool:
    return isinstance(v, str) and v.strip() != ""


def _is_nonempty_list(v) -> bool:
    return isinstance(v, list) and len(v) > 0


def get_missing_profile_fields(profile) -> list[str]:
    """Return the list of missing field keys, or [] when complete.

    `profile` is a `Candidate` ORM instance (or None). The returned keys
    match the front-end labels so callers can surface a granular checklist.
    """
    if profile is None:
        return ["profile"]

    missing: list[str] = []

    # 6 string fields
    for k in (
        "full_name", "phone", "email",
        "current_company", "current_title", "current_responsibilities",
    ):
        if not _is_nonempty_str(getattr(profile, k, None)):
            missing.append(k)

    # 4 location fields
    for k in ("location_code", "location_name", "location_path", "location_type"):
        if not _is_nonempty_str(getattr(profile, k, None)):
            missing.append(k)

    # 3 capability arrays
    for k in ("knowledge_tags", "hard_skill_tags", "soft_skill_tags"):
        if not _is_nonempty_list(getattr(profile, k, None)):
            missing.append(k)

    # at least one work experience
    if not _is_nonempty_list(getattr(profile, "work_experiences", None)):
        missing.append("work_experiences")

    return missing


def is_candidate_profile_complete(profile) -> bool:
    """True iff the profile passes the 14-rule check."""
    return len(get_missing_profile_fields(profile)) == 0
