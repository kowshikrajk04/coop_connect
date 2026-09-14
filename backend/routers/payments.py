import random
import datetime
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from auth_utils import get_current_user

router = APIRouter(prefix="/api/payments", tags=["payments"])

@router.get("/breakdown/{booking_id}")
def get_payment_breakdown(booking_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    coop = db.query(models.Cooperative).first()
    coop_fee_pct = coop.service_fee_pct if coop else 5.0
    welfare_pct = coop.welfare_pct if coop else 5.0

    service_amount = booking.total_amount
    coop_fee = round(service_amount * (coop_fee_pct / 100.0), 2)
    welfare_contrib = round(service_amount * (welfare_pct / 100.0), 2)
    worker_payout = round(service_amount - coop_fee - welfare_contrib, 2)

    return {
        "booking_id": booking.id,
        "booking_number": booking.booking_number,
        "service_type": booking.service_type,
        "service_amount": service_amount,
        "coop_fee": coop_fee,
        "coop_fee_pct": coop_fee_pct,
        "worker_payout": worker_payout,
        "welfare_contribution": welfare_contrib,
        "welfare_pct": welfare_pct,
        "total_amount": service_amount
    }

@router.post("/pay")
def process_payment(req: schemas.PaymentSubmit, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == req.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    payment = db.query(models.Payment).filter(models.Payment.booking_id == booking.id).first()
    if not payment:
        # Create payment if not created yet
        coop = db.query(models.Cooperative).first()
        coop_fee_pct = coop.service_fee_pct if coop else 5.0
        welfare_pct = coop.welfare_pct if coop else 5.0

        service_amount = booking.total_amount
        coop_fee = round(service_amount * (coop_fee_pct / 100.0), 2)
        welfare_contrib = round(service_amount * (welfare_pct / 100.0), 2)
        worker_payout = round(service_amount - coop_fee - welfare_contrib, 2)

        payment = models.Payment(
            booking_id=booking.id,
            service_amount=service_amount,
            coop_fee=coop_fee,
            worker_payout=worker_payout,
            welfare_contribution=welfare_contrib,
            payment_method=req.payment_method,
            status="PAID",
            transaction_id=f"TXN-UPI-{random.randint(10000000, 99999999)}",
            paid_at=datetime.datetime.utcnow()
        )
        db.add(payment)
    else:
        payment.status = "PAID"
        payment.payment_method = req.payment_method
        payment.transaction_id = f"TXN-UPI-{random.randint(10000000, 99999999)}"
        payment.paid_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(payment)

    # Generate Digital Invoice
    invoice_number = f"INV-{booking.booking_number}-{random.randint(100, 999)}"
    customer_name = booking.customer.full_name if booking.customer else "Valued Customer"
    worker_name = booking.worker.full_name if booking.worker else "Assigned Cooperative Worker"
    coop_name = booking.worker.cooperative.name if booking.worker and booking.worker.cooperative else "National Cooperative Workers Federation"

    breakdown = {
        "service_type": booking.service_type,
        "service_amount": payment.service_amount,
        "coop_fee": payment.coop_fee,
        "worker_payout": payment.worker_payout,
        "welfare_contribution": payment.welfare_contribution,
        "transaction_id": payment.transaction_id,
        "payment_method": payment.payment_method
    }

    existing_invoice = db.query(models.Invoice).filter(models.Invoice.payment_id == payment.id).first()
    if not existing_invoice:
        invoice = models.Invoice(
            payment_id=payment.id,
            invoice_number=invoice_number,
            customer_name=customer_name,
            worker_name=worker_name,
            coop_name=coop_name,
            service_type=booking.service_type,
            total_amount=payment.service_amount,
            breakdown_json=json.dumps(breakdown)
        )
        db.add(invoice)
        db.commit()

    # Notify worker of payment receipt
    if booking.worker:
        db.add(models.Notification(
            user_id=booking.worker.user_id,
            title="Payment Received",
            message=f"₹{payment.worker_payout} credited for completed booking #{booking.booking_number} via UPI.",
            type="SUCCESS"
        ))
        db.commit()

    return {
        "success": True,
        "message": "Payment successful. Digital invoice generated.",
        "transaction_id": payment.transaction_id,
        "amount_paid": payment.service_amount,
        "worker_payout": payment.worker_payout,
        "welfare_contribution": payment.welfare_contribution
    }

@router.get("/invoice/{booking_id}")
def get_invoice(booking_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking or not booking.payment:
        raise HTTPException(status_code=404, detail="Invoice not available yet.")

    inv = db.query(models.Invoice).filter(models.Invoice.payment_id == booking.payment.id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice record not found.")

    return {
        "invoice_number": inv.invoice_number,
        "issued_date": inv.issued_date.strftime("%d %b %Y, %I:%M %p"),
        "customer_name": inv.customer_name,
        "worker_name": inv.worker_name,
        "coop_name": inv.coop_name,
        "service_type": inv.service_type,
        "booking_number": booking.booking_number,
        "total_amount": inv.total_amount,
        "breakdown": json.loads(inv.breakdown_json)
    }

@router.post("/rating")
def submit_rating(req: schemas.RatingCreate, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == req.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    existing_rating = db.query(models.Rating).filter(models.Rating.booking_id == booking.id).first()
    if existing_rating:
        existing_rating.stars = req.stars
        existing_rating.feedback = req.feedback
    else:
        new_rating = models.Rating(
            booking_id=booking.id,
            customer_id=booking.customer_id,
            worker_id=booking.worker_id or 1,
            stars=req.stars,
            feedback=req.feedback
        )
        db.add(new_rating)

    # Recalculate worker's average rating
    if booking.worker:
        worker_ratings = db.query(models.Rating).filter(models.Rating.worker_id == booking.worker_id).all()
        if worker_ratings:
            avg_stars = sum(r.stars for r in worker_ratings) / len(worker_ratings)
            booking.worker.rating = round(avg_stars, 1)

    db.commit()
    return {"success": True, "message": "Thank you for rating your cooperative service worker!"}
