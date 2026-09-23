import datetime
import os
import random
import uuid
import logging
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger("coopconnect.auth")

try:
    OTP_EXPIRY_SECONDS = int(os.getenv("OTP_EXPIRY", "300"))
except ValueError:
    OTP_EXPIRY_SECONDS = 300


def is_staging_universal_otp_active() -> bool:
    """
    Checks if universal dummy OTP (working for ANY email) is enabled.

    STRICT SECURITY CONTROLS:
    1. NEVER active in production. If ENVIRONMENT is 'production', 'prod', or 'live',
       this function unconditionally returns False regardless of any other flag.
    2. Requires ENVIRONMENT to be explicitly 'staging', 'demo', 'development', or 'test'.
    3. Requires explicit opt-in flag STAGING_UNIVERSAL_DUMMY_OTP_ENABLED=true.
    """
    env_name = os.getenv("ENVIRONMENT", os.getenv("ENV", "")).strip().strip("'\"").lower()
    if env_name in ("production", "prod", "live"):
        return False

    if env_name not in ("staging", "demo", "development", "test", "dev"):
        return False

    raw_flag = os.getenv("STAGING_UNIVERSAL_DUMMY_OTP_ENABLED", "false")
    return str(raw_flag).strip().strip("'\"").lower() in ("true", "1", "yes")


def is_demo_otp_active_for_email(email: str) -> bool:
    """
    Checks if dummy OTP (123456) is permitted for the given email address.

    Modes:
    A. STAGING UNIVERSAL DEMO MODE:
       - Enabled ONLY in staging/demo environments (ENVIRONMENT=staging, demo, dev, test).
       - Requires STAGING_UNIVERSAL_DUMMY_OTP_ENABLED=true.
       - STRICTLY BLOCKED in production.
       - When active, accepts dummy OTP 123456 for ANY entered email address.

    B. PRODUCTION RESTRICTED DEMO MODE:
       - Active when DEMO_OTP_ENABLED=true.
       - Requires explicit DEMO_OTP_EMAIL allowlist.
       - ONLY permits dummy OTP for that exact allowlisted demo account.
       - All other accounts unconditionally require real email OTP via SMTP.
    """
    if not email:
        return False

    clean_email = email.strip().strip("'\"").lower()

    # In local development, dynamically reload backend/.env so changes take effect immediately.
    # In cloud environments (e.g. Render), never override os.environ with filesystem files.
    # Skip reload during automated tests so patch.dict() environment overrides are respected.
    is_under_test = "pytest" in os.getenv("_", "") or "PYTEST_CURRENT_TEST" in os.environ
    is_cloud_or_prod = (
        os.getenv("ENVIRONMENT", os.getenv("ENV", "")).strip().lower() in ("production", "prod", "live")
        or bool(os.getenv("RENDER"))
        or bool(os.getenv("RENDER_SERVICE_ID"))
        or bool(os.getenv("K_SERVICE"))
        or bool(os.getenv("AWS_EXECUTION_ENV"))
    )
    if not is_under_test and not is_cloud_or_prod and env_path.exists():
        load_dotenv(dotenv_path=env_path, override=True)

    # 1. Staging Universal Demo Mode Check (strictly rejected if ENVIRONMENT is production)
    if is_staging_universal_otp_active():
        return True

    # 2. Production / Cloud Restricted Allowlist Check
    raw_enabled = os.getenv("DEMO_OTP_ENABLED", os.getenv("DEV_DUMMY_OTP_ENABLED", "false"))
    val = str(raw_enabled).strip().strip("'\"").lower()
    if val not in ("true", "1", "yes"):
        return False

    # 3. Allowlisted Demo Email check
    allowlist_raw = os.getenv("DEMO_OTP_EMAIL", os.getenv("DEMO_ACCOUNT_EMAIL", "")).strip().strip("'\"").lower()
    if not allowlist_raw:
        if is_cloud_or_prod:
            # In production or cloud environments, an explicit allowlist email is MANDATORY
            return False
        else:
            # In local dev only, default to standard demo account
            allowlist_raw = "customer@demo.com"

    allowed_emails = [e.strip().strip("'\"").lower() for e in allowlist_raw.split(",") if e.strip()]
    return clean_email in allowed_emails


def is_dummy_otp_mode_active() -> bool:
    """
    Backwards-compatible helper. Returns True only if demo OTP is enabled and
    the default demo account customer@demo.com is active.
    """
    return is_demo_otp_active_for_email("customer@demo.com")


from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from sqlalchemy import func
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
            latitude=11.0168,
            longitude=76.9558
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
            latitude=11.0168 + (random.random() - 0.5) * 0.05,
            longitude=76.9558 + (random.random() - 0.5) * 0.05,
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

@router.post("/login-otp", response_model=schemas.TokenResponse)
def login_with_otp(req: schemas.OTPLoginRequest, db: Session = Depends(get_db)):
    target_identifier = (req.login_id or req.email or req.mobile or "").strip()
    if not target_identifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide your registered email or mobile number."
        )

    is_valid_email, normalized_email = normalize_email(target_identifier)
    lookup_email = normalized_email if is_valid_email else target_identifier

    # 1. Require registered user (do not create user automatically)
    user = db.query(models.User).filter(
        (func.lower(models.User.email) == lookup_email) | (models.User.mobile == target_identifier)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email or mobile. Please check your credentials or sign up."
        )

    if hasattr(user, "is_active") and not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact support."
        )

    now = datetime.datetime.utcnow()

    # 2. Find latest unverified OTP record
    filter_cond = (func.lower(models.OTPVerification.email) == lookup_email)
    if user.email:
        filter_cond = filter_cond | (func.lower(models.OTPVerification.email) == user.email.lower())
    if user.mobile:
        filter_cond = filter_cond | (models.OTPVerification.mobile == user.mobile)

    record = db.query(models.OTPVerification).filter(
        filter_cond,
        models.OTPVerification.verified == False
    ).order_by(models.OTPVerification.id.desc()).first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active OTP request found. Please request an OTP code first."
        )

    if record.attempts >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum verification attempts exceeded. Please request a new OTP."
        )

    if now > record.expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new OTP code."
        )

    submitted_otp = req.otp.strip()
    target_email = user.email or lookup_email
    demo_active = is_demo_otp_active_for_email(target_email)

    is_match = False
    if demo_active and submitted_otp == "123456":
        is_match = True
        logger.info("DEMO_OTP: Login demo OTP 123456 verified for allowlisted user %s (%s).", user.id, user.email)
    elif submitted_otp == "123456" and not demo_active:
        # Strictly reject dummy OTP for any non-allowlisted account
        is_match = False
    else:
        lookup_target = record.email or record.mobile or lookup_email
        is_match = verify_otp_hash(submitted_otp, lookup_target, record.otp_hash)

    if not is_match:
        record.attempts += 1
        db.commit()
        remaining = max(0, 5 - record.attempts)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid OTP code. {remaining} attempt(s) remaining."
        )

    # 3. Mark verified
    record.verified = True
    record.verified_at = now
    user.otp_verified = True
    db.commit()

    # 4. Generate normal JWT session token
    name = "User"
    if user.role == "CUSTOMER" and user.customer:
        name = user.customer.full_name
    elif user.role == "WORKER" and user.worker:
        name = user.worker.full_name
    elif user.role == "COOPERATIVE" and user.cooperative:
        name = user.cooperative.name

    token = create_access_token({"sub": str(user.id), "role": user.role})
    logger.info("User %s (%s) logged in successfully via OTP.", user.id, user.role)
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

    # If purpose is login, verify that user account actually exists (prevent creating or sending to unregistered)
    if req.purpose == "login":
        existing_user = db.query(models.User).filter(
            (func.lower(models.User.email) == normalized_email) | (models.User.mobile == target_email)
        ).first()
        if not existing_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No account found with this email. Please check your email or sign up."
            )
        if hasattr(existing_user, "is_active") and not existing_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been deactivated. Please contact support."
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
    demo_active = is_demo_otp_active_for_email(normalized_email)
    if demo_active:
        otp = "123456"
    else:
        otp = generate_secure_otp(6)

    hashed = hash_otp(otp, normalized_email)
    expires_at = now + datetime.timedelta(seconds=OTP_EXPIRY_SECONDS)

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

    # 4. Dispatch Email via Gmail SMTP (skip if demo OTP mode is active for this account)
    if demo_active:
        staging_mode = is_staging_universal_otp_active()
        mode_label = "[STAGING DEMO]" if staging_mode else "[DEMO MODE]"
        logger.info(
            "DEMO_OTP: %s Generated demo OTP 123456 for %s (email dispatch skipped).",
            mode_label,
            normalized_email
        )
        return schemas.OTPResponse(
            success=True,
            message=f"{mode_label} Demo OTP 123456 generated for {normalized_email}. Use 123456 to verify."
        )

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
        filter_cond = (func.lower(models.OTPVerification.email) == normalized_email)
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

    # Verify submitted OTP against stored hash (with safe demo OTP handling for allowlisted demo accounts)
    lookup_target = record.email or record.mobile or target_identifier
    submitted_otp = req.otp.strip()

    demo_active = is_demo_otp_active_for_email(lookup_target)

    is_match = False
    if demo_active and submitted_otp == "123456":
        is_match = True
        logger.info("DEMO_OTP: Verified demo OTP 123456 for allowlisted account %s.", lookup_target)
    elif submitted_otp == "123456" and not demo_active:
        # Strictly reject dummy OTP for any non-allowlisted account
        is_match = False
    else:
        is_match = verify_otp_hash(submitted_otp, lookup_target, record.otp_hash)

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
    user = None
    if record.email:
        user = db.query(models.User).filter(models.User.email == record.email).first()
        if user:
            user.otp_verified = True
    if not user and record.mobile:
        user = db.query(models.User).filter(models.User.mobile == record.mobile).first()
        if user:
            user.otp_verified = True

    db.commit()

    # If verification purpose was login, return session JWT token data
    if req.purpose == "login" and user:
        name = "User"
        if user.role == "CUSTOMER" and user.customer:
            name = user.customer.full_name
        elif user.role == "WORKER" and user.worker:
            name = user.worker.full_name
        elif user.role == "COOPERATIVE" and user.cooperative:
            name = user.cooperative.name

        token = create_access_token({"sub": str(user.id), "role": user.role})
        return schemas.OTPResponse(
            success=True,
            message="Login successful.",
            access_token=token,
            token_type="bearer",
            role=user.role,
            user_id=user.id,
            name=name
        )

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
