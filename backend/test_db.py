"""
Simple PostgreSQL connection test for CoopConnect backend.
Usage: python test_db.py
"""
import sys
from pathlib import Path

# Ensure backend directory is on sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from database import engine, check_db_connection
from sqlalchemy import text

def test_connection():
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
            version = conn.execute(text("SELECT version()")).scalar()
            if result == 1:
                print("PostgreSQL connected successfully")
                print(f"PostgreSQL Version: {version.split(',')[0] if version else 'Unknown'}")
                status = check_db_connection()
                print(f"Target Host: {status.get('target_host')}")
                print(f"Latency: {status.get('latency_ms')} ms")
                return True
            else:
                print("Database returned unexpected result.")
                return False
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)
