from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.legacy import User, UserNotification, hash_password, verify_password
from app.core.security import (
    ACCESS_TOKEN_COOKIE,
    create_access_token,
    ensure_auth_configured,
    get_current_user,
    set_access_token_cookie,
)
from app.core.config import settings
from app.database.session import get_db
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    UserResponse,
)

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

    if body.role != "patient":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Public registration is available only for patients.",
        )

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
    set_access_token_cookie(response, create_access_token(user.email, user.token_version))
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

    if user.role == "doctor" and user.approval_status != "approved":
        if user.approval_status == "rejected":
            decision_message = "Your doctor application was rejected."
            if user.rejection_reason:
                decision_message = f"{decision_message} Reason: {user.rejection_reason}"
        else:
            decision_message = "Your doctor application is pending Admin approval."
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=decision_message,
        )
    if not user.is_active or getattr(user, "is_removed", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is inactive. Contact an administrator.",
        )

    set_access_token_cookie(response, create_access_token(user.email, user.token_version))
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(
        key=ACCESS_TOKEN_COOKIE,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        path="/",
    )


@router.get("/me", response_model=UserResponse)
def current_user(user: User = Depends(get_current_user)) -> User:
    return user


@router.put("/profile", response_model=UserResponse)
def update_profile(
    body: ProfileUpdateRequest,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    user.token_version = getattr(user, "token_version", 0) + 1
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That phone number is already in use.",
        ) from exc
    db.refresh(user)
    set_access_token_cookie(response, create_access_token(user.email, user.token_version))
    return user


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: ChangePasswordRequest,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    user.hashed_password = hash_password(body.new_password)
    user.token_version = getattr(user, "token_version", 0) + 1
    db.commit()
    response.delete_cookie(
        key=ACCESS_TOKEN_COOKIE,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        path="/",
    )


@router.get("/notifications")
def list_notifications(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    records = (
        db.query(UserNotification)
        .filter(UserNotification.user_id == user.id)
        .order_by(UserNotification.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": item.id,
            "category": item.category,
            "message": item.message,
            "created_at": item.created_at.isoformat(),
            "read_at": item.read_at.isoformat() if item.read_at else None,
        }
        for item in records
    ]


@router.post("/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_notification_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    notification = (
        db.query(UserNotification)
        .filter(UserNotification.id == notification_id, UserNotification.user_id == user.id)
        .first()
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found.")
    if notification.read_at is None:
        notification.read_at = datetime.utcnow()
        db.commit()
