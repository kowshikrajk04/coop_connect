import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from auth_utils import get_current_user
from ml.assessment_data import get_trade_assessment_questions, evaluate_worker_voice_answer
from ml.fairness_allocator import calculate_distance_km

router = APIRouter(prefix="/api/worker", tags=["worker"])

@router.get("/profile")
def get_worker_profile(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "WORKER" or not user.worker:
        raise HTTPException(status_code=403, detail="Worker access required.")
    
    worker = user.worker
    skills = [{"id": s.id, "skill_name": s.skill_name, "years_experience": s.years_experience} for s in worker.skills]
    assessments = [{
        "id": a.id,
        "skill_name": a.skill_name,
        "score": a.score,
        "passed": a.passed,
        "language": a.language,
        "voice_transcript": a.voice_transcript,
        "evaluation_summary": a.evaluation_summary,
        "status": a.status,
        "assessment_date": a.assessment_date.isoformat()
    } for a in worker.assessments]

    # Calculate earnings and welfare
    completed_bookings = db.query(models.Booking).filter(
        models.Booking.worker_id == worker.id,
        models.Booking.status == "COMPLETED"
    ).all()
    
    total_earnings = 0.0
    for b in completed_bookings:
        if b.payment and b.payment.status == "PAID":
            total_earnings += b.payment.worker_payout

    # Welfare contributions credited on worker's behalf
    welfare_credits = db.query(models.WelfareTransaction).filter(
        models.WelfareTransaction.worker_id == worker.id
    ).all()
    total_welfare = sum(w.amount for w in welfare_credits)

    return {
        "id": worker.id,
        "full_name": worker.full_name,
        "email": worker.email,
        "mobile": worker.mobile,
        "dob": worker.dob,
        "address": worker.address,
        "latitude": worker.latitude,
        "longitude": worker.longitude,
        "profile_photo": worker.profile_photo,
        "id_document_url": worker.id_document_url,
        "cert_document_url": worker.cert_document_url,
        "status": worker.status,
        "is_available": worker.is_available,
        "rating": worker.rating,
        "total_jobs": worker.total_jobs,
        "completed_jobs": worker.completed_jobs,
        "active_jobs": worker.active_jobs,
        "opportunity_score": worker.opportunity_score,
        "skills": skills,
        "assessments": assessments,
        "total_earnings": round(total_earnings, 2),
        "total_welfare": round(total_welfare, 2),
        "created_at": worker.created_at.isoformat()
    }

@router.post("/skills")
def update_worker_skills(payload: schemas.SkillsUpdatePayload, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "WORKER" or not user.worker:
        raise HTTPException(status_code=403, detail="Worker access required.")
    
    # Remove existing skills and insert new
    db.query(models.WorkerSkill).filter(models.WorkerSkill.worker_id == user.worker.id).delete()
    for s in payload.skills:
        if s.skill_name:
            db.add(models.WorkerSkill(worker_id=user.worker.id, skill_name=s.skill_name, years_experience=s.years_experience))
    
    db.commit()
    return {"success": True, "message": "Skills updated successfully."}

@router.post("/documents")
def update_worker_documents(payload: schemas.DocumentsUpdatePayload, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "WORKER" or not user.worker:
        raise HTTPException(status_code=403, detail="Worker access required.")
    
    if payload.id_document_url:
        user.worker.id_document_url = payload.id_document_url
    if payload.cert_document_url:
        user.worker.cert_document_url = payload.cert_document_url
    if payload.experience_proof_url:
        user.worker.experience_proof_url = payload.experience_proof_url
    
    db.commit()
    return {"success": True, "message": "Verification documents recorded."}

@router.get("/assessment/questions")
def get_assessment_questions(skill: str = "Electrician", lang: str = "en"):
    questions = get_trade_assessment_questions(skill, lang)
    return {"skill": skill, "language": lang, "questions": questions}

@router.post("/assessment/evaluate-answer")
def evaluate_single_answer(req: schemas.VoiceAnswerEvaluateRequest):
    result = evaluate_worker_voice_answer(
        question_id=req.question_id,
        skill_name=req.skill_name,
        spoken_text=req.spoken_text,
        selected_option_idx=req.selected_option_idx,
        language=req.language
    )
    return result

@router.post("/assessment/submit")
def submit_skill_assessment(
    req: schemas.SkillAssessmentSubmit,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user.role != "WORKER" or not user.worker:
        raise HTTPException(status_code=403, detail="Worker access required.")

    assessment = models.SkillAssessment(
        worker_id=user.worker.id,
        skill_name=req.skill_name,
        score=req.score,
        passed=req.passed,
        language=req.language,
        answers_json=req.answers_json,
        voice_transcript=req.voice_transcript,
        evaluation_summary=req.evaluation_summary,
        status="PENDING_APPROVAL",
        assessment_date=datetime.datetime.utcnow()
    )
    db.add(assessment)
    
    # Check if worker already has a registered skill for this
    existing_skill = db.query(models.WorkerSkill).filter(
        models.WorkerSkill.worker_id == user.worker.id,
        models.WorkerSkill.skill_name == req.skill_name
    ).first()
    if not existing_skill:
        db.add(models.WorkerSkill(worker_id=user.worker.id, skill_name=req.skill_name, years_experience=2))

    # Assessment submitted -> Worker is queued for cooperative review
    user.worker.status = "PENDING_VERIFICATION"
    db.commit()

    return {
        "success": True,
        "message": "Skill assessment submitted successfully. Your profile is queued for Cooperative Verification.",
        "score": req.score,
        "passed": req.passed,
        "status": "PENDING_APPROVAL"
    }

@router.post("/toggle-availability")
def toggle_availability(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "WORKER" or not user.worker:
        raise HTTPException(status_code=403, detail="Worker access required.")
    
    user.worker.is_available = not user.worker.is_available
    db.commit()
    return {
        "success": True,
        "is_available": user.worker.is_available,
        "message": "Worker status is now " + ("Available" if user.worker.is_available else "Offline")
    }

@router.get("/jobs")
def get_worker_jobs(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "WORKER" or not user.worker:
        raise HTTPException(status_code=403, detail="Worker access required.")
    
    worker_id = user.worker.id

    # New requests allocated to this worker but pending worker acceptance
    new_allocations = db.query(models.WorkerAllocation).filter(
        models.WorkerAllocation.worker_id == worker_id,
        models.WorkerAllocation.status == "OFFERED"
    ).all()

    new_requests = []
    for alloc in new_allocations:
        b = alloc.booking
        if b and b.status == "ALLOCATED":
            dist = calculate_distance_km(user.worker.latitude, user.worker.longitude, b.customer_lat, b.customer_lng)
            new_requests.append({
                "allocation_id": alloc.id,
                "booking_id": b.id,
                "booking_number": b.booking_number,
                "service_type": b.service_type,
                "description": b.description,
                "is_emergency": b.is_emergency,
                "emergency_priority": b.emergency_priority,
                "scheduled_date": b.scheduled_date,
                "scheduled_time": b.scheduled_time,
                "customer_address": b.customer_address,
                "customer_name": b.customer.full_name if b.customer else "Customer",
                "customer_mobile": b.customer.user.mobile if b.customer and b.customer.user else "",
                "distance_km": dist,
                "suitability_score": alloc.suitability_score,
                "fairness_factor": alloc.fairness_factor,
                "total_amount": b.total_amount
            })

    # Active and upcoming jobs accepted by this worker
    active_jobs = []
    completed_jobs = []
    
    all_worker_bookings = db.query(models.Booking).filter(
        models.Booking.worker_id == worker_id
    ).order_by(models.Booking.created_at.desc()).all()

    for b in all_worker_bookings:
        dist = calculate_distance_km(user.worker.latitude, user.worker.longitude, b.customer_lat, b.customer_lng)
        job_item = {
            "booking_id": b.id,
            "booking_number": b.booking_number,
            "service_type": b.service_type,
            "description": b.description,
            "is_emergency": b.is_emergency,
            "scheduled_date": b.scheduled_date,
            "scheduled_time": b.scheduled_time,
            "customer_address": b.customer_address,
            "customer_lat": b.customer_lat,
            "customer_lng": b.customer_lng,
            "customer_name": b.customer.full_name if b.customer else "Customer",
            "customer_mobile": b.customer.user.mobile if b.customer and b.customer.user else "",
            "distance_km": dist,
            "status": b.status,
            "total_amount": b.total_amount,
            "completion_photo_url": b.completion_photo_url,
            "completion_notes": b.completion_notes,
            "created_at": b.created_at.isoformat(),
            "payout": b.payment.worker_payout if b.payment else round(b.total_amount * 0.9, 2)
        }
        if b.status in ["ACCEPTED", "IN_PROGRESS"]:
            active_jobs.append(job_item)
        elif b.status == "COMPLETED":
            completed_jobs.append(job_item)

    return {
        "new_requests": new_requests,
        "active_jobs": active_jobs,
        "completed_jobs": completed_jobs
    }

@router.post("/jobs/{booking_id}/accept")
def accept_job(booking_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "WORKER" or not user.worker:
        raise HTTPException(status_code=403, detail="Worker access required.")

    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    allocation = db.query(models.WorkerAllocation).filter(
        models.WorkerAllocation.booking_id == booking_id,
        models.WorkerAllocation.worker_id == user.worker.id
    ).first()
    if allocation:
        allocation.status = "ACCEPTED"

    booking.worker_id = user.worker.id
    booking.status = "ACCEPTED"
    user.worker.active_jobs += 1
    db.commit()

    # Create notification for customer
    if booking.customer:
        db.add(models.Notification(
            user_id=booking.customer.user_id,
            title="Worker Assigned",
            message=f"{user.worker.full_name} has accepted your service booking ({booking.service_type}).",
            type="SUCCESS"
        ))
        db.commit()

    return {"success": True, "message": "Job accepted successfully."}

@router.post("/jobs/{booking_id}/reject")
def reject_job(booking_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "WORKER" or not user.worker:
        raise HTTPException(status_code=403, detail="Worker access required.")

    allocation = db.query(models.WorkerAllocation).filter(
        models.WorkerAllocation.booking_id == booking_id,
        models.WorkerAllocation.worker_id == user.worker.id
    ).first()
    if allocation:
        allocation.status = "REJECTED"
        db.commit()

    return {"success": True, "message": "Job rejected."}

@router.post("/jobs/{booking_id}/start")
def start_job(booking_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "WORKER" or not user.worker:
        raise HTTPException(status_code=403, detail="Worker access required.")

    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id,
        models.Booking.worker_id == user.worker.id
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    booking.status = "IN_PROGRESS"
    db.commit()

    if booking.customer:
        db.add(models.Notification(
            user_id=booking.customer.user_id,
            title="Service Started",
            message=f"{user.worker.full_name} has arrived and started the service.",
            type="INFO"
        ))
        db.commit()

    return {"success": True, "message": "Service marked as In Progress."}

@router.post("/jobs/{booking_id}/complete")
def complete_job(
    booking_id: int,
    data: schemas.ServiceCompletionSubmit,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user.role != "WORKER" or not user.worker:
        raise HTTPException(status_code=403, detail="Worker access required.")

    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id,
        models.Booking.worker_id == user.worker.id
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    booking.status = "COMPLETED"
    booking.completion_photo_url = data.completion_photo_url or "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=400&q=80"
    booking.completion_notes = data.completion_notes or "Service completed satisfactorily."
    booking.completed_at = datetime.datetime.utcnow()

    # Update worker statistics
    user.worker.completed_jobs += 1
    user.worker.total_jobs += 1
    if user.worker.active_jobs > 0:
        user.worker.active_jobs -= 1

    # Create payment record
    service_amount = booking.total_amount
    coop_fee_pct = 5.0
    welfare_pct = 5.0
    
    coop = db.query(models.Cooperative).first()
    if coop:
        coop_fee_pct = coop.service_fee_pct
        welfare_pct = coop.welfare_pct

    coop_fee = round(service_amount * (coop_fee_pct / 100.0), 2)
    welfare_contrib = round(service_amount * (welfare_pct / 100.0), 2)
    worker_payout = round(service_amount - coop_fee - welfare_contrib, 2)

    payment = models.Payment(
        booking_id=booking.id,
        service_amount=service_amount,
        coop_fee=coop_fee,
        worker_payout=worker_payout,
        welfare_contribution=welfare_contrib,
        payment_method="UPI",
        status="PENDING"
    )
    db.add(payment)

    # Add welfare transaction
    if coop:
        db.add(models.WelfareTransaction(
            cooperative_id=coop.id,
            worker_id=user.worker.id,
            booking_id=booking.id,
            amount=welfare_contrib,
            category="RESERVE",
            type="CREDIT",
            description=f"Welfare contribution from Booking #{booking.booking_number} ({booking.service_type})"
        ))

    db.commit()

    if booking.customer:
        db.add(models.Notification(
            user_id=booking.customer.user_id,
            title="Service Completed",
            message=f"Service completed successfully. Please review payment breakdown of ₹{service_amount}.",
            type="SUCCESS"
        ))
        db.commit()

    return {
        "success": True,
        "message": "Service completed successfully.",
        "payout": worker_payout,
        "welfare": welfare_contrib
    }

@router.get("/route-optimization")
def get_optimized_route(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "WORKER" or not user.worker:
        raise HTTPException(status_code=403, detail="Worker access required.")

    # Get active/accepted jobs for today
    active_jobs = db.query(models.Booking).filter(
        models.Booking.worker_id == user.worker.id,
        models.Booking.status.in_(["ACCEPTED", "IN_PROGRESS"])
    ).all()

    if not active_jobs:
        return {
            "has_active_jobs": False,
            "message": "No active bookings to optimize right now.",
            "stops": []
        }

    # Sort waypoints by shortest distance from worker start position (Greedy TSP)
    current_lat = user.worker.latitude
    current_lng = user.worker.longitude
    
    unvisited = list(active_jobs)
    ordered_stops = []
    total_distance_km = 0.0

    while unvisited:
        # Find nearest next stop
        unvisited.sort(key=lambda b: calculate_distance_km(current_lat, current_lng, b.customer_lat, b.customer_lng))
        next_job = unvisited.pop(0)
        dist = calculate_distance_km(current_lat, current_lng, next_job.customer_lat, next_job.customer_lng)
        total_distance_km += dist
        eta_minutes = int(dist * 4 + 10)  # Approx 15 km/h city speed + 10 min buffer

        ordered_stops.append({
            "booking_id": next_job.id,
            "booking_number": next_job.booking_number,
            "service_type": next_job.service_type,
            "customer_name": next_job.customer.full_name if next_job.customer else "Customer",
            "customer_mobile": next_job.customer.user.mobile if next_job.customer and next_job.customer.user else "",
            "address": next_job.customer_address,
            "lat": next_job.customer_lat,
            "lng": next_job.customer_lng,
            "distance_from_previous_km": dist,
            "eta_minutes": eta_minutes,
            "navigation_url": f"https://www.google.com/maps/dir/?api=1&destination={next_job.customer_lat},{next_job.customer_lng}"
        })
        current_lat = next_job.customer_lat
        current_lng = next_job.customer_lng

    return {
        "has_active_jobs": True,
        "worker_start": {
            "lat": user.worker.latitude,
            "lng": user.worker.longitude,
            "address": user.worker.address
        },
        "total_distance_km": round(total_distance_km, 1),
        "total_stops": len(ordered_stops),
        "stops": ordered_stops,
        "next_customer": ordered_stops[0] if ordered_stops else None
    }
