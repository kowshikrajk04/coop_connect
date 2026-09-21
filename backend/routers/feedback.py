import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from database import get_db
import models
import schemas
from auth_utils import get_current_user

router = APIRouter(prefix="/api", tags=["feedback", "leaderboard"])


def calculate_worker_score(
    ratings: List[models.Rating],
    completed_jobs: int,
    total_jobs: int,
    fallback_rating: float = 5.0
) -> Dict[str, Any]:
    """
    Calculates Bayesian weighted rating and multi-factor performance score (0 - 100).
    Formula:
      v = review count
      m = minimum review confidence weight (5)
      R = average review rating
      C = prior mean rating (4.0)
      WR = (v / (v + m)) * R + (m / (v + m)) * C
      completion_rate = completed_jobs / max(total_jobs, 1)
      volume_factor = min(completed_jobs / 20.0, 1.0)
      performance_score = (WR / 5.0) * 60 + completion_rate * 25 + volume_factor * 15
    """
    total_reviews = len(ratings)
    if total_reviews > 0:
        avg_rating = round(sum(r.stars for r in ratings) / total_reviews, 2)
    else:
        avg_rating = round(float(fallback_rating), 2)

    m = 5.0
    prior_c = 4.0
    v = float(total_reviews)
    bayesian_score = ((v / (v + m)) * avg_rating) + ((m / (v + m)) * prior_c)

    effective_total = max(total_jobs, completed_jobs, 1)
    completion_rate = min(1.0, max(0.0, completed_jobs / effective_total))
    volume_factor = min(1.0, completed_jobs / 20.0)

    perf_score = ((bayesian_score / 5.0) * 60.0) + (completion_rate * 25.0) + (volume_factor * 15.0)
    perf_score = round(min(100.0, max(0.0, perf_score)), 1)

    return {
        "total_reviews": total_reviews,
        "average_rating": avg_rating,
        "bayesian_score": round(bayesian_score, 2),
        "completion_rate": round(completion_rate, 2),
        "performance_score": perf_score
    }


@router.post("/feedback", response_model=dict)
def submit_customer_feedback(
    req: schemas.FeedbackCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits rating (1 to 5) and optional written feedback for a completed service.
    Enforces:
    - User must be a CUSTOMER.
    - Booking must exist and belong to this customer.
    - Booking status must be COMPLETED.
    - Booking must have an assigned worker.
    - Workers cannot rate themselves.
    - Strictly prevents duplicate feedback for the same booking.
    - Recalculates worker's overall rating.
    - Sends an in-app notification to the worker.
    """
    if user.role != "CUSTOMER" or not user.customer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer access required to provide service feedback."
        )

    # Validate rating score
    stars = req.rating if req.rating is not None else req.stars
    if stars is None or not isinstance(stars, int) or stars < 1 or stars > 5:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Rating must be an integer between 1 and 5."
        )

    booking = db.query(models.Booking).filter(models.Booking.id == req.booking_id).first()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

    if booking.customer_id != user.customer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only submit feedback for your own bookings."
        )

    if booking.status != "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback can only be submitted after the service has been completed."
        )

    if not booking.worker_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No worker is assigned to this booking."
        )

    # Ensure worker cannot rate themselves
    if booking.worker and booking.worker.user_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workers cannot provide feedback on their own jobs."
        )

    # Prevent duplicate rating for this booking
    existing_rating = db.query(models.Rating).filter(models.Rating.booking_id == booking.id).first()
    if existing_rating:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback has already been submitted for this booking."
        )

    cleaned_feedback = req.feedback.strip() if (req.feedback and req.feedback.strip()) else None

    new_rating = models.Rating(
        booking_id=booking.id,
        customer_id=user.customer.id,
        worker_id=booking.worker_id,
        stars=stars,
        feedback=cleaned_feedback,
        created_at=datetime.datetime.utcnow()
    )
    db.add(new_rating)
    db.flush()

    # Recalculate worker's average rating
    worker = booking.worker or db.query(models.Worker).filter(models.Worker.id == booking.worker_id).first()
    if worker:
        all_ratings = db.query(models.Rating).filter(models.Rating.worker_id == worker.id).all()
        if all_ratings:
            avg_stars = sum(r.stars for r in all_ratings) / len(all_ratings)
            worker.rating = round(avg_stars, 2)

        # Notify worker
        if worker.user_id:
            db.add(models.Notification(
                user_id=worker.user_id,
                title="New Customer Rating Received",
                message=f"You received a {stars}-star rating from {user.customer.full_name} for booking #{booking.booking_number} ({booking.service_type}).",
                type="SUCCESS"
            ))

    db.commit()

    return {
        "success": True,
        "message": "Thank you for your feedback.",
        "rating_id": new_rating.id,
        "booking_id": booking.id,
        "stars": stars,
        "rating": stars,
        "worker_id": booking.worker_id
    }


@router.get("/leaderboard", response_model=schemas.LeaderboardResponse)
def get_worker_leaderboard(
    trade: Optional[str] = Query(None, description="Filter by trade/skill e.g. Electrician"),
    cooperative_id: Optional[int] = Query(None, description="Filter by cooperative ID"),
    time_period: str = Query("all", description="all, this_month, 3_months"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Returns ranked workers ordered by composite performance score with filtering by
    trade, cooperative, and time period.
    """
    workers_query = db.query(models.Worker).options(
        joinedload(models.Worker.skills),
        joinedload(models.Worker.cooperative),
        joinedload(models.Worker.ratings)
    )

    if cooperative_id is not None:
        workers_query = workers_query.filter(models.Worker.cooperative_id == cooperative_id)

    workers = workers_query.all()

    # Determine date window if time_period is specified
    cutoff_date: Optional[datetime.datetime] = None
    now = datetime.datetime.utcnow()
    if time_period == "this_month":
        cutoff_date = datetime.datetime(now.year, now.month, 1)
    elif time_period in ["3_months", "three_months"]:
        cutoff_date = now - datetime.timedelta(days=90)

    leaderboard_entries = []

    for w in workers:
        skill_names = [s.skill_name for s in w.skills]
        if trade and trade.strip() and trade.lower() != "all":
            # Check if worker has the requested trade
            trade_lower = trade.strip().lower()
            if not any(trade_lower in s.lower() for s in skill_names):
                continue

        # Filter ratings within time window if applicable
        if cutoff_date is not None:
            period_ratings = [r for r in w.ratings if r.created_at and r.created_at >= cutoff_date]
            # Also calculate period completed jobs from bookings
            period_completed = db.query(models.Booking).filter(
                models.Booking.worker_id == w.id,
                models.Booking.status == "COMPLETED",
                models.Booking.created_at >= cutoff_date
            ).count()
            period_total = db.query(models.Booking).filter(
                models.Booking.worker_id == w.id,
                models.Booking.created_at >= cutoff_date
            ).count()
        else:
            period_ratings = w.ratings
            period_completed = w.completed_jobs
            period_total = w.total_jobs

        score_data = calculate_worker_score(
            ratings=period_ratings,
            completed_jobs=period_completed,
            total_jobs=period_total,
            fallback_rating=w.rating or 5.0
        )

        coop_name = w.cooperative.name if w.cooperative else "Independent / Federative"

        leaderboard_entries.append({
            "worker_id": w.id,
            "full_name": w.full_name,
            "profile_photo": w.profile_photo,
            "cooperative_id": w.cooperative_id,
            "cooperative_name": coop_name,
            "skills": skill_names,
            "average_rating": score_data["average_rating"],
            "total_reviews": score_data["total_reviews"],
            "completed_jobs": period_completed,
            "completion_rate": score_data["completion_rate"],
            "performance_score": score_data["performance_score"],
        })

    # Sort workers: Primary = performance_score (desc), Secondary = completed_jobs (desc), Tertiary = average_rating (desc)
    leaderboard_entries.sort(
        key=lambda x: (x["performance_score"], x["completed_jobs"], x["average_rating"]),
        reverse=True
    )

    ranked_items = []
    for idx, item in enumerate(leaderboard_entries[:limit]):
        rank = idx + 1
        # Badges
        badge = None
        if rank == 1:
            badge = "Top Performer"
        elif rank == 2:
            badge = "Runner Up"
        elif rank == 3:
            badge = "Coop Champion"
        elif item["completed_jobs"] >= 20:
            badge = "Veteran"
        elif item["average_rating"] >= 4.8 and item["total_reviews"] >= 3:
            badge = "Rising Star"

        ranked_items.append(schemas.LeaderboardItem(
            rank=rank,
            worker_id=item["worker_id"],
            full_name=item["full_name"],
            profile_photo=item["profile_photo"],
            cooperative_id=item["cooperative_id"],
            cooperative_name=item["cooperative_name"],
            skills=item["skills"],
            average_rating=item["average_rating"],
            total_reviews=item["total_reviews"],
            completed_jobs=item["completed_jobs"],
            completion_rate=item["completion_rate"],
            performance_score=item["performance_score"],
            badge=badge
        ))

    return schemas.LeaderboardResponse(
        total_workers=len(ranked_items),
        time_period=time_period,
        trade=trade,
        cooperative_id=cooperative_id,
        items=ranked_items
    )


@router.get("/workers/{worker_id}/performance", response_model=schemas.WorkerPerformanceOut)
def get_worker_performance(worker_id: int, db: Session = Depends(get_db)):
    """
    Returns full performance metrics, rating breakdown, leaderboard rank,
    and recent customer feedback for a given worker.
    """
    worker = db.query(models.Worker).filter(models.Worker.id == worker_id).options(
        joinedload(models.Worker.skills),
        joinedload(models.Worker.cooperative),
        joinedload(models.Worker.ratings).joinedload(models.Rating.customer)
    ).first()

    if not worker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found.")

    ratings = sorted(worker.ratings, key=lambda r: r.created_at or datetime.datetime.min, reverse=True)
    score_data = calculate_worker_score(
        ratings=ratings,
        completed_jobs=worker.completed_jobs,
        total_jobs=worker.total_jobs,
        fallback_rating=worker.rating or 5.0
    )

    # Compute rating distribution
    rating_distribution = {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}
    for r in ratings:
        k = str(r.stars)
        if k in rating_distribution:
            rating_distribution[k] += 1

    # Format recent reviews (up to 10)
    recent_reviews = []
    for r in ratings[:10]:
        customer_name = r.customer.full_name if r.customer else "Cooperative Customer"
        recent_reviews.append(schemas.FeedbackOut(
            id=r.id,
            booking_id=r.booking_id,
            customer_id=r.customer_id,
            worker_id=r.worker_id,
            stars=r.stars,
            rating=r.stars,
            feedback=r.feedback,
            customer_name=customer_name,
            created_at=r.created_at
        ))

    # Calculate worker's all-time rank among all workers
    all_workers = db.query(models.Worker).options(joinedload(models.Worker.ratings)).all()
    all_scores = []
    for w in all_workers:
        s = calculate_worker_score(
            ratings=w.ratings,
            completed_jobs=w.completed_jobs,
            total_jobs=w.total_jobs,
            fallback_rating=w.rating or 5.0
        )
        all_scores.append((w.id, s["performance_score"], w.completed_jobs, s["average_rating"]))

    all_scores.sort(key=lambda x: (x[1], x[2], x[3]), reverse=True)
    rank = None
    for idx, item in enumerate(all_scores):
        if item[0] == worker.id:
            rank = idx + 1
            break

    coop_name = worker.cooperative.name if worker.cooperative else "Independent / Federative"

    return schemas.WorkerPerformanceOut(
        worker_id=worker.id,
        full_name=worker.full_name,
        profile_photo=worker.profile_photo,
        cooperative_name=coop_name,
        cooperative_id=worker.cooperative_id,
        skills=[s.skill_name for s in worker.skills],
        average_rating=score_data["average_rating"],
        total_reviews=score_data["total_reviews"],
        completed_jobs=worker.completed_jobs,
        total_jobs=worker.total_jobs,
        completion_rate=score_data["completion_rate"],
        bayesian_score=score_data["bayesian_score"],
        performance_score=score_data["performance_score"],
        rank=rank,
        total_workers_ranked=len(all_scores),
        rating_distribution=rating_distribution,
        recent_reviews=recent_reviews
    )


@router.get("/workers/{worker_id}/feedback", response_model=List[schemas.FeedbackOut])
def get_worker_feedback_list(
    worker_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Returns paginated public feedback and reviews for a specific worker.
    """
    worker = db.query(models.Worker).filter(models.Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found.")

    offset = (page - 1) * page_size
    ratings = db.query(models.Rating).filter(
        models.Rating.worker_id == worker_id
    ).options(joinedload(models.Rating.customer)).order_by(
        models.Rating.created_at.desc()
    ).offset(offset).limit(page_size).all()

    out = []
    for r in ratings:
        customer_name = r.customer.full_name if r.customer else "Cooperative Customer"
        out.append(schemas.FeedbackOut(
            id=r.id,
            booking_id=r.booking_id,
            customer_id=r.customer_id,
            worker_id=r.worker_id,
            stars=r.stars,
            rating=r.stars,
            feedback=r.feedback,
            customer_name=customer_name,
            created_at=r.created_at
        ))
    return out
