"""
auth.py
-------
Everything related to security lives here:
  1. Turning a plain password into a scrambled hash (and checking it later)
  2. Creating a "login token" (JWT) after successful login
  3. Reading that token back to know WHO is logged in

You will explain this file in your interview as: "I used bcrypt password
hashing and JWT (JSON Web Token) based stateless authentication, stored
in an httpOnly cookie to protect against XSS token theft."
"""

from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta

# ---------------------------------------------------------------
# IMPORTANT: Change this SECRET_KEY before putting this online.
# Anyone with this key could forge login tokens.
# A good practice is to load it from an environment variable instead
# of writing it directly in code. We'll do that in Part 5.
# ---------------------------------------------------------------
SECRET_KEY = "pcos-gynocare-CHANGE-THIS-SECRET-KEY"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # token valid for 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Scramble a plain password before saving it to the database."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a plain password typed at login against the saved hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    """Create a signed token that proves who the user is."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str):
    """Read a token and return its data, or None if invalid/expired."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
