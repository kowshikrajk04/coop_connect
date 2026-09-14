import datetime
import random
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db, Base, engine
import models
from auth_utils import hash_password

router = APIRouter(prefix="/api/demo", tags=["demo"])

@router.post("/reset")
def reset_to_empty_state(db: Session = Depends(get_db)):
    """
    Clears all application data, returning CoopConnect to its pristine initial empty state.
    Provides standard empty platform states across all roles.
    """
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # Re-create a single master Cooperative account so the system is ready for initial login/testing
    admin_user = models.User(
        email="cooperative@delhi.gov.in",
        mobile="9876543210",
        hashed_password=hash_password("CoopPass123!"),
        role="COOPERATIVE",
        is_active=True,
        otp_verified=True
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    coop = models.Cooperative(
        user_id=admin_user.id,
        name="Delhi Shramik Sahakari Samiti (Regd.)",
        registration_number="DEL-COOP-2024-8842",
        contact_person="Ramesh Sharma",
        mobile="9876543210",
        email="cooperative@delhi.gov.in",
        address="Sahakar Bhavan, Sector 12, RK Puram, New Delhi",
        status="APPROVED",
        service_fee_pct=5.0,
        welfare_pct=5.0
    )
    db.add(coop)
    db.commit()

    return {
        "success": True,
        "message": "Database reset to pure empty state. Default cooperative account ready: cooperative@delhi.gov.in / CoopPass123!"
    }

@router.post("/seed")
def seed_demo_data(db: Session = Depends(get_db)):
    """
    Optional Demo Data Seeder for end-to-end evaluation.
    Populates registered workers across all 10 trades, realistic customer requests,
    allocation metrics, welfare transactions, and historical data for demand forecasting.
    """
    # First reset to empty
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # 1. Cooperative
    coop_user = models.User(
        email="cooperative@delhi.gov.in",
        mobile="9876543210",
        hashed_password=hash_password("CoopPass123!"),
        role="COOPERATIVE",
        is_active=True,
        otp_verified=True
    )
    db.add(coop_user)
    db.commit()
    db.refresh(coop_user)

    coop = models.Cooperative(
        user_id=coop_user.id,
        name="Delhi Shramik Sahakari Samiti (Regd.)",
        registration_number="DEL-COOP-2024-8842",
        contact_person="Ramesh Sharma",
        mobile="9876543210",
        email="cooperative@delhi.gov.in",
        address="Sahakar Bhavan, Sector 12, RK Puram, New Delhi",
        status="APPROVED",
        service_fee_pct=5.0,
        welfare_pct=5.0,
        reserve_pct=40.0,
        training_pct=25.0,
        emergency_pct=20.0,
        pension_pct=15.0
    )
    db.add(coop)
    db.commit()
    db.refresh(coop)

    # 2. Customers
    cust_data = [
        {"name": "Ananya Roy", "email": "customer@demo.com", "mobile": "9811122233", "addr": "B-402, Green Park Extension, New Delhi", "lat": 28.5588, "lng": 77.2045},
        {"name": "Vikram Malhotra", "email": "vikram@demo.com", "mobile": "9822233344", "addr": "C-12, Hauz Khas Enclave, New Delhi", "lat": 28.5494, "lng": 77.2001},
        {"name": "Sunita Rao", "email": "sunita@demo.com", "mobile": "9833344455", "addr": "Flat 108, Vasant Kunj Sector C, New Delhi", "lat": 28.5284, "lng": 77.1558}
    ]
    created_customers = []
    for cd in cust_data:
        u = models.User(
            email=cd["email"],
            mobile=cd["mobile"],
            hashed_password=hash_password("DemoPass123!"),
            role="CUSTOMER",
            is_active=True,
            otp_verified=True
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        c = models.Customer(user_id=u.id, full_name=cd["name"], address=cd["addr"], latitude=cd["lat"], longitude=cd["lng"])
        db.add(c)
        db.commit()
        db.refresh(c)
        created_customers.append(c)

    # 3. Workers across trades with varying opportunity scores to test fairness allocation
    workers_spec = [
        {
            "name": "Rajesh Kumar", "email": "worker@demo.com", "mobile": "9844455566",
            "trade": "Electrician", "exp": 8, "score": 92.0, "status": "VERIFIED",
            "lat": 28.5600, "lng": 77.2050, "jobs": 14, "active": 0, "opp": 35.0,
            "rating": 4.9, "addr": "Safdarjung Enclave, New Delhi"
        },
        {
            "name": "Suresh Paswan", "email": "suresh@demo.com", "mobile": "9855566677",
            "trade": "Electrician", "exp": 4, "score": 85.0, "status": "VERIFIED",
            "lat": 28.5620, "lng": 77.2100, "jobs": 3, "active": 0, "opp": 88.0,  # High opportunity need!
            "rating": 4.8, "addr": "Yusuf Sarai, New Delhi"
        },
        {
            "name": "Manoj Verma", "email": "manoj@demo.com", "mobile": "9866677788",
            "trade": "Plumber", "exp": 6, "score": 88.0, "status": "VERIFIED",
            "lat": 28.5520, "lng": 77.1980, "jobs": 11, "active": 1, "opp": 40.0,
            "rating": 4.7, "addr": "Hauz Khas Market, New Delhi"
        },
        {
            "name": "Amit Bind", "email": "amit@demo.com", "mobile": "9877788899",
            "trade": "Plumber", "exp": 3, "score": 82.0, "status": "VERIFIED",
            "lat": 28.5540, "lng": 77.2020, "jobs": 2, "active": 0, "opp": 92.0,  # High opportunity need!
            "rating": 4.9, "addr": "Green Park Main, New Delhi"
        },
        {
            "name": "Dinesh Sharma", "email": "dinesh@demo.com", "mobile": "9888899900",
            "trade": "Carpenter", "exp": 10, "score": 90.0, "status": "VERIFIED",
            "lat": 28.5450, "lng": 77.2050, "jobs": 8, "active": 0, "opp": 55.0,
            "rating": 4.8, "addr": "Malviya Nagar, New Delhi"
        },
        {
            "name": "Pooja Kumari", "email": "pooja@demo.com", "mobile": "9899900011",
            "trade": "Cleaner", "exp": 5, "score": 88.0, "status": "VERIFIED",
            "lat": 28.5300, "lng": 77.1600, "jobs": 16, "active": 0, "opp": 30.0,
            "rating": 4.9, "addr": "Vasant Kunj, New Delhi"
        },
        {
            "name": "Kavita Devi", "email": "kavita@demo.com", "mobile": "9800011122",
            "trade": "Domestic Helper", "exp": 7, "score": 86.0, "status": "VERIFIED",
            "lat": 28.5350, "lng": 77.1650, "jobs": 9, "active": 0, "opp": 50.0,
            "rating": 4.8, "addr": "Masoodpur, Vasant Kunj"
        },
        {
            "name": "Santosh Yadav", "email": "santosh@demo.com", "mobile": "9812345678",
            "trade": "Painter", "exp": 5, "score": 84.0, "status": "PENDING_VERIFICATION",  # Pending cooperative approval!
            "lat": 28.5400, "lng": 77.1800, "jobs": 0, "active": 0, "opp": 100.0,
            "rating": 5.0, "addr": "Munirka Village, New Delhi"
        }
    ]

    created_workers = []
    for ws in workers_spec:
        wu = models.User(
            email=ws["email"],
            mobile=ws["mobile"],
            hashed_password=hash_password("DemoPass123!"),
            role="WORKER",
            is_active=True,
            otp_verified=True
        )
        db.add(wu)
        db.commit()
        db.refresh(wu)

        w = models.Worker(
            user_id=wu.id,
            cooperative_id=coop.id,
            full_name=ws["name"],
            mobile=ws["mobile"],
            email=ws["email"],
            dob="1988-04-12",
            address=ws["addr"],
            latitude=ws["lat"],
            longitude=ws["lng"],
            status=ws["status"],
            is_available=True,
            rating=ws["rating"],
            total_jobs=ws["jobs"],
            completed_jobs=ws["jobs"],
            active_jobs=ws["active"],
            opportunity_score=ws["opp"],
            id_document_url="https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=400&q=80",
            cert_document_url="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=400&q=80"
        )
        db.add(w)
        db.commit()
        db.refresh(w)

        # Add skill
        db.add(models.WorkerSkill(worker_id=w.id, skill_name=ws["trade"], years_experience=ws["exp"]))
        # Add assessment
        db.add(models.SkillAssessment(
            worker_id=w.id,
            skill_name=ws["trade"],
            score=ws["score"],
            passed=True,
            language="en",
            voice_transcript="Diagnosed main breaker voltage and identified neutral wire fault using multimeter test.",
            assessment_date=datetime.datetime.utcnow() - datetime.timedelta(days=random.randint(5, 30))
        ))
        db.commit()
        created_workers.append(w)

    # 4. Historical bookings (12+ bookings so that Demand Forecasting ML has sufficient data to generate predictions!)
    services = ["Electrician", "Plumber", "Carpenter", "Cleaner", "Painter", "Electrician", "Plumber", "Cleaner", "Electrician", "Domestic Helper", "Plumber", "Electrician"]
    for i, s_type in enumerate(services):
        b_num = f"CC-DEMO-{1000 + i}"
        cust = created_customers[i % len(created_customers)]
        wrk = created_workers[i % len(created_workers)]

        b = models.Booking(
            booking_number=b_num,
            customer_id=cust.id,
            worker_id=wrk.id,
            cooperative_id=coop.id,
            service_type=s_type,
            description=f"Standard cooperative service check and maintenance for {s_type}.",
            is_emergency=(i == 0 or i == 5),
            emergency_priority="CRITICAL" if (i == 0 or i == 5) else "NORMAL",
            emergency_reason="Short circuit spark from AC switch" if (i == 0 or i == 5) else None,
            scheduled_date=(datetime.date.today() - datetime.timedelta(days=12 - i)).strftime("%Y-%m-%d"),
            scheduled_time="10:00 AM",
            customer_address=cust.address,
            customer_lat=cust.latitude,
            customer_lng=cust.longitude,
            status="COMPLETED",
            total_amount=500.0,
            completion_photo_url="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=400&q=80",
            completion_notes="Work completed cleanly according to cooperative safety guidelines.",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=12 - i),
            completed_at=datetime.datetime.utcnow() - datetime.timedelta(days=12 - i, hours=-2)
        )
        db.add(b)
        db.commit()
        db.refresh(b)

        # Payment record
        coop_fee = 25.0
        welfare_contrib = 25.0
        worker_payout = 450.0

        p = models.Payment(
            booking_id=b.id,
            service_amount=500.0,
            coop_fee=coop_fee,
            worker_payout=worker_payout,
            welfare_contribution=welfare_contrib,
            payment_method="UPI",
            status="PAID",
            transaction_id=f"TXN-UPI-{random.randint(10000000, 99999999)}",
            paid_at=datetime.datetime.utcnow() - datetime.timedelta(days=12 - i)
        )
        db.add(p)
        db.commit()

        # Welfare transaction
        db.add(models.WelfareTransaction(
            cooperative_id=coop.id,
            worker_id=wrk.id,
            booking_id=b.id,
            amount=welfare_contrib,
            category="RESERVE" if i % 2 == 0 else "TRAINING",
            type="CREDIT",
            description=f"Welfare contribution from Booking #{b_num} ({s_type})",
            created_at=datetime.datetime.utcnow() - datetime.timedelta(days=12 - i)
        ))

        # Rating
        db.add(models.Rating(
            booking_id=b.id,
            customer_id=cust.id,
            worker_id=wrk.id,
            stars=5 if i % 3 != 0 else 4,
            feedback="Prompt, respectful, and very professional cooperative workmanship."
        ))

    db.commit()

    return {
        "success": True,
        "message": "Demo data successfully seeded! Ready for testing with all 3 accounts: Customer (customer@demo.com), Worker (worker@demo.com), Cooperative (cooperative@delhi.gov.in) with password 'DemoPass123!' or 'CoopPass123!'."
    }
