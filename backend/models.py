import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    mobile = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # CUSTOMER, WORKER, COOPERATIVE
    is_active = Column(Boolean, default=True)
    otp_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    customer = relationship("Customer", back_populates="user", uselist=False)
    worker = relationship("Worker", back_populates="user", uselist=False)
    cooperative = relationship("Cooperative", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    full_name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    latitude = Column(Float, default=28.6139)
    longitude = Column(Float, default=77.2090)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="customer")
    bookings = relationship("Booking", back_populates="customer")
    ratings = relationship("Rating", back_populates="customer", cascade="all, delete-orphan")


class Cooperative(Base):
    __tablename__ = "cooperatives"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    registration_number = Column(String, nullable=False, unique=True)
    contact_person = Column(String, nullable=False)
    mobile = Column(String, nullable=False)
    email = Column(String, nullable=False)
    address = Column(String, nullable=False)
    document_url = Column(String, nullable=True)
    status = Column(String, default="APPROVED")  # PENDING, APPROVED
    service_fee_pct = Column(Float, default=10.0)      # 10% (e.g. ₹100 fee on ₹1000 service)
    welfare_pct = Column(Float, default=5.0)           # 5%
    reserve_pct = Column(Float, default=40.0)          # 40% of welfare
    training_pct = Column(Float, default=25.0)         # 25% of welfare
    emergency_pct = Column(Float, default=20.0)        # 20% of welfare
    pension_pct = Column(Float, default=15.0)          # 15% of welfare
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="cooperative")
    workers = relationship("Worker", back_populates="cooperative")
    welfare_transactions = relationship("WelfareTransaction", back_populates="cooperative")
    verifications = relationship("WorkerVerification", back_populates="cooperative")
    memberships = relationship("CooperativeMembership", back_populates="cooperative", cascade="all, delete-orphan")


class Worker(Base):
    __tablename__ = "workers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    cooperative_id = Column(Integer, ForeignKey("cooperatives.id"), nullable=True)
    full_name = Column(String, nullable=False)
    mobile = Column(String, nullable=False)
    email = Column(String, nullable=False)
    dob = Column(String, nullable=True)
    address = Column(String, nullable=False)
    latitude = Column(Float, default=28.6139)
    longitude = Column(Float, default=77.2090)
    profile_photo = Column(String, nullable=True)
    id_document_url = Column(String, nullable=True)
    cert_document_url = Column(String, nullable=True)
    experience_proof_url = Column(String, nullable=True)
    status = Column(String, default="PENDING_VERIFICATION")  # PENDING_VERIFICATION, VERIFIED, REJECTED
    membership_status = Column(String, default="NOT_JOINED")  # NOT_JOINED, PENDING, ACTIVE, REJECTED
    is_available = Column(Boolean, default=True)
    rating = Column(Float, default=5.0)
    total_jobs = Column(Integer, default=0)
    completed_jobs = Column(Integer, default=0)
    active_jobs = Column(Integer, default=0)
    opportunity_score = Column(Float, default=100.0)  # High score means worker needs more opportunity
    rejection_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="worker")
    cooperative = relationship("Cooperative", back_populates="workers")
    skills = relationship("WorkerSkill", back_populates="worker", cascade="all, delete-orphan")
    assessments = relationship("SkillAssessment", back_populates="worker", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="worker")
    allocations = relationship("WorkerAllocation", back_populates="worker")
    welfare_transactions = relationship("WelfareTransaction", back_populates="worker")
    verifications = relationship("WorkerVerification", back_populates="worker")
    memberships = relationship("CooperativeMembership", back_populates="worker", cascade="all, delete-orphan")
    ratings = relationship("Rating", back_populates="worker", cascade="all, delete-orphan")


class WorkerSkill(Base):
    __tablename__ = "worker_skills"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False)
    skill_name = Column(String, nullable=False)
    years_experience = Column(Integer, default=1)

    worker = relationship("Worker", back_populates="skills")


class SkillAssessment(Base):
    __tablename__ = "skill_assessments"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False)
    skill_name = Column(String, nullable=False)
    score = Column(Float, nullable=False)
    passed = Column(Boolean, default=True)
    language = Column(String, default="en")  # en, ta, hi, te, kn, ml, bn, mr
    answers_json = Column(Text, nullable=True)
    voice_transcript = Column(Text, nullable=True)
    evaluation_summary = Column(Text, nullable=True)
    status = Column(String, default="PENDING_APPROVAL")  # PENDING_APPROVAL, APPROVED, RE_ASSESSMENT_REQUESTED
    assessment_date = Column(DateTime, default=datetime.datetime.utcnow)

    worker = relationship("Worker", back_populates="assessments")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    booking_number = Column(String, unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=True)
    cooperative_id = Column(Integer, ForeignKey("cooperatives.id"), nullable=True)
    service_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    is_emergency = Column(Boolean, default=False)
    emergency_reason = Column(String, nullable=True)
    emergency_priority = Column(String, nullable=True)  # CRITICAL, HIGH, MEDIUM, LOW
    scheduled_date = Column(String, nullable=False)
    scheduled_time = Column(String, nullable=False)
    customer_address = Column(String, nullable=False)
    customer_lat = Column(Float, default=28.6139)
    customer_lng = Column(Float, default=77.2090)
    service_photo_url = Column(String, nullable=True)
    status = Column(String, default="REQUESTED")  # REQUESTED, ALLOCATED, ACCEPTED, IN_PROGRESS, COMPLETED, CANCELLED
    payment_status = Column(String, default="PENDING")  # PENDING, PAID
    completion_photo_url = Column(String, nullable=True)
    completion_notes = Column(Text, nullable=True)
    total_amount = Column(Float, default=500.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    customer = relationship("Customer", back_populates="bookings")
    worker = relationship("Worker", back_populates="bookings")
    payment = relationship("Payment", back_populates="booking", uselist=False)
    allocations = relationship("WorkerAllocation", back_populates="booking")
    rating = relationship("Rating", back_populates="booking", uselist=False)
    transactions = relationship("PaymentTransaction", back_populates="booking")


class WorkerAllocation(Base):
    __tablename__ = "worker_allocations"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False)
    suitability_score = Column(Float, default=0.0)
    skill_score = Column(Float, default=0.0)
    success_score = Column(Float, default=0.0)
    availability_score = Column(Float, default=0.0)
    distance_score = Column(Float, default=0.0)
    rating_score = Column(Float, default=0.0)
    fairness_factor = Column(Float, default=0.0)
    status = Column(String, default="OFFERED")  # OFFERED, ACCEPTED, REJECTED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    booking = relationship("Booking", back_populates="allocations")
    worker = relationship("Worker", back_populates="allocations")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, unique=True)
    service_amount = Column(Float, nullable=False)
    coop_fee = Column(Float, nullable=False)
    worker_payout = Column(Float, nullable=False)
    welfare_contribution = Column(Float, nullable=False)
    payment_method = Column(String, default="UPI")  # UPI, ONLINE, RAZORPAY
    status = Column(String, default="PENDING")      # PENDING, PAID
    transaction_id = Column(String, nullable=True)
    razorpay_order_id = Column(String, nullable=True)
    razorpay_payment_id = Column(String, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    booking = relationship("Booking", back_populates="payment")
    invoice = relationship("Invoice", back_populates="payment", uselist=False)


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, index=True)
    razorpay_order_id = Column(String, index=True, nullable=True)
    razorpay_payment_id = Column(String, index=True, nullable=True)
    razorpay_signature = Column(String, nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="INR")
    status = Column(String, default="CREATED")  # CREATED, PAID, FAILED
    error_code = Column(String, nullable=True)
    error_description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    paid_at = Column(DateTime, nullable=True)

    booking = relationship("Booking", back_populates="transactions")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=False, unique=True)
    invoice_number = Column(String, unique=True, nullable=False)
    issued_date = Column(DateTime, default=datetime.datetime.utcnow)
    customer_name = Column(String, nullable=False)
    worker_name = Column(String, nullable=False)
    coop_name = Column(String, nullable=False)
    service_type = Column(String, nullable=False)
    total_amount = Column(Float, nullable=False)
    breakdown_json = Column(Text, nullable=False)

    payment = relationship("Payment", back_populates="invoice")


class WelfareTransaction(Base):
    __tablename__ = "welfare_transactions"

    id = Column(Integer, primary_key=True, index=True)
    cooperative_id = Column(Integer, ForeignKey("cooperatives.id"), nullable=False)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    amount = Column(Float, nullable=False)
    category = Column(String, nullable=False)  # RESERVE, TRAINING, EMERGENCY, PENSION
    type = Column(String, default="CREDIT")     # CREDIT, DEBIT
    description = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    cooperative = relationship("Cooperative", back_populates="welfare_transactions")
    worker = relationship("Worker", back_populates="welfare_transactions")


class Rating(Base):
    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, unique=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False, index=True)
    stars = Column(Integer, default=5, index=True)
    feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    booking = relationship("Booking", back_populates="rating")
    customer = relationship("Customer", back_populates="ratings")
    worker = relationship("Worker", back_populates="ratings")

    @property
    def rating(self):
        return self.stars


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String, default="INFO")  # INFO, ALERT, SUCCESS
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class WorkerVerification(Base):
    __tablename__ = "worker_verifications"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False)
    cooperative_id = Column(Integer, ForeignKey("cooperatives.id"), nullable=False)
    action = Column(String, nullable=False)  # VERIFY, REJECT, PENDING
    status = Column(String, default="APPROVED")
    reason = Column(String, nullable=True)
    verified_at = Column(DateTime, default=datetime.datetime.utcnow)

    worker = relationship("Worker", back_populates="verifications")
    cooperative = relationship("Cooperative", back_populates="verifications")


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    category = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    base_price = Column(Float, default=500.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class DemandForecast(Base):
    __tablename__ = "demand_forecasts"

    id = Column(Integer, primary_key=True, index=True)
    cooperative_id = Column(Integer, ForeignKey("cooperatives.id"), nullable=True)
    category = Column(String, nullable=False)
    predicted_weekly_demand = Column(Float, default=0.0)
    demand_share_pct = Column(Float, default=0.0)
    trend = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# Aliases for explicit semantic naming
ServiceRequest = Booking
WelfareContribution = WelfareTransaction


class OTPVerification(Base):
    __tablename__ = "otp_verifications"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), index=True, nullable=True)
    mobile = Column(String(15), index=True, nullable=True)
    otp_hash = Column(String(128), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, default=0)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    verified_at = Column(DateTime, nullable=True)


class CooperativeMembership(Base):
    __tablename__ = "cooperative_memberships"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False)
    cooperative_id = Column(Integer, ForeignKey("cooperatives.id"), nullable=False)
    status = Column(String, default="PENDING")  # PENDING, APPROVED, REJECTED
    membership_type = Column(String, default="JOIN_REQUEST")  # JOIN_REQUEST, EXISTING_MEMBER
    requested_at = Column(DateTime, default=datetime.datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    rejection_reason = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    worker = relationship("Worker", back_populates="memberships")
    cooperative = relationship("Cooperative", back_populates="memberships")


