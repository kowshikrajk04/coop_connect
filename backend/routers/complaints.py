import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from auth_utils import get_current_user

router = APIRouter(prefix="/api/complaints", tags=["complaints"])

VALID_CATEGORIES = [
    "WORKER_DID_NOT_ARRIVE",
    "CUSTOMER_UNAVAILABLE",
    "PAYMENT_ISSUE",
    "SERVICE_QUALITY",
    "WRONG_SERVICE",
    "CANCELLATION_ISSUE",
    "OTHER"
]


@router.post("")
def raise_complaint(
    data: dict,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Customer or Worker raises a complaint about a booking."""
    booking_id = data.get("booking_id")
    category = data.get("category", "OTHER")
    description = data.get("description", "").strip()

    if not booking_id or not description:
        raise HTTPException(status_code=400, detail="booking_id and description are required.")

    if category not in VALID_CATEGORIES:
        category = "OTHER"

    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    # Validate that the user is the customer or assigned worker for this booking
    is_customer = user.role == "CUSTOMER" and user.customer and booking.customer_id == user.customer.id
    is_worker = user.role == "WORKER" and user.worker and booking.worker_id == user.worker.id
    if not (is_customer or is_worker):
        raise HTTPException(status_code=403, detail="You are not associated with this booking.")

    # Prevent duplicate open complaint for same booking by same user
    existing = db.query(models.Complaint).filter(
        models.Complaint.booking_id == booking_id,
        models.Complaint.raised_by_user_id == user.id,
        models.Complaint.status.in_(["OPEN", "UNDER_REVIEW"])
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You already have an open complaint for this booking.")

    complaint = models.Complaint(
        booking_id=booking_id,
        raised_by_user_id=user.id,
        category=category,
        description=description,
        status="OPEN"
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    # Notify cooperative
    if booking.cooperative_id:
        coop_obj = db.query(models.Cooperative).filter(
            models.Cooperative.id == booking.cooperative_id
        ).first()
        if coop_obj:
            db.add(models.Notification(
                user_id=coop_obj.user_id,
                title=f"New Complaint: {category.replace('_', ' ').title()}",
                message=f"A complaint has been raised for booking #{booking.booking_number}: {description[:100]}",
                type="ALERT"
            ))
            db.commit()

    return {
        "success": True,
        "complaint_id": complaint.id,
        "status": complaint.status,
        "message": "Complaint submitted. The cooperative will review and respond shortly."
    }


@router.get("/my")
def get_my_complaints(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all complaints raised by the current user."""
    complaints = db.query(models.Complaint).filter(
        models.Complaint.raised_by_user_id == user.id
    ).order_by(models.Complaint.created_at.desc()).all()

    result = []
    for c in complaints:
        booking = db.query(models.Booking).filter(models.Booking.id == c.booking_id).first()
        result.append({
            "id": c.id,
            "booking_id": c.booking_id,
            "booking_number": booking.booking_number if booking else "-",
            "service_type": booking.service_type if booking else "-",
            "category": c.category,
            "description": c.description,
            "status": c.status,
            "resolution": c.resolution,
            "created_at": c.created_at.strftime("%d %b %Y, %I:%M %p"),
            "updated_at": c.updated_at.strftime("%d %b %Y, %I:%M %p") if c.updated_at else None
        })
    return result


@router.get("/cooperative")
def get_cooperative_complaints(
    status_filter: str = "ALL",
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cooperative admin views all complaints for their bookings."""
    if user.role != "COOPERATIVE":
        raise HTTPException(status_code=403, detail="Cooperative access required.")

    coop_id = user.cooperative.id if user.cooperative else None
    if not coop_id:
        raise HTTPException(status_code=404, detail="Cooperative profile not found.")

    # Get all bookings for this cooperative
    booking_ids = db.query(models.Booking.id).filter(
        models.Booking.cooperative_id == coop_id
    ).all()
    booking_id_list = [row[0] for row in booking_ids]

    query = db.query(models.Complaint).filter(
        models.Complaint.booking_id.in_(booking_id_list)
    )
    if status_filter != "ALL":
        query = query.filter(models.Complaint.status == status_filter)

    complaints = query.order_by(models.Complaint.created_at.desc()).all()

    result = []
    for c in complaints:
        booking = db.query(models.Booking).filter(models.Booking.id == c.booking_id).first()
        raised_by = db.query(models.User).filter(models.User.id == c.raised_by_user_id).first()
        result.append({
            "id": c.id,
            "booking_id": c.booking_id,
            "booking_number": booking.booking_number if booking else "-",
            "service_type": booking.service_type if booking else "-",
            "raised_by": raised_by.email if raised_by else "-",
            "raised_by_role": raised_by.role if raised_by else "-",
            "category": c.category,
            "description": c.description,
            "status": c.status,
            "resolution": c.resolution,
            "created_at": c.created_at.strftime("%d %b %Y, %I:%M %p"),
            "updated_at": c.updated_at.strftime("%d %b %Y, %I:%M %p") if c.updated_at else None,
            "resolved_at": c.resolved_at.strftime("%d %b %Y, %I:%M %p") if c.resolved_at else None
        })
    return result


@router.put("/{complaint_id}/resolve")
def resolve_complaint(
    complaint_id: int,
    data: dict,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cooperative admin resolves or closes a complaint."""
    if user.role != "COOPERATIVE":
        raise HTTPException(status_code=403, detail="Cooperative access required.")

    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    resolution = data.get("resolution", "").strip()
    new_status = data.get("status", "RESOLVED")  # RESOLVED or CLOSED

    if new_status not in ("RESOLVED", "CLOSED", "UNDER_REVIEW"):
        new_status = "RESOLVED"

    complaint.resolution = resolution
    complaint.status = new_status
    complaint.resolved_by_user_id = user.id
    if new_status in ("RESOLVED", "CLOSED"):
        complaint.resolved_at = datetime.datetime.utcnow()
    db.commit()

    # Notify the user who raised the complaint
    db.add(models.Notification(
        user_id=complaint.raised_by_user_id,
        title=f"Complaint {new_status.title()}",
        message=f"Your complaint has been {new_status.lower()} by the cooperative. {resolution[:100] if resolution else ''}",
        type="SUCCESS" if new_status in ("RESOLVED", "CLOSED") else "INFO"
    ))
    db.commit()

    return {
        "success": True,
        "complaint_id": complaint_id,
        "status": complaint.status,
        "message": f"Complaint marked as {new_status}."
    }
