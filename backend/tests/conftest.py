"""
conftest.py — 测试通用夹具

使用 SQLite in-memory 数据库，不依赖 MySQL。
JWT_SECRET_KEY 通过环境变量注入测试值。
"""
import os
import pytest

# 测试时不需要 Redis / 真实 DB
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-pytest-only-32chars!!")
os.environ.setdefault("FLASK_ENV", "development")


class _TestConfig:
    """测试配置：使用真实 MySQL 数据库（test schema）。"""
    TESTING = True
    DEBUG = False
    # Use real MySQL with a test database
    SQLALCHEMY_DATABASE_URI = "mysql+pymysql://root:Zyk0416,@127.0.0.1/freight_talent_test?charset=utf8mb4"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = "test-secret-key-for-pytest-only-32chars!!"
    JWT_ACCESS_TOKEN_EXPIRES = False    # 测试中 token 不过期
    JWT_REFRESH_TOKEN_EXPIRES = False
    CORS_ORIGINS = ["http://localhost"]
    RATELIMIT_STORAGE_URI = "memory://"
    RATELIMIT_ENABLED = False
    SERVE_STATIC = False
    WTF_CSRF_ENABLED = False


@pytest.fixture(scope="session")
def app():
    from app import create_app
    from sqlalchemy import create_engine, text

    # Create test database if not exists
    engine = create_engine("mysql+pymysql://root:Zyk0416,@127.0.0.1/?charset=utf8mb4")
    with engine.connect() as conn:
        conn.execute(text("CREATE DATABASE IF NOT EXISTS freight_talent_test"))
        conn.commit()
    engine.dispose()

    application = create_app(_TestConfig)
    with application.app_context():
        from app.extensions import db
        # Import all models to ensure db.create_all() sees them
        from app.models.user import User
        from app.models.candidate import Candidate
        from app.models.job import Job
        from app.models.invitation import Invitation
        from app.models.conversation import ConversationThread, Message
        from app.models.match_result import MatchResult
        from app.models.job_application import JobApplication
        from app.models.import_models import FieldRegistry, ImportBatch, ImportBatchRow, ImportBatchTag
        from app.models.tag import Tag, TagNote
        from app.models.junction_tags import CandidateTag, JobTag

        # Drop all tables and recreate for clean test environment
        db.drop_all()
        db.create_all()
        yield application
        # Cleanup after all tests
        db.drop_all()


@pytest.fixture(scope="session")
def client(app):
    return app.test_client()


@pytest.fixture(scope="session")
def admin_token(app, client):
    """创建一个 admin 用户并返回其 access token。"""
    from app.extensions import db
    from app.models.user import User
    with app.app_context():
        user = User(email="admin_test@example.com", role="admin",
                    name="Test Admin", is_active=True)
        user.set_password("AdminPass123!")
        db.session.add(user)
        db.session.commit()

    resp = client.post("/api/auth/login", json={
        "email": "admin_test@example.com",
        "password": "AdminPass123!",
    })
    assert resp.status_code == 200, f"登录失败: {resp.get_json()}"
    return resp.get_json()["access_token"]


@pytest.fixture(scope="function")
def db_session(app):
    """Per-test database session with automatic cleanup."""
    with app.app_context():
        from app.extensions import db
        yield db.session
        # Rollback any uncommitted changes and clear all tables
        db.session.rollback()
        # Clean all tables for next test
        for table in reversed(db.metadata.sorted_tables):
            db.session.execute(table.delete())
        db.session.commit()
