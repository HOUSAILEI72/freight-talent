from datetime import datetime, timezone
from app.extensions import db


class HeadhuntingRequest(db.Model):
    __tablename__ = "headhunting_requests"

    id          = db.Column(db.Integer, primary_key=True)
    employer_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    service_type = db.Column(db.String(32), nullable=False, default="personal")
    status      = db.Column(db.String(32), nullable=False, default="submitted")

    __table_args__ = (
        db.Index('ix_headhunting_employer_id', 'employer_id'),
        db.Index('ix_headhunting_status',      'status'),
    )

    job_payload     = db.Column(db.JSON, nullable=True)
    terms_payload   = db.Column(db.JSON, nullable=True)
    add_ons_payload = db.Column(db.JSON, nullable=True)
    fee_snapshot    = db.Column(db.JSON, nullable=True)

    contact_name   = db.Column(db.String(128), nullable=False)
    contact_phone  = db.Column(db.String(64),  nullable=False)
    contact_email  = db.Column(db.String(256), nullable=False)
    contact_wechat = db.Column(db.String(128), nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id":              self.id,
            "service_type":    self.service_type,
            "status":          self.status,
            "job_payload":     self.job_payload,
            "terms_payload":   self.terms_payload,
            "add_ons_payload": self.add_ons_payload,
            "fee_snapshot":    self.fee_snapshot,
            "contact_name":    self.contact_name,
            "contact_phone":   self.contact_phone,
            "contact_email":   self.contact_email,
            "contact_wechat":  self.contact_wechat,
            "created_at":      self.created_at.isoformat() if self.created_at else None,
        }
