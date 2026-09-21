from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from auth_utils import get_current_user

router = APIRouter(prefix="/api/customer", tags=["customer"])

@router.get("/profile")
def get_customer_profile(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "CUSTOMER" or not user.customer:
        raise HTTPException(status_code=403, detail="Customer access required.")
    return {
        "id": user.customer.id,
        "full_name": user.customer.full_name,
        "email": user.email,
        "mobile": user.mobile,
        "address": user.customer.address,
        "latitude": user.customer.latitude,
        "longitude": user.customer.longitude,
        "created_at": user.customer.created_at
    }

@router.put("/profile")
def update_customer_profile(data: dict, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "CUSTOMER" or not user.customer:
        raise HTTPException(status_code=403, detail="Customer access required.")
    if "address" in data:
        user.customer.address = data["address"]
    if "latitude" in data:
        user.customer.latitude = float(data["latitude"])
    if "longitude" in data:
        user.customer.longitude = float(data["longitude"])
    db.commit()
    return {"success": True, "message": "Location updated successfully."}

@router.get("/bookings")
def get_customer_bookings(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "CUSTOMER" or not user.customer:
        raise HTTPException(status_code=403, detail="Customer access required.")
    
    bookings = db.query(models.Booking).filter(
        models.Booking.customer_id == user.customer.id
    ).order_by(models.Booking.created_at.desc()).all()

    active = []
    previous = []

    for b in bookings:
        worker_info = None
        if b.worker:
            worker_info = {
                "id": b.worker.id,
                "name": b.worker.full_name,
                "mobile": b.worker.mobile,
                "rating": b.worker.rating,
                "photo": b.worker.profile_photo
            }
        
        has_paid = (b.payment and b.payment.status == "PAID") or (getattr(b, "payment_status", None) == "PAID")
        has_rated = b.rating is not None

        item = {
            "id": b.id,
            "booking_number": b.booking_number,
            "service_type": b.service_type,
            "description": b.description,
            "is_emergency": b.is_emergency,
            "emergency_priority": b.emergency_priority,
            "scheduled_date": b.scheduled_date,
            "scheduled_time": b.scheduled_time,
            "customer_address": b.customer_address,
            "status": b.status,
            "payment_status": getattr(b, "payment_status", "PAID" if has_paid else "PENDING"),
            "total_amount": b.total_amount,
            "created_at": b.created_at.isoformat(),
            "worker": worker_info,
            "completion_photo_url": b.completion_photo_url,
            "has_paid": has_paid,
            "has_rated": has_rated,
            "payment": {
                "id": b.payment.id,
                "status": b.payment.status,
                "method": b.payment.payment_method,
                "transaction_id": b.payment.transaction_id,
                "razorpay_payment_id": getattr(b.payment, "razorpay_payment_id", None)
            } if b.payment else None
        }

        if b.status in ["COMPLETED", "CANCELLED"]:
            previous.append(item)
        else:
            active.append(item)

    return {"active": active, "previous": previous}
