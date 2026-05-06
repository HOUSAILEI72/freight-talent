"""
FastAPI JWT 验证 — 解码与 Flask-JWT-Extended 颁发的同一格式 token。

Flask-JWT-Extended 使用 PyJWT HS256，payload 结构：
  {"sub": "<user_id_str>", "jti": "<uuid>", "type": "access", "iat", "nbf", "exp"}
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt as pyjwt

from .config import get_settings
from .redis import get_redis_client

bearer_scheme = HTTPBearer(auto_error=False)


class TokenData:
    def __init__(self, user_id: int, jti: str, token_type: str):
        self.user_id = user_id
        self.jti = jti
        self.token_type = token_type


def _is_blocklisted(jti: str) -> bool:
    """检查 jti 是否在 Redis JWT blocklist 中（与 Flask 侧共用同一个 blocklist key 空间）。"""
    try:
        r = get_redis_client()
        if r:
            return bool(r.exists(f"jwt_bl:{jti}"))
    except Exception:
        pass
    return False


def decode_jwt(token: str) -> Optional[TokenData]:
    settings = get_settings()
    try:
        payload = pyjwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = int(payload["sub"])
        jti = payload.get("jti", "")
        token_type = payload.get("type", "access")
        return TokenData(user_id=user_id, jti=jti, token_type=token_type)
    except pyjwt.ExpiredSignatureError:
        return None
    except pyjwt.InvalidTokenError:
        return None


def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> int:
    """
    FastAPI 依赖：从 Bearer token 提取并验证用户 ID。
    与 Flask 侧共享 JWT secret 和 Redis blocklist。
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少认证 token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_data = decode_jwt(credentials.credentials)
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 无效或已过期",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if token_data.token_type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请使用 access token",
        )

    if _is_blocklisted(token_data.jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 已失效，请重新登录",
        )

    return token_data.user_id
