from typing import Optional
from pydantic import BaseModel


class AvatarUploadResponse(BaseModel):
    success: bool
    avatar_url: str


class UserProfileResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    company_name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: Optional[str] = None
