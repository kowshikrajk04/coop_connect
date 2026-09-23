from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from auth_utils import get_current_user

router = APIRouter(prefix="/api/cooperative", tags=["cooperative"])

@router.get("/dashboard")
def get_cooperative_dashboard(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "COOPERATIVE":
        raise HTTPException(status_code=403, detail="Cooperative management access required.")

    coop_id = user.cooperative.id if user.cooperative else None

    # Scope all counts to this cooperative's workers and bookings
    total_workers = db.query(models.Worker).filter(
        models.Worker.cooperative_id == coop_id
    ).count() if coop_id else 0

    available_workers = db.query(models.Worker).filter(
        models.Worker.cooperative_id == coop_id,
        models.Worker.status == "VERIFIED",
        models.Worker.is_available == True
    ).count() if coop_id else 0

    pending_workers = db.query(models.Worker).filter(
        models.Worker.cooperative_id == coop_id,
        models.Worker.status == "PENDING_VERIFICATION"
    ).count() if coop_id else 0

    total_bookings = db.query(models.Booking).filter(
        models.Booking.cooperative_id == coop_id
    ).count() if coop_id else 0

    completed_bookings = db.query(models.Booking).filter(
        models.Booking.cooperative_id == coop_id,
        models.Booking.status == "COMPLETED"
    ).count() if coop_id else 0

    # Revenue and Welfare scoped to this cooperative's bookings
    coop_revenue = 0.0
    total_welfare = 0.0
    if coop_id:
        paid_payments = db.query(models.Payment).join(
            models.Booking, models.Payment.booking_id == models.Booking.id
        ).filter(
            models.Booking.cooperative_id == coop_id,
            models.Payment.status == "PAID"
        ).all()
        coop_revenue = sum(p.coop_fee for p in paid_payments)
        total_welfare = sum(p.welfare_contribution for p in paid_payments)

    pending_membership_requests = 0
    if coop_id:
        pending_membership_requests = db.query(models.CooperativeMembership).filter(
            models.CooperativeMembership.cooperative_id == coop_id,
            models.CooperativeMembership.status == "PENDING"
        ).count()

    return {
        "total_workers": total_workers,
        "available_workers": available_workers,
        "pending_verifications": pending_workers,
        "pending_membership_requests": pending_membership_requests,
        "total_bookings": total_bookings,
        "completed_services": completed_bookings,
        "cooperative_revenue": round(coop_revenue, 2),
        "welfare_fund": round(total_welfare, 2)
    }

@router.get("/workers")
def get_cooperative_workers(
    status_filter: str = "ALL",
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user.role != "COOPERATIVE":
        raise HTTPException(status_code=403, detail="Cooperative management access required.")

    coop_id = user.cooperative.id if user.cooperative else -1
    # PENDING_VERIFICATION workers may not yet have a cooperative_id (they apply first, join later).
    # Show all pending workers to any cooperative for review; for other statuses scope to own coop.
    if status_filter == "PENDING_VERIFICATION":
        query = db.query(models.Worker).filter(models.Worker.status == "PENDING_VERIFICATION")
    else:
        query = db.query(models.Worker).filter(models.Worker.cooperative_id == coop_id)
        if status_filter != "ALL":
            query = query.filter(models.Worker.status == status_filter)

    workers = query.order_by(models.Worker.created_at.desc()).all()
    res = []
    for w in workers:
        skills = [s.skill_name for s in w.skills]
        assessments = [{
            "skill": a.skill_name,
            "score": a.score,
            "passed": a.passed,
            "date": a.assessment_date.strftime("%d %b %Y")
        } for a in w.assessments]
        res.append({
            "id": w.id,
            "full_name": w.full_name,
            "mobile": w.mobile,
            "email": w.email,
            "address": w.address,
            "status": w.status,
            "is_available": w.is_available,
            "rating": w.rating,
            "total_jobs": w.total_jobs,
            "completed_jobs": w.completed_jobs,
            "active_jobs": w.active_jobs,
            "opportunity_score": w.opportunity_score,
            "skills": skills,
            "assessments": assessments,
            "profile_photo": w.profile_photo,
            "id_document_url": w.id_document_url,
            "cert_document_url": w.cert_document_url,
            "created_at": w.created_at.strftime("%d %b %Y")
        })
    return res

@router.get("/workers/{worker_id}")
def get_worker_detail(worker_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "COOPERATIVE":
        raise HTTPException(status_code=403, detail="Cooperative management access required.")

    w = db.query(models.Worker).filter(models.Worker.id == worker_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Worker not found.")

    skills = [{"skill_name": s.skill_name, "years_experience": s.years_experience} for s in w.skills]
    assessments = [{
        "id": a.id,
        "skill": a.skill_name,
        "score": a.score,
        "passed": a.passed,
        "language": a.language,
        "voice_transcript": a.voice_transcript,
        "answers_json": a.answers_json,
        "evaluation_summary": a.evaluation_summary,
        "status": a.status or ("APPROVED" if w.status == "VERIFIED" else "PENDING_APPROVAL"),
        "date": a.assessment_date.strftime("%d %b %Y, %I:%M %p")
    } for a in w.assessments]

    return {
        "id": w.id,
        "full_name": w.full_name,
        "mobile": w.mobile,
        "email": w.email,
        "dob": w.dob,
        "address": w.address,
        "status": w.status,
        "skills": skills,
        "assessments": assessments,
        "rating": w.rating,
        "total_jobs": w.total_jobs,
        "completed_jobs": w.completed_jobs,
        "opportunity_score": w.opportunity_score,
        "id_document_url": w.id_document_url,
        "cert_document_url": w.cert_document_url,
        "experience_proof_url": w.experience_proof_url,
        "rejection_reason": w.rejection_reason
    }

@router.post("/workers/{worker_id}/verify")
def verify_worker(
    worker_id: int,
    action_data: schemas.WorkerVerifyAction,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user.role != "COOPERATIVE":
        raise HTTPException(status_code=403, detail="Cooperative management access required.")

    worker = db.query(models.Worker).filter(models.Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found.")

    if action_data.action == "APPROVE":
        worker.status = "VERIFIED"
        worker.rejection_reason = None
        for a in worker.assessments:
            a.status = "APPROVED"
        # Auto-activate membership for this cooperative if worker has no active membership
        if worker.membership_status != "ACTIVE":
            worker.membership_status = "ACTIVE"
            if not worker.cooperative_id and user.cooperative:
                worker.cooperative_id = user.cooperative.id
        message = f"Congratulations! Your worker verification and AI Skill Assessment have been approved by the Cooperative. You are now eligible for customer job allocations."
        notif_type = "SUCCESS"
    elif action_data.action == "REJECT":
        worker.status = "REJECTED"
        worker.rejection_reason = action_data.reason or "Documents or assessment did not meet cooperative standards."
        for a in worker.assessments:
            a.status = "REJECTED"
        message = f"Your worker application was not approved. Reason: {worker.rejection_reason}"
        notif_type = "ALERT"
    elif action_data.action == "REQUEST_REASSESSMENT":
        worker.status = "PENDING_VERIFICATION"
        worker.rejection_reason = action_data.reason or "Cooperative board requested a practical re-assessment."
        for a in worker.assessments:
            a.status = "RE_ASSESSMENT_REQUESTED"
        message = f"Re-Assessment Requested: {action_data.reason or 'Please re-take the AI Voice Skill Assessment to demonstrate trade proficiency.'}"
        notif_type = "INFO"
    else:  # REQUEST_INFO
        worker.status = "PENDING_VERIFICATION"
        message = f"Cooperative requests additional information: {action_data.reason or 'Please upload clearer identification or documents.'}"
        notif_type = "INFO"

    db.commit()

    # Notify worker
    db.add(models.Notification(
        user_id=worker.user_id,
        title=f"Verification Update: {worker.status}",
        message=message,
        type=notif_type
    ))
    db.commit()

    return {"success": True, "status": worker.status, "message": f"Worker {worker.full_name} status updated to {worker.status}."}

@router.get("/fair-allocation")
def get_fair_allocation_metrics(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "COOPERATIVE":
        raise HTTPException(status_code=403, detail="Cooperative management access required.")

    workers = db.query(models.Worker).all()
    if not workers:
        return {
            "empty": True,
            "message": "No workers registered yet.",
            "metrics": []
        }

    all_jobs = [w.completed_jobs + w.active_jobs for w in workers]
    max_jobs = max(1, max(all_jobs))

    metrics = []
    for w in workers:
        worker_jobs = w.completed_jobs + w.active_jobs
        ratio = worker_jobs / max_jobs
        opportunity_factor = max(15.0, 100.0 - (ratio * 80.0))

        if opportunity_factor >= 75.0:
            opp_gap = "High Opportunity Need"
            gap_color = "amber"
        elif opportunity_factor <= 35.0:
            opp_gap = "Heavily Utilized"
            gap_color = "purple"
        else:
            opp_gap = "Balanced"
            gap_color = "emerald"

        metrics.append({
            "worker_id": w.id,
            "worker_name": w.full_name,
            "skills": [s.skill_name for s in w.skills],
            "jobs_received": w.total_jobs,
            "completed_jobs": w.completed_jobs,
            "current_workload": w.active_jobs,
            "opportunity_score": round(opportunity_factor, 1),
            "opportunity_gap": opp_gap,
            "gap_color": gap_color,
            "rating": w.rating,
            "is_available": w.is_available,
            "status": w.status
        })

    return {
        "empty": False,
        "total_workers": len(workers),
        "formula": "Suitable Worker Score = w_skill*Skill + w_success*Success + w_avail*Availability + w_dist*Distance + w_rating*Rating + w_fairness*OpportunityFactor",
        "description": "Fairness-Aware Allocation distributes work equitably among qualified verified members, preventing top-star bias while guaranteeing trade proficiency.",
        "metrics": metrics
    }

@router.get("/welfare")
def get_welfare_summary(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "COOPERATIVE":
        raise HTTPException(status_code=403, detail="Cooperative management access required.")

    coop = db.query(models.Cooperative).first()
    r_pct = coop.reserve_pct if coop else 40.0
    t_pct = coop.training_pct if coop else 25.0
    e_pct = coop.emergency_pct if coop else 20.0
    p_pct = coop.pension_pct if coop else 15.0

    transactions = db.query(models.WelfareTransaction).order_by(
        models.WelfareTransaction.created_at.desc()
    ).all()

    total_welfare = sum(t.amount for t in transactions if t.type == "CREDIT")

    tx_list = []
    for tx in transactions:
        tx_list.append({
            "id": tx.id,
            "date": tx.created_at.strftime("%d %b %Y, %I:%M %p"),
            "worker_name": tx.worker.full_name if tx.worker else "Collective Pool",
            "amount": tx.amount,
            "category": tx.category,
            "type": tx.type,
            "description": tx.description
        })

    return {
        "total_welfare_collected": round(total_welfare, 2),
        "reserve_fund": round(total_welfare * (r_pct / 100.0), 2),
        "training_fund": round(total_welfare * (t_pct / 100.0), 2),
        "emergency_fund": round(total_welfare * (e_pct / 100.0), 2),
        "pension_fund": round(total_welfare * (p_pct / 100.0), 2),
        "breakdown_percentages": {
            "reserve_pct": r_pct,
            "training_pct": t_pct,
            "emergency_pct": e_pct,
            "pension_pct": p_pct
        },
        "transactions": tx_list
    }

@router.get("/settings")
def get_cooperative_settings(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "COOPERATIVE":
        raise HTTPException(status_code=403, detail="Cooperative management access required.")
    
    coop = db.query(models.Cooperative).first()
    if not coop:
        return {
            "service_fee_pct": 5.0,
            "welfare_pct": 5.0,
            "reserve_pct": 40.0,
            "training_pct": 25.0,
            "emergency_pct": 20.0,
            "pension_pct": 15.0
        }
    return {
        "service_fee_pct": coop.service_fee_pct,
        "welfare_pct": coop.welfare_pct,
        "reserve_pct": coop.reserve_pct,
        "training_pct": coop.training_pct,
        "emergency_pct": coop.emergency_pct,
        "pension_pct": coop.pension_pct
    }

@router.put("/settings")
def update_cooperative_settings(
    settings: schemas.CooperativeSettingsUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user.role != "COOPERATIVE":
        raise HTTPException(status_code=403, detail="Cooperative management access required.")

    coop = db.query(models.Cooperative).first()
    if not coop:
        raise HTTPException(status_code=404, detail="Cooperative profile not found.")

    if settings.service_fee_pct is not None:
        coop.service_fee_pct = settings.service_fee_pct
    if settings.welfare_pct is not None:
        coop.welfare_pct = settings.welfare_pct
    if settings.reserve_pct is not None:
        coop.reserve_pct = settings.reserve_pct
    if settings.training_pct is not None:
        coop.training_pct = settings.training_pct
    if settings.emergency_pct is not None:
        coop.emergency_pct = settings.emergency_pct
    if settings.pension_pct is not None:
        coop.pension_pct = settings.pension_pct

    db.commit()
    return {"success": True, "message": "Cooperative financial settings updated successfully."}
