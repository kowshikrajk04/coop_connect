import os
import time
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables from backend/.env
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./coopconnect.db")

# Clean and normalize connection URL
if DATABASE_URL:
    DATABASE_URL = DATABASE_URL.strip("\"'")
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Configure engine arguments based on dialect
engine_kwargs = {"echo": False}

import socket
from urllib.parse import urlparse

if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL / Neon pooling settings
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["connect_args"] = {"connect_timeout": 30}

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """FastAPI dependency providing a transactional database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_db_connection() -> dict:
    """Verify live database connectivity and return diagnostic status."""
    t0 = time.time()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            version_row = conn.execute(text("SELECT version()")).scalar()
            latency_ms = round((time.time() - t0) * 1000, 1)
            dialect = engine.dialect.name
            target_host = DATABASE_URL.split("@")[-1].split("/")[0] if "@" in DATABASE_URL else "local"
            return {
                "connected": True,
                "dialect": dialect,
                "version": version_row.split(",")[0] if version_row else "Unknown",
                "latency_ms": latency_ms,
                "target_host": target_host,
            }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e),
            "latency_ms": round((time.time() - t0) * 1000, 1),
            "target_host": DATABASE_URL.split("@")[-1].split("/")[0] if "@" in DATABASE_URL else "local",
        }
