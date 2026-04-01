import re
from pydantic import BaseModel, EmailStr, field_validator

_E164_RE = re.compile(r"^\+[1-9]\d{6,14}$")


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OTPRequest(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not _E164_RE.match(v):
            raise ValueError("phone must be E.164 format, e.g. +919876543210")
        return v


class OTPVerifyRequest(BaseModel):
    phone: str
    token: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not _E164_RE.match(v):
            raise ValueError("phone must be E.164 format, e.g. +919876543210")
        return v


class RefreshRequest(BaseModel):
    refresh_token: str


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict
