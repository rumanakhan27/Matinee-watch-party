import os

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv()   # on your computer this reads .env; on Render it does nothing harmful

raw_url = os.getenv("DATABASE_URL")
if not raw_url:
    raise RuntimeError("DATABASE_URL is not set. Add it to .env (local) or Render's Environment page.")

# Neon gives us:  postgresql://user:pass@host/db?sslmode=require
# The async driver needs:  postgresql+asyncpg://user:pass@host/db   (and SSL passed separately)
url = raw_url.replace("postgres://", "postgresql://", 1)
url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
url = url.split("?")[0]   # remove "?sslmode=require", we set SSL below instead

engine = create_async_engine(
    url,
    connect_args={"ssl": "require", "statement_cache_size": 0},
    pool_pre_ping=True,    # test a connection before using it (Neon pauses idle databases)
    pool_recycle=300,      # replace connections older than 5 minutes
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    """Every table class inherits from this."""
    pass


async def get_db():
    """Gives one request its own session, and closes it afterwards."""
    async with SessionLocal() as session:
        yield session


async def init_db():
    """Creates any tables that don't exist yet."""
    import models   # noqa: F401  (importing registers the tables with Base)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)