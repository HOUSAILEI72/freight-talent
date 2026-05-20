"""Employer subscription model.

Phase-8 MVP: one subscription row per employer, status-based.
`function_codes` and `business_area_codes` are JSON arrays of strings.
Empty array means "no access". A special sentinel value ["ALL"] means
"all codes in this dimension".
"""

from datetime import datetime, timezone
from app.extensions import db

# When a subscription includes GREAT_CHINA or CHINA, it expands to cover all these sub-areas.
CHINA_SCOPE_KEYS = frozenset({"GREAT_CHINA", "CHINA"})
CHINA_AREA_CODES = frozenset({
    "GREAT_CHINA", "CHINA",
    "EAST_CHINA", "NORTH_CHINA", "SOUTH_CHINA", "WEST_CHINA", "CENTRAL_CHINA",
    "HONG_KONG", "TAIWAN", "MACAU",
})


class Subscription(db.Model):
    __tablename__ = "subscriptions"

    id = db.Column(db.Integer, primary_key=True)
    employer_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    __table_args__ = (
        db.Index('ix_subscription_employer_id', 'employer_id'),
        db.Index('ix_subscription_employer_status', 'employer_id', 'status'),
    )

    # --- billing / lifecycle ---
    status = db.Column(
        db.Enum("active", "expired", "cancelled", "pending", name="subscription_status"),
        nullable=False,
        default="pending",
    )
    plan_type = db.Column(db.String(30), nullable=False, default="standard")
    # tier: basic | pro | enterprise
    tier = db.Column(db.String(30), nullable=False, default="basic")

    # --- scope ---
    # JSON arrays of codes (strings).  ["ALL"] = unrestricted in that dimension.
    function_codes = db.Column(db.JSON, nullable=False, default=list)
    business_area_codes = db.Column(db.JSON, nullable=False, default=list)

    starts_at = db.Column(db.DateTime(timezone=True), nullable=True)
    ends_at = db.Column(db.DateTime(timezone=True), nullable=True)

    # --- quota tracking ---
    resume_views_used = db.Column(db.Integer, nullable=False, default=0)

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    RESUME_VIEW_LIMIT = 50
    CONTACT_LIMIT = 30

    def quota_dict(self, contacts_initiated: int) -> dict:
        return {
            "resume_views": {"used": self.resume_views_used, "limit": self.RESUME_VIEW_LIMIT},
            "contacts": {"used": contacts_initiated, "limit": self.CONTACT_LIMIT},
        }

    def is_active(self) -> bool:
        if self.status != "active":
            return False
        now = datetime.now(timezone.utc)
        if self.starts_at:
            starts = self.starts_at if self.starts_at.tzinfo else self.starts_at.replace(tzinfo=timezone.utc)
            if starts > now:
                return False
        if self.ends_at:
            ends = self.ends_at if self.ends_at.tzinfo else self.ends_at.replace(tzinfo=timezone.utc)
            if ends < now:
                return False
        return True

    def covers_function(self, function_code: str | None) -> bool:
        """True if this subscription covers the given function_code."""
        if not self.is_active():
            return False
        codes = self.function_codes or []
        if "ALL" in codes:
            return True
        if not function_code:
            # candidate has no function_code → treat as covered only if ALL
            return False
        return function_code in codes

    def covers_area(self, business_area_code: str | None) -> bool:
        """True if this subscription covers the given business_area_code.

        "GREAT_CHINA" or "CHINA" in the subscription's area codes expands to
        cover all China sub-areas (EAST_CHINA, NORTH_CHINA, etc.).
        """
        if not self.is_active():
            return False
        codes = self.business_area_codes or []
        if "ALL" in codes:
            return True
        if not business_area_code:
            return False
        if business_area_code in codes:
            return True
        # China scope expansion: if sub has GREAT_CHINA or CHINA, it covers all China sub-areas
        if business_area_code in CHINA_AREA_CODES:
            if any(c in CHINA_SCOPE_KEYS for c in codes):
                return True
        return False

    def covers_candidate(self, function_code: str | None, business_area_code: str | None) -> bool:
        """Both dimensions must be covered (AND logic)."""
        return self.covers_function(function_code) and self.covers_area(business_area_code)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "employer_id": self.employer_id,
            "status": self.status,
            "is_active": self.is_active(),
            # plan_type / tier are legacy column names; plan_id / billing_cycle are the canonical keys
            "plan_id": self.tier,
            "billing_cycle": self.plan_type,
            "plan_type": self.plan_type,   # keep for backward compatibility
            "tier": self.tier,         # keep for backward compatibility
            "function_codes": self.function_codes,
            "business_area_codes": self.business_area_codes,
            "resume_views_used": self.resume_views_used,
            "starts_at": self.starts_at.isoformat() if self.starts_at else None,
            "ends_at": self.ends_at.isoformat() if self.ends_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
