"""CAND-5 — Employer-side privacy unlock rule.

Single source of truth used by `list_candidates` and `get_candidate_public`.
An employer may see a candidate's private fields when EITHER:

  • there is an Invitation(employer_id, candidate_id, status='accepted'), OR
  • there is a JobApplication(employer_id, candidate_id, status IN
    {submitted, viewed, shortlisted}).

`withdrawn` and `rejected` applications do NOT unlock — both treat the
relationship as no longer active.

`admin` and the candidate themselves are handled by the caller, not by this
helper. `contact_visible` is no longer consulted on the employer-facing
path; it remains in the model for forward-compat but does not gate
visibility.
"""

from typing import Iterable, Optional, Set

from app.extensions import db
from app.models.invitation import Invitation
from app.models.job_application import JobApplication


# Application statuses that DO unlock the candidate for the employer.
# Source-of-truth list: spec says submitted / viewed / shortlisted.
_ACTIVE_APPLICATION_STATUSES = ("submitted", "viewed", "shortlisted")


def employer_can_view_private_profile(employer_id: int, candidate_id: int) -> bool:
    """Single-candidate check; uses two short-circuited point queries."""
    if not employer_id or not candidate_id:
        return False

    has_accepted_invite = db.session.query(Invitation.id).filter_by(
        employer_id=employer_id,
        candidate_id=candidate_id,
        status="accepted",
    ).limit(1).first() is not None
    if has_accepted_invite:
        return True

    has_active_application = (
        db.session.query(JobApplication.id)
        .filter(
            JobApplication.employer_id == employer_id,
            JobApplication.candidate_id == candidate_id,
            JobApplication.status.in_(_ACTIVE_APPLICATION_STATUSES),
        )
        .limit(1)
        .first()
        is not None
    )
    return has_active_application


def employer_unlocked_candidate_ids(
    employer_id: int,
    candidate_ids: Optional[Iterable[int]] = None,
) -> Set[int]:
    """Batched variant for list endpoints.

    Returns the subset of `candidate_ids` for which the given employer has
    either an accepted invitation OR an active application. If
    `candidate_ids` is None, returns *all* unlocked ids for that employer
    (rarely useful — list_candidates already has its filtered ids).

    Two queries (one per relation) instead of N+1 per row.
    """
    if not employer_id:
        return set()

    cand_ids_list = list(candidate_ids) if candidate_ids is not None else None
    if cand_ids_list is not None and len(cand_ids_list) == 0:
        return set()

    inv_q = db.session.query(Invitation.candidate_id).filter(
        Invitation.employer_id == employer_id,
        Invitation.status == "accepted",
    )
    app_q = db.session.query(JobApplication.candidate_id).filter(
        JobApplication.employer_id == employer_id,
        JobApplication.status.in_(_ACTIVE_APPLICATION_STATUSES),
    )
    if cand_ids_list is not None:
        inv_q = inv_q.filter(Invitation.candidate_id.in_(cand_ids_list))
        app_q = app_q.filter(JobApplication.candidate_id.in_(cand_ids_list))

    unlocked = {r.candidate_id for r in inv_q.all()}
    unlocked.update(r.candidate_id for r in app_q.all())
    return unlocked
