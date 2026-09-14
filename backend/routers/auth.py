import random
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from auth_utils import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

# In-memory OTP store for verification simulation
OTP_STORE = {}

@router.post("/register", response_model=schemas.TokenResponse)
def register(req: schemas.UserRegister, db: Session = Depends(get_db)):
    # Check if user already exists
    existing = db.query(models.User).filter(
        (models.User.email == req.email) | (models.User.mobile == req.mobile)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email or mobile number already exists."
        )

    # Create User
    new_user = models.User(
        email=req.email,
        mobile=req.mobile,
        hashed_password=hash_password(req.password),
        role=req.role.upper(),
        is_active=True,
        otp_verified=True  # Verified during signup flow
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create role-specific profile
    if req.role.upper() == "CUSTOMER":
        customer = models.Customer(
            user_id=new_user.id,
            full_name=req.full_name,
            address=req.address,
            latitude=28.6139,
            longitude=77.2090
        )
        db.add(customer)
    elif req.role.upper() == "WORKER":
        worker = models.Worker(
            user_id=new_user.id,
            full_name=req.full_name,
            mobile=req.mobile,
            email=req.email,
            dob=req.dob,
            address=req.address,
            latitude=28.6139 + (random.random() - 0.5) * 0.05,
            longitude=77.2090 + (random.random() - 0.5) * 0.05,
            status="PENDING_VERIFICATION",
            is_available=True,
            rating=5.0,
            opportunity_score=100.0
        )
        db.add(worker)
    elif req.role.upper() == "COOPERATIVE":
        coop = models.Cooperative(
            user_id=new_user.id,
            name=req.full_name,
            registration_number=req.registration_number or f"COOP-IND-{random.randint(1000, 9999)}",
            contact_person=req.contact_person or req.full_name,
            mobile=req.mobile,
            email=req.email,
            address=req.address,
            status="APPROVED",
            service_fee_pct=5.0,
            welfare_pct=5.0
        )
        db.add(coop)

    db.commit()

    token = create_access_token({"sub": str(new_user.id), "role": new_user.role})
    return schemas.TokenResponse(
        access_token=token,
        role=new_user.role,
        user_id=new_user.id,
        name=req.full_name
    )

@router.post("/login", response_model=schemas.TokenResponse)
def login(req: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        (models.User.email == req.login_id) | (models.User.mobile == req.login_id)
    ).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid mobile/email or password."
        )

    # Determine display name
    name = "User"
    if user.role == "CUSTOMER" and user.customer:
        name = user.customer.full_name
    elif user.role == "WORKER" and user.worker:
        name = user.worker.full_name
    elif user.role == "COOPERATIVE" and user.cooperative:
        name = user.cooperative.name

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return schemas.TokenResponse(
        access_token=token,
        role=user.role,
        user_id=user.id,
        name=name
    )

@router.post("/send-otp")
def send_otp(req: schemas.OTPRequest):
    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    OTP_STORE[req.mobile] = otp
    return {
        "success": True,
        "message": f"Verification code sent to {req.mobile}",
        "demo_otp": otp  # Included for effortless testing in prototype
    }

@router.post("/verify-otp")
def verify_otp(req: schemas.OTPVerify, db: Session = Depends(get_db)):
    saved_otp = OTP_STORE.get(req.mobile)
    # Accept if matches or if default test OTP '123456' is used
    if req.otp == saved_otp or req.otp == "123456":
        user = db.query(models.User).filter(models.User.mobile == req.mobile).first()
        if user:
            user.otp_verified = True
            db.commit()
        return {"success": True, "message": "Mobile number verified successfully."}
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP code.")

@router.get("/me")
def get_me(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = {}
    if user.role == "CUSTOMER" and user.customer:
        profile = {
            "customer_id": user.customer.id,
            "full_name": user.customer.full_name,
            "address": user.customer.address,
            "latitude": user.customer.latitude,
            "longitude": user.customer.longitude
        }
    elif user.role == "WORKER" and user.worker:
        skills = [{"skill_name": s.skill_name, "years_experience": s.years_experience} for s in user.worker.skills]
        profile = {
            "worker_id": user.worker.id,
            "full_name": user.worker.full_name,
            "status": user.worker.status,
            "is_available": user.worker.is_available,
            "rating": user.worker.rating,
            "total_jobs": user.worker.total_jobs,
            "completed_jobs": user.worker.completed_jobs,
            "opportunity_score": user.worker.opportunity_score,
            "skills": skills,
            "address": user.worker.address
        }
    elif user.role == "COOPERATIVE" and user.cooperative:
        profile = {
            "cooperative_id": user.cooperative.id,
            "name": user.cooperative.name,
            "registration_number": user.cooperative.registration_number,
            "contact_person": user.cooperative.contact_person,
            "status": user.cooperative.status,
            "service_fee_pct": user.cooperative.service_fee_pct,
            "welfare_pct": user.cooperative.welfare_pct
        }

    return {
        "id": user.id,
        "email": user.email,
        "mobile": user.mobile,
        "role": user.role,
        "otp_verified": user.otp_verified,
        "profile": profile
    }
