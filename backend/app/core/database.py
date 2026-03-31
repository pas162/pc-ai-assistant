from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import get_settings

# Get our settings (reads from .env)
settings = get_settings()

# Create the database engine
engine = create_engine(
    settings.database_url,
    echo=True  # logs all SQL queries (useful for learning/debugging)
)

# SessionLocal is a factory that creates database sessions
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


# Base class for all our models
class Base(DeclarativeBase):
    pass


def get_db():
    """
    Creates a database session for each request.
    Automatically closes it when the request is done.
    """
    db = SessionLocal()
    try:
        yield db        # give the session to the route handler
    finally:
        db.close()      # always close, even if an error occurs