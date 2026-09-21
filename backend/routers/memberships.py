import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from database import get_db
import models
import schemas
from auth_utils import get_current_user

router = APIRouter(prefix="/api/memberships", tags=["memberships"])


@router.get("/cooperatives", response_model=List[schemas.VerifiedCooperativeOut])
def list_verified_cooperatives(db: Session = Depends(get_db)):
    """
    List all verified cooperatives available for worker membership.
    """
    coops = db.query(models.Cooperative).filter(
        models.Cooperative.status == "APPROVED"
    ).order_by(models.Cooperative.name.asc()).all()
    return coops


@router.post("/request")
def request_membership(
    payload: schemas.MembershipRequestCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Worker submits a request to join or verify membership with a cooperative.
    Enforces single active membership and duplicate request rules.
    """
    if user.role != "WORKER" or not user.worker:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only registered workers can submit membership requests."
        )

    worker = user.worker

    # Rule: Single active membership rule
    if worker.membership_status == "ACTIVE" and worker.cooperative_id:
        current_coop = db.query(models.Cooperative).filter(models.Cooperative.id == worker.cooperative_id).first()
        coop_name = current_coop.name if current_coop else "another cooperative"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Worker already has an active cooperative membership with {coop_name}. You must withdraw or transfer your existing membership before joining another."
        )

    # Check for existing pending request
    existing_pending = db.query(models.CooperativeMembership).filter(
        models.CooperativeMembership.worker_id == worker.id,
        models.CooperativeMembership.status == "PENDING"
    ).first()

    if existing_pending:
        coop_name = existing_pending.cooperative.name if existing_pending.cooperative else "a cooperative"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You already have a pending membership request submitted to {coop_name}. Please await cooperative review."
        )

    # Validate target cooperative
    target_coop = db.query(models.Cooperative).filter(
        models.Cooperative.id == payload.cooperative_id
    ).first()
    if not target_coop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cooperative not found.")

    # Create new membership request
    req = models.CooperativeMembership(
        worker_id=worker.id,
        cooperative_id=target_coop.id,
        status="PENDING",
        membership_type=payload.membership_type or "JOIN_REQUEST",
        notes=payload.notes,
        requested_at=datetime.datetime.utcnow()
    )
    db.add(req)

    # Update worker membership status
    worker.membership_status = "PENDING"
    db.commit()
    db.refresh(req)

    # In-App Notification to Cooperative Admin
    skill_names = [s.skill_name for s in worker.skills]
    skill_str = ", ".join(skill_names) if skill_names else "Tradesperson"
    req_type_label = "Existing Member Verification" if payload.membership_type == "EXISTING_MEMBER" else "New Membership Application"

    db.add(models.Notification(
        user_id=target_coop.user_id,
        title="New Membership Request",
        message=f"Worker {worker.full_name} ({skill_str}) submitted a {req_type_label}.",
        type="INFO"
    ))
    db.commit()

    return {
        "success": True,
        "request_id": req.id,
        "cooperative_id": target_coop.id,
        "cooperative_name": target_coop.name,
        "status": "PENDING",
        "membership_type": req.membership_type,
        "message": f"Your membership request has been submitted to {target_coop.name}."
    }


@router.get("/my-status", response_model=schemas.WorkerMembershipStatusOut)
def get_my_membership_status(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Worker checks their current membership status, active cooperative, and latest request details.
    """
    if user.role != "WORKER" or not user.worker:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Worker access required.")

    worker = user.worker

    # Latest request
    latest_req = db.query(models.CooperativeMembership).filter(
        models.CooperativeMembership.worker_id == worker.id
    ).order_by(models.CooperativeMembership.created_at.desc()).first()

    latest_dict = None
    if latest_req:
        latest_dict = {
            "id": latest_req.id,
            "cooperative_id": latest_req.cooperative_id,
            "cooperative_name": latest_req.cooperative.name if latest_req.cooperative else None,
            "status": latest_req.status,
            "membership_type": latest_req.membership_type,
            "rejection_reason": latest_req.rejection_reason,
            "notes": latest_req.notes,
            "requested_at": latest_req.requested_at.isoformat() if latest_req.requested_at else None,
            "approved_at": latest_req.approved_at.isoformat() if latest_req.approved_at else None,
            "rejected_at": latest_req.rejected_at.isoformat() if latest_req.rejected_at else None,
        }

    # Active membership
    active_dict = None
    coop_name = None
    coop_reg = None
    if worker.cooperative_id and worker.membership_status == "ACTIVE":
        coop = db.query(models.Cooperative).filter(models.Cooperative.id == worker.cooperative_id).first()
        if coop:
            coop_name = coop.name
            coop_reg = coop.registration_number
            active_dict = {
                "cooperative_id": coop.id,
                "cooperative_name": coop.name,
                "registration_number": coop.registration_number,
                "contact_person": coop.contact_person,
                "mobile": coop.mobile,
                "email": coop.email,
                "address": coop.address,
            }

    return schemas.WorkerMembershipStatusOut(
        membership_status=worker.membership_status or "NOT_JOINED",
        worker_status=worker.status,
        cooperative_id=worker.cooperative_id,
        cooperative_name=coop_name,
        cooperative_registration=coop_reg,
        active_membership=active_dict,
        latest_request=latest_dict
    )


@router.get("/cooperative-requests")
def get_cooperative_requests(
    status_filter: str = "ALL",
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cooperative Admin views pending and past membership requests.
    """
    if user.role != "COOPERATIVE" or not user.cooperative:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cooperative management access required."
        )

    coop = user.cooperative

    query = db.query(models.CooperativeMembership).options(
        joinedload(models.CooperativeMembership.worker).joinedload(models.Worker.skills),
        joinedload(models.CooperativeMembership.worker).joinedload(models.Worker.assessments)
    ).filter(
        models.CooperativeMembership.cooperative_id == coop.id
    )

    if status_filter != "ALL":
        query = query.filter(models.CooperativeMembership.status == status_filter)

    records = query.order_by(models.CooperativeMembership.requested_at.desc()).all()

    results = []
    for r in records:
        w = r.worker
        skills = [s.skill_name for s in w.skills] if w else []
        exp = max([s.years_experience for s in w.skills], default=1) if w and w.skills else 1
        assessments = [{
            "skill": a.skill_name,
            "score": a.score,
            "passed": a.passed
        } for a in w.assessments] if w else []

        results.append({
            "id": r.id,
            "worker_id": r.worker_id,
            "worker_name": w.full_name if w else "Unknown Worker",
            "worker_mobile": w.mobile if w else "",
            "worker_email": w.email if w else "",
            "worker_address": w.address if w else "",
            "worker_photo": w.profile_photo if w else None,
            "worker_status": w.status if w else "PENDING_VERIFICATION",
            "worker_rating": w.rating if w else 5.0,
            "worker_skills": skills,
            "years_experience": exp,
            "assessments": assessments,
            "id_document_url": w.id_document_url if w else None,
            "cert_document_url": w.cert_document_url if w else None,
            "experience_proof_url": w.experience_proof_url if w else None,
            "status": r.status,
            "membership_type": r.membership_type,
            "notes": r.notes,
            "rejection_reason": r.rejection_reason,
            "requested_at": r.requested_at.isoformat() if r.requested_at else None,
            "approved_at": r.approved_at.isoformat() if r.approved_at else None,
            "rejected_at": r.rejected_at.isoformat() if r.rejected_at else None,
        })

    return results


@router.post("/requests/{request_id}/approve")
def approve_membership_request(
    request_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cooperative Admin accepts a membership request.
    Activates worker membership and sets worker.cooperative_id.
    """
    if user.role != "COOPERATIVE" or not user.cooperative:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cooperative management access required."
        )

    coop = user.cooperative

    req = db.query(models.CooperativeMembership).filter(
        models.CooperativeMembership.id == request_id,
        models.CooperativeMembership.cooperative_id == coop.id
    ).first()

    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership request not found.")

    if req.status == "APPROVED":
        return {"success": True, "message": "Membership is already approved."}

    worker = db.query(models.Worker).filter(models.Worker.id == req.worker_id).first()
    if not worker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker profile not found.")

    # Update membership record
    req.status = "APPROVED"
    req.approved_at = datetime.datetime.utcnow()
    req.rejection_reason = None

    # Update worker status and assign cooperative
    worker.cooperative_id = coop.id
    worker.membership_status = "ACTIVE"

    # Close any other pending requests for this worker
    other_pending = db.query(models.CooperativeMembership).filter(
        models.CooperativeMembership.worker_id == worker.id,
        models.CooperativeMembership.id != req.id,
        models.CooperativeMembership.status == "PENDING"
    ).all()
    for op in other_pending:
        op.status = "REJECTED"
        op.rejected_at = datetime.datetime.utcnow()
        op.rejection_reason = f"Worker accepted into {coop.name}."

    db.commit()

    # Send Notification to Worker
    db.add(models.Notification(
        user_id=worker.user_id,
        title="Membership Approved! 🎉",
        message=f"Congratulations! Your membership in {coop.name} has been approved. You are now an active member and eligible for customer job allocations.",
        type="SUCCESS"
    ))
    db.commit()

    return {
        "success": True,
        "message": f"Worker {worker.full_name} is now an active member of {coop.name}.",
        "membership_status": "ACTIVE",
        "worker_id": worker.id
    }


@router.post("/requests/{request_id}/reject")
def reject_membership_request(
    request_id: int,
    payload: schemas.MembershipRejectPayload,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cooperative Admin rejects a membership request with an optional reason.
    """
    if user.role != "COOPERATIVE" or not user.cooperative:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cooperative management access required."
        )

    coop = user.cooperative

    req = db.query(models.CooperativeMembership).filter(
        models.CooperativeMembership.id == request_id,
        models.CooperativeMembership.cooperative_id == coop.id
    ).first()

    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership request not found.")

    worker = db.query(models.Worker).filter(models.Worker.id == req.worker_id).first()

    reason = payload.reason or "Membership requirements not met at this time."
    req.status = "REJECTED"
    req.rejected_at = datetime.datetime.utcnow()
    req.rejection_reason = reason

    if worker:
        # If the worker was pending, mark as REJECTED
        if worker.membership_status == "PENDING":
            worker.membership_status = "REJECTED"

        db.add(models.Notification(
            user_id=worker.user_id,
            title="Membership Request Update",
            message=f"Your membership application for {coop.name} was not approved. Reason: {reason}",
            type="ALERT"
        ))

    db.commit()

    return {
        "success": True,
        "message": f"Membership request rejected.",
        "status": "REJECTED"
    }
