from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.legacy import User, hash_password, verify_password
from app.core.security import (
    ACCESS_TOKEN_COOKIE,
    create_access_token,
    ensure_auth_configured,
    get_current_user,
    set_access_token_cookie,
)
from app.core.config import settings
from app.database.session import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    body: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> User:
    ensure_auth_configured()

    existing_email = db.query(User.id).filter(User.email == body.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        full_name=body.full_name,
        email=body.email,
        mobile=body.mobile,
        hashed_password=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with these details already exists.",
        ) from exc

    db.refresh(user)
    set_access_token_cookie(response, create_access_token(user.email))
    return user


@router.post("/login", response_model=UserResponse)
def login(
    body: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> User:
    ensure_auth_configured()

    user = db.query(User).filter(User.email == body.email).first()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    set_access_token_cookie(response, create_access_token(user.email))
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> Response:
    response.delete_cookie(
        key=ACCESS_TOKEN_COOKIE,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        path="/",
    )
    return response


@router.get("/me", response_model=UserResponse)
def current_user(user: User = Depends(get_current_user)) -> User:
    return user
