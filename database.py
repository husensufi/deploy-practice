"""
database.py
-----------
This file sets up the connection to our database.

We are using SQLite for now (a single file database called
pcos_gynocare.db that gets created automatically the first time
you run the app). SQLite needs ZERO installation — perfect for
development and for demoing in your interview.

Later, when you move to real users, you only change ONE line
(DATABASE_URL) to point to PostgreSQL/MySQL. Nothing else in the
project needs to change. That is the whole point of using SQLAlchemy.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# ---- Connection string ----
# sqlite:///./pcos_gynocare.db  ->  create/use a file named
# pcos_gynocare.db in the same folder as this script.
DATABASE_URL = "sqlite:///./pcos_gynocare.db"

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
