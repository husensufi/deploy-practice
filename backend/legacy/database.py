"""
database.py
-----------
This module connects the retained application to the canonical project
SQLite database, regardless of the process working directory.
"""

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker, declarative_base

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATABASE_PATH = PROJECT_ROOT / "pcos_gynocare.db"
DATABASE_URL = URL.create("sqlite", database=str(DATABASE_PATH))

# check_same_thread=False is required only for SQLite, because
# FastAPI can talk to the DB from different threads.
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

# SessionLocal is a factory that creates a new database "conversation"
# every time we need to read/write something.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base is the parent class every table (model) in models.py will inherit from.
Base = declarative_base()


def get_db():
    """
    This is a FastAPI 'dependency'. Every route that needs the database
    will ask for this function, and FastAPI will automatically:
      1. open a database session
      2. give it to the route
      3. close it safely afterwards, even if there was an error
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
