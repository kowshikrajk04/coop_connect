import random
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from database import get_db
import models
import schemas
from auth_utils import get_current_user
from ml.fairness_allocator import allocator, calculate_distance_km

router = APIRouter(prefix="/api/bookings", tags=["bookings"])

@router.post("", response_model=dict)
def create_booking(
    req: schemas.BookingCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user.role != "CUSTOMER" or not user.customer:
        raise HTTPException(status_code=403, detail="Customer access required to request a service.")

    # 1. Emergency Priority Check
    priority = allocator.evaluate_emergency_priority(req.is_emergency, req.emergency_reason)
    
    # 2. Base pricing logic per trade
    base_pricing = {
        "Electrician": 450.0,
        "Plumber": 450.0,
        "Carpenter": 500.0,
        "Painter": 600.0,
        "Domestic Helper": 400.0,
        "Caregiver": 700.0,
        "Driver": 600.0,
        "Gardener": 450.0,
        "Cleaner": 400.0,
        "Technician": 550.0
    }
    total_amount = base_pricing.get(req.service_type, 500.0)
    if req.is_emergency:
        total_amount += 150.0  # Emergency response surcharge

    # 3. Create Booking record
    booking_number = f"CC-{random.randint(10000, 99999)}"
    new_booking = models.Booking(
        booking_number=booking_number,
        customer_id=user.customer.id,
        service_type=req.service_type,
        description=req.description,
        is_emergency=req.is_emergency,
        emergency_reason=req.emergency_reason,
        emergency_priority=priority,
        scheduled_date=req.scheduled_date,
        scheduled_time=req.scheduled_time,
        customer_address=req.customer_address,
        customer_lat=req.customer_lat or user.customer.latitude,
        customer_lng=req.customer_lng or user.customer.longitude,
        service_photo_url=req.service_photo_url,
        total_amount=total_amount,
        status="REQUESTED"
    )
    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)

    # 4. Find all eligible verified workers who are ACTIVE cooperative members
    candidates = db.query(models.Worker).options(
        joinedload(models.Worker.skills),
        joinedload(models.Worker.assessments)
    ).filter(
        models.Worker.status == "VERIFIED",
        models.Worker.membership_status == "ACTIVE"
    ).all()

    worker_dicts = []
    for w in candidates:
        skills = [{"skill_name": s.skill_name, "years_experience": s.years_experience} for s in w.skills]
        assessments = [{"skill_name": a.skill_name, "score": a.score} for a in w.assessments]
        worker_dicts.append({
            "id": w.id,
            "full_name": w.full_name,
            "mobile": w.mobile,
            "status": w.status,
            "is_available": w.is_available,
            "latitude": w.latitude,
            "longitude": w.longitude,
            "rating": w.rating,
            "total_jobs": w.total_jobs,
            "completed_jobs": w.completed_jobs,
            "active_jobs": w.active_jobs,
            "skills": skills,
            "assessments": assessments
        })

    # 5. Run Fairness-Aware AI Allocation
    ranked = allocator.rank_workers(
        service_type=req.service_type,
        customer_lat=new_booking.customer_lat,
        customer_lng=new_booking.customer_lng,
        candidate_workers=worker_dicts,
        is_emergency=req.is_emergency,
        emergency_priority=priority
    )

    allocated_worker = None
    allocation_info = None

    if ranked:
        top_match = ranked[0]
        selected_worker = db.query(models.Worker).filter(models.Worker.id == top_match["worker_id"]).first()
        
        new_booking.worker_id = selected_worker.id
        new_booking.cooperative_id = selected_worker.cooperative_id
        new_booking.status = "ALLOCATED"

        # Record allocation audit trail
        allocation_record = models.WorkerAllocation(
            booking_id=new_booking.id,
            worker_id=selected_worker.id,
            suitability_score=top_match["suitability_score"],
            skill_score=top_match["skill_score"],
            success_score=top_match["success_score"],
            availability_score=top_match["availability_score"],
            distance_score=top_match["distance_score"],
            rating_score=top_match["rating_score"],
            fairness_factor=top_match["fairness_factor"],
            status="OFFERED"
        )
        db.add(allocation_record)

        # Notify Worker
        db.add(models.Notification(
            user_id=selected_worker.user_id,
            title=f"New Job Opportunity: {req.service_type}",
            message=f"You have been fairly allocated a new booking ({booking_number}) at {req.customer_address}.",
            type="INFO"
        ))

        # Notify Customer
        db.add(models.Notification(
            user_id=user.id,
            title="Worker Allocated",
            message=f"Verified cooperative worker {selected_worker.full_name} has been matched to your request.",
            type="SUCCESS"
        ))

        db.commit()

        allocated_worker = {
            "id": selected_worker.id,
            "name": selected_worker.full_name,
            "mobile": selected_worker.mobile,
            "rating": selected_worker.rating,
            "distance_km": top_match["distance_km"]
        }
        allocation_info = top_match

    return {
        "success": True,
        "id": new_booking.id,
        "booking_id": new_booking.id,
        "booking_number": new_booking.booking_number,
        "status": new_booking.status,
        "service_type": new_booking.service_type,
        "is_emergency": new_booking.is_emergency,
        "emergency_priority": new_booking.emergency_priority,
        "total_amount": new_booking.total_amount,
        "allocated_worker": allocated_worker,
        "allocation_metrics": allocation_info,
        "message": "Fairness-aware allocation completed." if allocated_worker else "Booking registered. Currently searching for an available verified cooperative worker in your area."
    }

@router.get("/{booking_id}")
def get_booking_details(booking_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found.")

    worker_info = None
    if b.worker:
        dist = calculate_distance_km(b.customer_lat, b.customer_lng, b.worker.latitude, b.worker.longitude)
        worker_info = {
            "id": b.worker.id,
            "full_name": b.worker.full_name,
            "mobile": b.worker.mobile,
            "rating": b.worker.rating,
            "completed_jobs": b.worker.completed_jobs,
            "latitude": b.worker.latitude,
            "longitude": b.worker.longitude,
            "distance_km": dist
        }

    return {
        "id": b.id,
        "booking_number": b.booking_number,
        "service_type": b.service_type,
        "description": b.description,
        "is_emergency": b.is_emergency,
        "emergency_priority": b.emergency_priority,
        "emergency_reason": b.emergency_reason,
        "scheduled_date": b.scheduled_date,
        "scheduled_time": b.scheduled_time,
        "customer_address": b.customer_address,
        "customer_lat": b.customer_lat,
        "customer_lng": b.customer_lng,
        "status": b.status,
        "total_amount": b.total_amount,
        "completion_photo_url": b.completion_photo_url,
        "completion_notes": b.completion_notes,
        "created_at": b.created_at.isoformat(),
        "customer": {
            "name": b.customer.full_name,
            "mobile": b.customer.user.mobile if b.customer.user else ""
        } if b.customer else None,
        "worker": worker_info,
        "payment": {
            "id": b.payment.id,
            "status": b.payment.status,
            "service_amount": b.payment.service_amount,
            "coop_fee": b.payment.coop_fee,
            "worker_payout": b.payment.worker_payout,
            "welfare_contribution": b.payment.welfare_contribution,
            "method": b.payment.payment_method
        } if b.payment else None,
        "rating": {
            "stars": b.rating.stars,
            "feedback": b.rating.feedback
        } if b.rating else None
    }
