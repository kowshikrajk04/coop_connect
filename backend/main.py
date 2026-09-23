import os
import logging
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import engine, Base, get_db, check_db_connection
import models
from routers import (
    auth, customer, worker, cooperative, bookings, 
    payments, demand_forecast, notifications, assessment, memberships, feedback, demo_data, complaints
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("coopconnect")

# Create database tables automatically in PostgreSQL
try:
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS email VARCHAR(255);"))
        conn.execute(text("ALTER TABLE otp_verifications ALTER COLUMN mobile DROP NOT NULL;"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_otp_verifications_email ON otp_verifications (email);"))
        conn.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'PENDING';"))
        conn.execute(text("ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255);"))
        conn.execute(text("ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255);"))
        conn.execute(text("UPDATE cooperatives SET service_fee_pct = 10.0 WHERE service_fee_pct = 5.0 OR service_fee_pct IS NULL;"))
        conn.execute(text("ALTER TABLE workers ADD COLUMN IF NOT EXISTS membership_status VARCHAR(50) DEFAULT 'NOT_JOINED';"))
        conn.execute(text("UPDATE workers SET membership_status = 'ACTIVE' WHERE cooperative_id IS NOT NULL AND (membership_status IS NULL OR membership_status = 'NOT_JOINED');"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_ratings_worker_id ON ratings (worker_id);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_ratings_customer_id ON ratings (customer_id);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_ratings_stars ON ratings (stars);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_ratings_created_at ON ratings (created_at);"))
        # Ensure new booking statuses work (SQLite string-based, no ALTER needed; PostgreSQL same)
        # Register complaint table if not exists (created by create_all above, but safe guard)
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_bookings_cooperative_id ON bookings (cooperative_id);"))
        conn.commit()
    logger.info("CoopConnect database tables verified.")
except Exception as e:
    logger.warning(f"Database table verification notice: {e}")

app = FastAPI(
    title="CoopConnect API",
    description="Backend services for CoopConnect – AI-Powered Cooperative Workforce Marketplace",
    version="1.0.0"
)

# Static file serving for uploaded certificates and documents
from pathlib import Path
from fastapi.staticfiles import StaticFiles

uploads_dir = Path(__file__).resolve().parent / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# Configure CORS for local Next.js and Vercel production frontend
cors_env = os.getenv("CORS_ORIGINS", "")
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]
if cors_env:
    for origin in cors_env.split(","):
        origin = origin.strip()
        if origin and origin not in allowed_origins:
            allowed_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Mount existing routers
app.include_router(auth.router)
app.include_router(customer.router)
app.include_router(worker.router)
app.include_router(cooperative.router)
app.include_router(bookings.router)
app.include_router(payments.router)
app.include_router(demand_forecast.router)
app.include_router(notifications.router)
app.include_router(assessment.router)
app.include_router(memberships.router)
app.include_router(feedback.router)
app.include_router(demo_data.router)
app.include_router(complaints.router)

@app.get("/")
def root():
    return {
        "platform": "CoopConnect",
        "tagline": "Fair Work • Stronger Communities",
        "status": "online",
        "version": "1.0.0",
        "database": check_db_connection().get("dialect", "unknown")
    }

@app.get("/api/health")
@app.get("/health")
def health():
    db_status = check_db_connection()
    is_connected = db_status.get("connected", False)
    return {
        "status": "healthy" if is_connected else "degraded",
        "database": "connected" if is_connected else "disconnected",
        "details": db_status
    }

@app.get("/api/services")
def get_services(db: Session = Depends(get_db)):
    """Retrieve available platform services from PostgreSQL."""
    services = db.query(models.Service).filter(models.Service.is_active == True).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "description": s.description,
            "base_price": s.base_price,
            "is_active": s.is_active
        }
        for s in services
    ]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
