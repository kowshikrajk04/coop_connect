import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
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
        "membership_status": worker.membership_status or "NOT_JOINED",
        "cooperative_id": worker.cooperative_id,
        "cooperative_name": worker.cooperative.name if worker.cooperative else None,
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

import uuid
from pathlib import Path

@router.post("/documents")
async def update_worker_documents(request: Request, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "WORKER" or not user.worker:
        raise HTTPException(status_code=403, detail="Worker access required.")

    content_type = request.headers.get("content-type", "")
    uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    if "multipart/form-data" in content_type:
        form = await request.form()

        # 1. Identity Document file
        id_file = form.get("id_document") or form.get("file") or form.get("document")
        if id_file and hasattr(id_file, "filename") and id_file.filename:
            ext = Path(id_file.filename).suffix.lower()
            safe_name = f"worker_id_{uuid.uuid4().hex[:12]}{ext}"
            file_path = uploads_dir / safe_name
            content = await id_file.read()
            with open(file_path, "wb") as f:
                f.write(content)
            user.worker.id_document_url = f"/uploads/{safe_name}"
        elif form.get("id_document_url"):
            user.worker.id_document_url = str(form.get("id_document_url")).strip()

        # 2. Skill Certificate file
        cert_file = form.get("cert_document") or form.get("certificate")
        if cert_file and hasattr(cert_file, "filename") and cert_file.filename:
            ext = Path(cert_file.filename).suffix.lower()
            safe_name = f"worker_cert_{uuid.uuid4().hex[:12]}{ext}"
            file_path = uploads_dir / safe_name
            content = await cert_file.read()
            with open(file_path, "wb") as f:
                f.write(content)
            user.worker.cert_document_url = f"/uploads/{safe_name}"
        elif form.get("cert_document_url"):
            user.worker.cert_document_url = str(form.get("cert_document_url")).strip()

        # 3. Experience Proof file
        exp_file = form.get("experience_proof") or form.get("exp_document")
        if exp_file and hasattr(exp_file, "filename") and exp_file.filename:
            ext = Path(exp_file.filename).suffix.lower()
            safe_name = f"worker_exp_{uuid.uuid4().hex[:12]}{ext}"
            file_path = uploads_dir / safe_name
            content = await exp_file.read()
            with open(file_path, "wb") as f:
                f.write(content)
            user.worker.experience_proof_url = f"/uploads/{safe_name}"
        elif form.get("experience_proof_url"):
            user.worker.experience_proof_url = str(form.get("experience_proof_url")).strip()

    else:
        body = await request.json()
        payload = schemas.DocumentsUpdatePayload(**body)
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
        passed=req.score >= 60,
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
                "customer_lat": b.customer_lat,
                "customer_lng": b.customer_lng,
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
        if b.status in ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"]:
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

    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    # Mark this worker's allocation as REJECTED
    allocation = db.query(models.WorkerAllocation).filter(
        models.WorkerAllocation.booking_id == booking_id,
        models.WorkerAllocation.worker_id == user.worker.id
    ).first()
    if allocation:
        allocation.status = "REJECTED"
        db.commit()

    # --- RE-ALLOCATION: find next eligible worker ---
    from sqlalchemy.orm import joinedload
    from ml.fairness_allocator import allocator, calculate_distance_km as _dist_km

    # Collect IDs of workers already offered/rejected for this booking
    already_tried = db.query(models.WorkerAllocation.worker_id).filter(
        models.WorkerAllocation.booking_id == booking_id
    ).all()
    excluded_ids = {row[0] for row in already_tried}

    candidates = db.query(models.Worker).options(
        joinedload(models.Worker.skills),
        joinedload(models.Worker.assessments)
    ).filter(
        models.Worker.status == "VERIFIED",
        models.Worker.membership_status == "ACTIVE",
        models.Worker.id.notin_(excluded_ids)
    ).all()

    worker_dicts = []
    for w in candidates:
        skills = [{"skill_name": s.skill_name, "years_experience": s.years_experience} for s in w.skills]
        assessments = [{"skill_name": a.skill_name, "score": a.score} for a in w.assessments]
        worker_dicts.append({
            "id": w.id, "full_name": w.full_name, "mobile": w.mobile,
            "status": w.status, "is_available": w.is_available,
            "latitude": w.latitude, "longitude": w.longitude,
            "rating": w.rating, "total_jobs": w.total_jobs,
            "completed_jobs": w.completed_jobs, "active_jobs": w.active_jobs,
            "skills": skills, "assessments": assessments
        })

    ranked = allocator.rank_workers(
        service_type=booking.service_type,
        customer_lat=booking.customer_lat,
        customer_lng=booking.customer_lng,
        candidate_workers=worker_dicts,
        is_emergency=booking.is_emergency,
        emergency_priority=booking.emergency_priority
    )

    if ranked:
        top = ranked[0]
        next_worker = db.query(models.Worker).filter(models.Worker.id == top["worker_id"]).first()
        booking.worker_id = next_worker.id
        booking.cooperative_id = next_worker.cooperative_id
        booking.status = "ALLOCATED"

        db.add(models.WorkerAllocation(
            booking_id=booking.id,
            worker_id=next_worker.id,
            suitability_score=top["suitability_score"],
            skill_score=top["skill_score"],
            success_score=top["success_score"],
            availability_score=top["availability_score"],
            distance_score=top["distance_score"],
            rating_score=top["rating_score"],
            fairness_factor=top["fairness_factor"],
            status="OFFERED"
        ))

        # Notify new worker
        db.add(models.Notification(
            user_id=next_worker.user_id,
            title=f"New Job Opportunity: {booking.service_type}",
            message=f"You have been allocated booking #{booking.booking_number} at {booking.customer_address}.",
            type="INFO"
        ))
        # Notify customer of reallocation
        if booking.customer:
            db.add(models.Notification(
                user_id=booking.customer.user_id,
                title="Worker Reassigned",
                message=f"Your previous worker was unavailable. {next_worker.full_name} has been matched to your booking.",
                type="INFO"
            ))
        db.commit()
        return {"success": True, "message": "Job rejected. Booking reallocated to next eligible worker.", "reallocated": True}
    else:
        # No other worker available — reset booking to REQUESTED
        booking.worker_id = None
        booking.cooperative_id = None
        booking.status = "REQUESTED"
        if booking.customer:
            db.add(models.Notification(
                user_id=booking.customer.user_id,
                title="Searching for Worker",
                message="Your previous worker was unavailable. We are searching for another verified worker for your booking.",
                type="INFO"
            ))
        db.commit()
        return {"success": True, "message": "Job rejected. No other workers available right now. Booking reset to searching.", "reallocated": False}


@router.post("/jobs/{booking_id}/on_the_way")
def mark_on_the_way(booking_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "WORKER" or not user.worker:
        raise HTTPException(status_code=403, detail="Worker access required.")

    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id,
        models.Booking.worker_id == user.worker.id
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.status != "ACCEPTED":
        raise HTTPException(status_code=400, detail=f"Cannot mark On The Way from status '{booking.status}'. Job must be ACCEPTED first.")

    booking.status = "ON_THE_WAY"
    db.commit()

    if booking.customer:
        db.add(models.Notification(
            user_id=booking.customer.user_id,
            title="Worker On The Way",
            message=f"{user.worker.full_name} is on the way to your location for {booking.service_type}.",
            type="INFO"
        ))
        db.commit()

    return {"success": True, "message": "Status updated: On The Way.", "status": "ON_THE_WAY"}


@router.post("/jobs/{booking_id}/arrived")
def mark_arrived(booking_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "WORKER" or not user.worker:
        raise HTTPException(status_code=403, detail="Worker access required.")

    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id,
        models.Booking.worker_id == user.worker.id
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.status != "ON_THE_WAY":
        raise HTTPException(status_code=400, detail=f"Cannot mark Arrived from status '{booking.status}'. Must be ON_THE_WAY first.")

    booking.status = "ARRIVED"
    db.commit()

    if booking.customer:
        db.add(models.Notification(
            user_id=booking.customer.user_id,
            title="Worker Arrived",
            message=f"{user.worker.full_name} has arrived at your location and is ready to begin {booking.service_type}.",
            type="SUCCESS"
        ))
        db.commit()

    return {"success": True, "message": "Status updated: Arrived.", "status": "ARRIVED"}


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

    # Allow starting from ACCEPTED, ON_THE_WAY, or ARRIVED
    if booking.status not in ("ACCEPTED", "ON_THE_WAY", "ARRIVED"):
        raise HTTPException(status_code=400, detail=f"Cannot start service from status '{booking.status}'.")

    booking.status = "IN_PROGRESS"
    db.commit()

    if booking.customer:
        db.add(models.Notification(
            user_id=booking.customer.user_id,
            title="Service Started",
            message=f"{user.worker.full_name} has started the {booking.service_type} service at your location.",
            type="INFO"
        ))
        db.commit()

    return {"success": True, "message": "Service marked as In Progress.", "status": "IN_PROGRESS"}

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
    # Consistent with payments.py verify_payment: welfare is a SEPARATE cooperative contribution,
    # NOT deducted from worker payout. Worker receives service_amount minus coop_fee only.
    worker_payout = round(service_amount - coop_fee, 2)

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
        models.Booking.status.in_(["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"])
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
