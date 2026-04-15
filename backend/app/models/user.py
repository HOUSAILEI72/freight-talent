from datetime import datetime, timezone
from app.extensions import db, bcrypt


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)
    # role: employer | candidate | admin
    role = db.Column(db.String(20), nullable=False, default="candidate")
    name = db.Column(db.String(60), nullable=False)
    company_name = db.Column(db.String(100), nullable=True)  # employer only
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_login = db.Column(db.DateTime, nullable=True)

    def set_password(self, password: str):
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, password)

    @staticmethod
    def _iso(dt):
        """返回 UTC ISO 8601 带 Z 后缀的字符串，或 None。"""
        if dt is None:
            return None
        # 如果是 naive datetime，直接加 Z（数据库存的是 UTC）
        return dt.strftime("%Y-%m-%dT%H:%M:%S") + "Z"

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "role": self.role,
            "name": self.name,
            "company_name": self.company_name,
            "created_at": self._iso(self.created_at),
        }