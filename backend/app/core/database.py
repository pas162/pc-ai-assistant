from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    echo=True
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
def get_db_direct():
    return SessionLocal()


def init_db():
    # WHY only create_all here?
    # Alembic owns all schema changes (CREATE TABLE, ALTER TABLE).
    # create_all is kept only as a safety net for local dev from scratch.
    # It will NOT override existing tables — safe to keep.
    Base.metadata.create_all(bind=engine)
