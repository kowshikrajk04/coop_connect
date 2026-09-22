import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    name: str

class UserRegister(BaseModel):
    email: str
    mobile: str
    password: str
    role: str  # CUSTOMER, WORKER, COOPERATIVE
    full_name: str
    address: str
    # Cooperative optional fields
    registration_number: Optional[str] = None
    contact_person: Optional[str] = None
    document_url: Optional[str] = None
    # Worker optional fields
    dob: Optional[str] = None

class UserLogin(BaseModel):
    login_id: str  # email or mobile
    password: str

class OTPRequest(BaseModel):
    email: Optional[str] = None
    mobile: Optional[str] = None
    purpose: Optional[str] = None  # e.g. "login", "register"

class OTPVerify(BaseModel):
    email: Optional[str] = None
    mobile: Optional[str] = None
    otp: str
    purpose: Optional[str] = None  # e.g. "login"

class OTPLoginRequest(BaseModel):
    login_id: Optional[str] = None  # email or mobile
    email: Optional[str] = None
    mobile: Optional[str] = None
    otp: str

class OTPResponse(BaseModel):
    success: bool
    message: str
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    role: Optional[str] = None
    user_id: Optional[int] = None
    name: Optional[str] = None


class UserOut(BaseModel):
    id: int
    email: str
    mobile: str
    role: str
    is_active: bool
    otp_verified: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class CustomerOut(BaseModel):
    id: int
    user_id: int
    full_name: str
    address: str
    latitude: float
    longitude: float
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class WorkerSkillSchema(BaseModel):
    id: Optional[int] = None
    skill_name: str
    years_experience: int

    class Config:
        from_attributes = True

class SkillsUpdatePayload(BaseModel):
    skills: List[WorkerSkillSchema]

class DocumentsUpdatePayload(BaseModel):
    id_document_url: Optional[str] = None
    cert_document_url: Optional[str] = None
    experience_proof_url: Optional[str] = None

class SkillAssessmentSchema(BaseModel):
    id: Optional[int] = None
    skill_name: str
    score: float
    passed: bool
    language: str
    answers_json: Optional[str] = None
    voice_transcript: Optional[str] = None
    evaluation_summary: Optional[str] = None
    status: Optional[str] = "PENDING_APPROVAL"
    assessment_date: datetime.datetime

    class Config:
        from_attributes = True

class SkillAssessmentSubmit(BaseModel):
    skill_name: str
    score: float
    passed: bool
    language: str = "en"
    answers_json: Optional[str] = None
    voice_transcript: Optional[str] = None
    evaluation_summary: Optional[str] = None
    status: Optional[str] = "PENDING_APPROVAL"

class VoiceAnswerEvaluateRequest(BaseModel):
    question_id: str
    skill_name: str
    spoken_text: str = ""
    selected_option_idx: Optional[int] = None
    language: str = "en"

class VoiceAnswerEvaluateResponse(BaseModel):
    score: float
    max_score: float = 10.0
    feedback: str
    matched_concepts: List[str] = []
    explanation: Optional[str] = None

class WorkerOut(BaseModel):
    id: int
    user_id: int
    cooperative_id: Optional[int] = None
    full_name: str
    mobile: str
    email: str
    dob: Optional[str] = None
    address: str
    latitude: float
    longitude: float
    profile_photo: Optional[str] = None
    id_document_url: Optional[str] = None
    cert_document_url: Optional[str] = None
    experience_proof_url: Optional[str] = None
    status: str
    is_available: bool
    rating: float
    total_jobs: int
    completed_jobs: int
    active_jobs: int
    opportunity_score: float
    rejection_reason: Optional[str] = None
    skills: List[WorkerSkillSchema] = []
    assessments: List[SkillAssessmentSchema] = []
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class CooperativeOut(BaseModel):
    id: int
    user_id: int
    name: str
    registration_number: str
    contact_person: str
    mobile: str
    email: str
    address: str
    document_url: Optional[str] = None
    status: str
    service_fee_pct: float
    welfare_pct: float
    reserve_pct: float
    training_pct: float
    emergency_pct: float
    pension_pct: float
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class CooperativeSettingsUpdate(BaseModel):
    service_fee_pct: Optional[float] = None
    welfare_pct: Optional[float] = None
    reserve_pct: Optional[float] = None
    training_pct: Optional[float] = None
    emergency_pct: Optional[float] = None
    pension_pct: Optional[float] = None

class WorkerVerifyAction(BaseModel):
    action: str  # APPROVE, REJECT, REQUEST_INFO
    reason: Optional[str] = None

class BookingCreate(BaseModel):
    service_type: str
    description: str
    is_emergency: bool = False
    emergency_reason: Optional[str] = None
    scheduled_date: str
    scheduled_time: str
    customer_address: str
    customer_lat: Optional[float] = 28.6139
    customer_lng: Optional[float] = 77.2090
    service_photo_url: Optional[str] = None

class BookingOut(BaseModel):
    id: int
    booking_number: str
    customer_id: int
    worker_id: Optional[int] = None
    cooperative_id: Optional[int] = None
    service_type: str
    description: str
    is_emergency: bool
    emergency_reason: Optional[str] = None
    emergency_priority: Optional[str] = None
    scheduled_date: str
    scheduled_time: str
    customer_address: str
    customer_lat: float
    customer_lng: float
    service_photo_url: Optional[str] = None
    status: str
    completion_photo_url: Optional[str] = None
    completion_notes: Optional[str] = None
    total_amount: float
    created_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None
    customer_name: Optional[str] = None
    customer_mobile: Optional[str] = None
    worker_name: Optional[str] = None
    worker_mobile: Optional[str] = None

    class Config:
        from_attributes = True

class ServiceCompletionSubmit(BaseModel):
    completion_photo_url: Optional[str] = None
    completion_notes: Optional[str] = None

class PaymentBreakdown(BaseModel):
    service_amount: float
    coop_fee: float
    worker_payout: float
    welfare_contribution: float
    total_amount: float
    coop_fee_pct: float
    welfare_pct: float

class PaymentSubmit(BaseModel):
    booking_id: int
    payment_method: str = "UPI"  # UPI, ONLINE, RAZORPAY

class CreateOrderRequest(BaseModel):
    booking_id: int
    amount: Optional[float] = None

class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int  # in paise
    currency: str = "INR"
    key_id: str

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    booking_id: int

class VerifyPaymentResponse(BaseModel):
    success: bool
    message: str
    payment_id: str
    order_id: str
    amount: float
    status: str = "PAID"

class InvoiceOut(BaseModel):
    id: int
    payment_id: int
    invoice_number: str
    issued_date: datetime.datetime
    customer_name: str
    worker_name: str
    coop_name: str
    service_type: str
    total_amount: float
    breakdown_json: str

    class Config:
        from_attributes = True

class RatingCreate(BaseModel):
    booking_id: int
    stars: Optional[int] = None
    rating: Optional[int] = None
    feedback: Optional[str] = None

class RatingOut(BaseModel):
    id: int
    booking_id: int
    customer_id: Optional[int] = None
    worker_id: Optional[int] = None
    stars: int
    rating: Optional[int] = None
    feedback: Optional[str] = None
    customer_name: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class FeedbackCreate(BaseModel):
    booking_id: int
    rating: Optional[int] = None
    stars: Optional[int] = None
    feedback: Optional[str] = None

class FeedbackOut(BaseModel):
    id: int
    booking_id: int
    customer_id: int
    worker_id: int
    stars: int
    rating: int
    feedback: Optional[str] = None
    customer_name: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class WorkerPerformanceOut(BaseModel):
    worker_id: int
    full_name: str
    profile_photo: Optional[str] = None
    cooperative_name: Optional[str] = None
    cooperative_id: Optional[int] = None
    skills: List[str] = []
    average_rating: float
    total_reviews: int
    completed_jobs: int
    total_jobs: int
    completion_rate: float
    bayesian_score: float
    performance_score: float
    rank: Optional[int] = None
    total_workers_ranked: int = 0
    rating_distribution: Dict[str, int] = {}
    recent_reviews: List[FeedbackOut] = []

class LeaderboardItem(BaseModel):
    rank: int
    worker_id: int
    full_name: str
    profile_photo: Optional[str] = None
    cooperative_id: Optional[int] = None
    cooperative_name: Optional[str] = None
    skills: List[str] = []
    average_rating: float
    total_reviews: int
    completed_jobs: int
    completion_rate: float
    performance_score: float
    badge: Optional[str] = None

class LeaderboardResponse(BaseModel):
    total_workers: int
    time_period: str
    trade: Optional[str] = None
    cooperative_id: Optional[int] = None
    items: List[LeaderboardItem] = []

class WelfareTransactionOut(BaseModel):
    id: int
    cooperative_id: int
    worker_id: Optional[int] = None
    worker_name: Optional[str] = None
    booking_id: Optional[int] = None
    amount: float
    category: str
    type: str
    description: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class WelfareSummaryOut(BaseModel):
    total_welfare_collected: float
    reserve_fund: float
    training_fund: float
    emergency_fund: float
    pension_fund: float
    transactions: List[WelfareTransactionOut] = []

class FairnessMetricOut(BaseModel):
    worker_id: int
    worker_name: str
    skills: List[str]
    jobs_received: int
    completed_jobs: int
    current_workload: int
    opportunity_score: float
    opportunity_gap: str  # "Balanced", "High Opportunity Need", "Heavily Utilized"
    rating: float
    is_available: bool
    status: str

class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    type: str
    read: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# Cooperative Membership Schemas
class MembershipRequestCreate(BaseModel):
    cooperative_id: int
    membership_type: Optional[str] = "JOIN_REQUEST"  # "JOIN_REQUEST" or "EXISTING_MEMBER"
    notes: Optional[str] = None

class MembershipRejectPayload(BaseModel):
    reason: Optional[str] = None

class VerifiedCooperativeOut(BaseModel):
    id: int
    name: str
    registration_number: str
    contact_person: str
    mobile: str
    email: str
    address: str
    service_fee_pct: float
    welfare_pct: float

    class Config:
        from_attributes = True

class CooperativeMembershipOut(BaseModel):
    id: int
    worker_id: int
    worker_name: Optional[str] = None
    worker_mobile: Optional[str] = None
    worker_email: Optional[str] = None
    worker_address: Optional[str] = None
    worker_skills: Optional[List[str]] = []
    worker_rating: Optional[float] = 5.0
    worker_status: Optional[str] = None
    cooperative_id: int
    cooperative_name: Optional[str] = None
    status: str
    membership_type: str
    requested_at: datetime.datetime
    approved_at: Optional[datetime.datetime] = None
    rejected_at: Optional[datetime.datetime] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True

class WorkerMembershipStatusOut(BaseModel):
    membership_status: str  # NOT_JOINED, PENDING, ACTIVE, REJECTED
    worker_status: str     # PENDING_VERIFICATION, VERIFIED, REJECTED
    cooperative_id: Optional[int] = None
    cooperative_name: Optional[str] = None
    cooperative_registration: Optional[str] = None
    active_membership: Optional[Dict[str, Any]] = None
    latest_request: Optional[Dict[str, Any]] = None

