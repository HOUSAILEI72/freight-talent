from pydantic import BaseModel, field_validator


class TagApprovalUpdate(BaseModel):
    enabled: bool
