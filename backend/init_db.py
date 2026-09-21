import os
import sys
import sqlite3
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent.parent.parent.parent / "Downloads" / "coopconnect" / "backend"
if not backend_dir.exists():
    backend_dir = Path("backend").resolve()
sys.path.insert(0, str(backend_dir))

from database import engine, Base, SessionLocal, check_db_connection
import models
from sqlalchemy import text

def init_database(migrate_sqlite: bool = True):
    print("=== Initializing Neon PostgreSQL Database ===")
    db_info = check_db_connection()
    print(f"Target host: {db_info.get('target_host')}")
    print(f"Connected: {db_info.get('connected')} (latency: {db_info.get('latency_ms')}ms)")
    
    if not db_info.get("connected"):
        print(f"ERROR: Could not connect to database: {db_info.get('error')}")
        return False

    print("\nCreating tables in PostgreSQL if not exist...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")

    session = SessionLocal()
    try:
        user_count = session.query(models.User).count()
        print(f"Current users in PostgreSQL: {user_count}")

        # Seed standard services if table is empty
        service_count = session.query(models.Service).count()
        if service_count == 0:
            print("Populating standard services table...")
            trades = [
                ("Plumber", "Plumbing & Pipe Repair", "Emergency leak fixes, pipe replacement, bathroom fixtures", 500.0),
                ("Electrician", "Electrical & Wiring", "Short circuits, fuse replacement, switchboard repair", 450.0),
                ("Carpenter", "Carpentry & Woodwork", "Furniture repair, door hinges, cabinetry, lock fixing", 550.0),
                ("Painter", "Painting & Waterproofing", "Interior/exterior touchups, wall painting, waterproof coating", 600.0),
                ("Cleaner", "Deep Cleaning & Sanitization", "Kitchen, bathroom, and full household deep cleaning", 400.0),
                ("Caregiver", "Elder & Patient Care", "Assistance with daily activities, mobility, and companionship", 700.0),
                ("Driver", "Chauffeur & Driving Services", "On-demand personal driving and vehicle transit", 500.0),
                ("Gardener", "Lawn & Garden Care", "Pruning, lawn mowing, plant health, garden maintenance", 450.0),
                ("Domestic Helper", "Household Assistance", "Meal prep, dishwashing, daily home chores", 350.0),
                ("Technician", "Appliance & Device Repair", "AC servicing, refrigerator, washing machine repairs", 650.0),
            ]
            for name, cat, desc, price in trades:
                session.add(models.Service(name=name, category=cat, description=desc, base_price=price, is_active=True))
            session.commit()
            print(f"Added {len(trades)} standard services.")

        # Check if we should migrate existing data from SQLite
        sqlite_file = backend_dir / "coopconnect.db"
        if migrate_sqlite and user_count == 0 and sqlite_file.exists():
            print(f"\nMigrating existing data from {sqlite_file.name} to Neon PostgreSQL...")
            migrate_from_sqlite(sqlite_file, session)

        print("\n=== Database Verification Summary ===")
        summary = {
            "users": session.query(models.User).count(),
            "customers": session.query(models.Customer).count(),
            "cooperatives": session.query(models.Cooperative).count(),
            "workers": session.query(models.Worker).count(),
            "worker_skills": session.query(models.WorkerSkill).count(),
            "skill_assessments": session.query(models.SkillAssessment).count(),
            "bookings": session.query(models.Booking).count(),
            "worker_allocations": session.query(models.WorkerAllocation).count(),
            "payments": session.query(models.Payment).count(),
            "welfare_transactions": session.query(models.WelfareTransaction).count(),
            "ratings": session.query(models.Rating).count(),
            "services": session.query(models.Service).count(),
            "demand_forecasts": session.query(models.DemandForecast).count(),
            "worker_verifications": session.query(models.WorkerVerification).count(),
        }
        for table, count in summary.items():
            print(f"  - {table}: {count} records")

        print("\nDatabase is ready and connected to Neon PostgreSQL!")
        return True
    finally:
        session.close()

def migrate_from_sqlite(sqlite_path: Path, session):
    sq_conn = sqlite3.connect(sqlite_path)
    sq_conn.row_factory = sqlite3.Row
    sq_cur = sq_conn.cursor()

    def get_rows(tbl):
        try:
            sq_cur.execute(f"SELECT * FROM {tbl}")
            return sq_cur.fetchall()
        except Exception:
            return []

    # 1. Users
    for r in get_rows("users"):
        session.add(models.User(
            id=r["id"], email=r["email"], mobile=r["mobile"],
            hashed_password=r["hashed_password"], role=r["role"],
            is_active=bool(r["is_active"]), otp_verified=bool(r["otp_verified"])
        ))
    session.commit()

    # 2. Customers
    for r in get_rows("customers"):
        session.add(models.Customer(
            id=r["id"], user_id=r["user_id"], full_name=r["full_name"],
            address=r["address"], latitude=r["latitude"], longitude=r["longitude"]
        ))
    session.commit()

    # 3. Cooperatives
    for r in get_rows("cooperatives"):
        session.add(models.Cooperative(
            id=r["id"], user_id=r["user_id"], name=r["name"],
            registration_number=r["registration_number"], contact_person=r["contact_person"],
            mobile=r["mobile"], email=r["email"], address=r["address"],
            document_url=r["document_url"], status=r["status"],
            service_fee_pct=r["service_fee_pct"], welfare_pct=r["welfare_pct"]
        ))
    session.commit()

    # 4. Workers
    for r in get_rows("workers"):
        session.add(models.Worker(
            id=r["id"], user_id=r["user_id"], cooperative_id=r["cooperative_id"],
            full_name=r["full_name"], mobile=r["mobile"], email=r["email"],
            dob=r["dob"], address=r["address"], latitude=r["latitude"], longitude=r["longitude"],
            profile_photo=r["profile_photo"], id_document_url=r["id_document_url"],
            cert_document_url=r["cert_document_url"], experience_proof_url=r["experience_proof_url"],
            status=r["status"], is_available=bool(r["is_available"]), rating=r["rating"],
            total_jobs=r["total_jobs"], completed_jobs=r["completed_jobs"], active_jobs=r["active_jobs"],
            opportunity_score=r["opportunity_score"], rejection_reason=r["rejection_reason"]
        ))
    session.commit()

    # 5. Worker Skills
    for r in get_rows("worker_skills"):
        session.add(models.WorkerSkill(
            id=r["id"], worker_id=r["worker_id"], skill_name=r["skill_name"],
            years_experience=r["years_experience"]
        ))
    session.commit()

    # 6. Skill Assessments
    for r in get_rows("skill_assessments"):
        session.add(models.SkillAssessment(
            id=r["id"], worker_id=r["worker_id"], skill_name=r["skill_name"],
            score=r["score"], passed=bool(r["passed"]), language=r["language"],
            answers_json=r["answers_json"], voice_transcript=r["voice_transcript"],
            evaluation_summary=r["evaluation_summary"], status=r["status"]
        ))
    session.commit()

    # 7. Bookings
    for r in get_rows("bookings"):
        session.add(models.Booking(
            id=r["id"], booking_number=r["booking_number"], customer_id=r["customer_id"],
            worker_id=r["worker_id"], cooperative_id=r["cooperative_id"], service_type=r["service_type"],
            description=r["description"], is_emergency=bool(r["is_emergency"]), emergency_reason=r["emergency_reason"],
            emergency_priority=r["emergency_priority"], scheduled_date=r["scheduled_date"],
            scheduled_time=r["scheduled_time"], customer_address=r["customer_address"],
            customer_lat=r["customer_lat"], customer_lng=r["customer_lng"], service_photo_url=r["service_photo_url"],
            status=r["status"], completion_photo_url=r["completion_photo_url"], completion_notes=r["completion_notes"],
            total_amount=r["total_amount"]
        ))
    session.commit()

    # 8. Worker Allocations
    for r in get_rows("worker_allocations"):
        session.add(models.WorkerAllocation(
            id=r["id"], booking_id=r["booking_id"], worker_id=r["worker_id"],
            suitability_score=r["suitability_score"], skill_score=r["skill_score"],
            success_score=r["success_score"], availability_score=r["availability_score"],
            distance_score=r["distance_score"], rating_score=r["rating_score"],
            fairness_factor=r["fairness_factor"], status=r["status"]
        ))
    session.commit()

    # 9. Payments
    for r in get_rows("payments"):
        session.add(models.Payment(
            id=r["id"], booking_id=r["booking_id"], service_amount=r["service_amount"],
            coop_fee=r["coop_fee"], worker_payout=r["worker_payout"],
            welfare_contribution=r["welfare_contribution"], payment_method=r["payment_method"],
            status=r["status"], transaction_id=r["transaction_id"]
        ))
    session.commit()

    # 10. Welfare Transactions
    for r in get_rows("welfare_transactions"):
        session.add(models.WelfareTransaction(
            id=r["id"], cooperative_id=r["cooperative_id"], worker_id=r["worker_id"],
            booking_id=r["booking_id"], amount=r["amount"], category=r["category"],
            type=r["type"], description=r["description"]
        ))
    session.commit()

    # 11. Ratings
    for r in get_rows("ratings"):
        session.add(models.Rating(
            id=r["id"], booking_id=r["booking_id"], customer_id=r["customer_id"],
            worker_id=r["worker_id"], stars=r["stars"], feedback=r["feedback"]
        ))
    session.commit()

    # Reset PostgreSQL sequences so new auto-increments continue seamlessly
    tables_with_id = [
        "users", "customers", "cooperatives", "workers", "worker_skills",
        "skill_assessments", "bookings", "worker_allocations", "payments",
        "welfare_transactions", "ratings"
    ]
    for tbl in tables_with_id:
        try:
            session.execute(text(f"SELECT setval(pg_get_serial_sequence('{tbl}', 'id'), coalesce(max(id), 1)) FROM {tbl};"))
        except Exception:
            pass
    session.commit()

    sq_conn.close()
    print("SQLite migration to PostgreSQL completed successfully!")

if __name__ == "__main__":
    init_database()
