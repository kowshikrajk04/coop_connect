import datetime
import random
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from auth_utils import hash_password, verify_password, create_access_token, get_current_user
from services.email_service import (
    normalize_email,
    generate_secure_otp,
    hash_otp,
    verify_otp_hash,
    send_email_otp,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=schemas.TokenResponse)
async def register(request: Request, db: Session = Depends(get_db)):
    content_type = request.headers.get("content-type", "")
    document_url = None

    if "multipart/form-data" in content_type:
        form = await request.form()
        email = str(form.get("email") or "").strip()
        mobile = str(form.get("mobile") or "").strip()
        password = str(form.get("password") or "")
        role = str(form.get("role") or "").strip()
        full_name = str(form.get("full_name") or "").strip()
        address = str(form.get("address") or "").strip()
        registration_number = form.get("registration_number")
        if registration_number is not None:
            registration_number = str(registration_number).strip()
        contact_person = form.get("contact_person")
        if contact_person is not None:
            contact_person = str(contact_person).strip()
        dob = form.get("dob")
        if dob is not None:
            dob = str(dob).strip()

        # Handle uploaded certificate/document file
        file_obj = form.get("certificate") or form.get("file") or form.get("document")
        if file_obj and hasattr(file_obj, "filename") and file_obj.filename:
            uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
            uploads_dir.mkdir(parents=True, exist_ok=True)
            ext = Path(file_obj.filename).suffix.lower()
            safe_name = f"coop_cert_{uuid.uuid4().hex[:12]}{ext}"
            file_path = uploads_dir / safe_name
            content = await file_obj.read()
            with open(file_path, "wb") as f:
                f.write(content)
            document_url = f"/uploads/{safe_name}"
        else:
            doc_str = form.get("document_url")
            document_url = str(doc_str).strip() if doc_str else None
    else:
        body = await request.json()
        req = schemas.UserRegister(**body)
        email = req.email.strip()
        mobile = req.mobile.strip()
        password = req.password
        role = req.role.strip()
        full_name = req.full_name.strip()
        address = req.address.strip()
        registration_number = req.registration_number
        contact_person = req.contact_person
        dob = req.dob
        document_url = req.document_url

    # Check if user already exists
    existing = db.query(models.User).filter(
        (models.User.email == email) | (models.User.mobile == mobile)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email or mobile number already exists."
        )

    # Create User
    new_user = models.User(
        email=email,
        mobile=mobile,
        hashed_password=hash_password(password),
        role=role.upper(),
        is_active=True,
        otp_verified=True  # Verified during signup flow
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create role-specific profile
    if role.upper() == "CUSTOMER":
        customer = models.Customer(
            user_id=new_user.id,
            full_name=full_name,
            address=address,
            latitude=28.6139,
            longitude=77.2090
        )
        db.add(customer)
    elif role.upper() == "WORKER":
        worker = models.Worker(
            user_id=new_user.id,
            full_name=full_name,
            mobile=mobile,
            email=email,
            dob=dob,
            address=address,
            latitude=28.6139 + (random.random() - 0.5) * 0.05,
            longitude=77.2090 + (random.random() - 0.5) * 0.05,
            status="PENDING_VERIFICATION",
            membership_status="NOT_JOINED",
            is_available=True,
            rating=5.0,
            opportunity_score=100.0
        )
        db.add(worker)
    elif role.upper() == "COOPERATIVE":
        coop = models.Cooperative(
            user_id=new_user.id,
            name=full_name,
            registration_number=registration_number or f"COOP-IND-{random.randint(1000, 9999)}",
            contact_person=contact_person or full_name,
            mobile=mobile,
            email=email,
            address=address,
            document_url=document_url,
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
        name=full_name
    )

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix.lower()
    safe_name = f"doc_{uuid.uuid4().hex[:12]}{ext}"
    file_path = uploads_dir / safe_name
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    return {"url": f"/uploads/{safe_name}", "filename": file.filename}

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

@router.post("/send-otp", response_model=schemas.OTPResponse)
def send_otp(req: schemas.OTPRequest, db: Session = Depends(get_db)):
    # Determine recipient email
    target_email = (req.email or "").strip()
    if not target_email and req.mobile and "@" in req.mobile:
        target_email = req.mobile.strip()

    is_valid, normalized_email = normalize_email(target_email)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid email address."
        )

    now = datetime.datetime.utcnow()

    # 1. Enforce 60-second resend cooldown per email
    recent_otp = db.query(models.OTPVerification).filter(
        models.OTPVerification.email == normalized_email
    ).order_by(models.OTPVerification.id.desc()).first()

    if recent_otp and not recent_otp.verified:
        elapsed = (now - recent_otp.created_at).total_seconds()
        if elapsed < 60:
            remaining = int(60 - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {remaining} seconds before requesting another OTP."
            )

    # 2. Generate secure 6-digit OTP & salted hash
    otp = generate_secure_otp(6)
    hashed = hash_otp(otp, normalized_email)
    expires_at = now + datetime.timedelta(seconds=300)

    # 3. Store record in PostgreSQL
    otp_record = models.OTPVerification(
        email=normalized_email,
        mobile=req.mobile if req.mobile and "@" not in req.mobile else None,
        otp_hash=hashed,
        expires_at=expires_at,
        attempts=0,
        verified=False,
        created_at=now
    )
    db.add(otp_record)
    db.commit()

    # 4. Dispatch Email via Gmail SMTP
    email_result = send_email_otp(normalized_email, otp)
    if not email_result.get("success") and email_result.get("reason") == "credentials_missing":
        return schemas.OTPResponse(
            success=True,
            message="Verification OTP recorded. Note: Configure SMTP_USERNAME and SMTP_PASSWORD in backend/.env for live email delivery."
        )
    elif not email_result.get("success"):
        return schemas.OTPResponse(
            success=False,
            message=email_result.get("message", "Failed to dispatch verification email.")
        )

    return schemas.OTPResponse(
        success=True,
        message=f"Verification code sent to {normalized_email}."
    )

@router.post("/verify-otp", response_model=schemas.OTPResponse)
def verify_otp(req: schemas.OTPVerify, db: Session = Depends(get_db)):
    target_email = (req.email or "").strip()
    if not target_email and req.mobile and "@" in req.mobile:
        target_email = req.mobile.strip()

    is_valid, normalized_email = normalize_email(target_email)

    filter_cond = None
    target_identifier = None
    if is_valid:
        filter_cond = (models.OTPVerification.email == normalized_email)
        target_identifier = normalized_email
    elif req.mobile:
        filter_cond = (models.OTPVerification.mobile == req.mobile.strip())
        target_identifier = req.mobile.strip()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid email address to verify."
        )

    now = datetime.datetime.utcnow()

    # Find the latest unverified OTP record
    record = db.query(models.OTPVerification).filter(
        filter_cond,
        models.OTPVerification.verified == False
    ).order_by(models.OTPVerification.id.desc()).first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active OTP request found. Please request a new OTP."
        )

    # Check max attempts (limit 5)
    if record.attempts >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum verification attempts exceeded. Please request a new OTP."
        )

    # Check expiry (5 minutes)
    if now > record.expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new OTP."
        )

    # Verify submitted OTP against stored hash
    lookup_target = record.email or record.mobile or target_identifier
    is_match = verify_otp_hash(req.otp.strip(), lookup_target, record.otp_hash)
    if not is_match:
        record.attempts += 1
        db.commit()
        remaining = max(0, 5 - record.attempts)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OTP code. {remaining} attempt(s) remaining."
        )

    # Mark verified
    record.verified = True
    record.verified_at = now

    # Also update user if already registered
    if record.email:
        user = db.query(models.User).filter(models.User.email == record.email).first()
        if user:
            user.otp_verified = True
    if record.mobile:
        user = db.query(models.User).filter(models.User.mobile == record.mobile).first()
        if user:
            user.otp_verified = True

    db.commit()

    return schemas.OTPResponse(
        success=True,
        message="Email verified successfully."
    )


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
