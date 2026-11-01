from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.models import User

ACCESS_TOKEN_COOKIE = "access_token"
ACCESS_TOKEN_LIFETIME = timedelta(days=7)


def ensure_auth_configured() -> None:
    if not settings.secret_key or len(settings.secret_key) < 32:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Authentication is not configured. Set a SECRET_KEY of at least "
                "32 characters on the backend."
            ),
        )


def create_access_token(email: str) -> str:
    ensure_auth_configured()

    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": email,
            "iat": now,
            "exp": now + ACCESS_TOKEN_LIFETIME,
        },
        settings.secret_key,
        algorithm="HS256",
    )


def decode_access_token(token: str) -> dict | None:
    if not settings.secret_key or len(settings.secret_key) < 32:
        return None
    try:
        return jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except JWTError:
        return None


def set_access_token_cookie(response, token: str) -> None:
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=int(ACCESS_TOKEN_LIFETIME.total_seconds()),
        path="/",
    )


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    payload = decode_access_token(token) if token else None
    email = payload.get("sub") if payload else None
    if not isinstance(email, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_doctor(user: User = Depends(get_current_user)) -> User:
    if user.role != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor access is required.",
        )
    return user


def require_patient(user: User = Depends(get_current_user)) -> User:
    if user.role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patient access is required.",
        )
    return user
