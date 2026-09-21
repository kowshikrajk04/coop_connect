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
    # Explicit requirement: For ₹1000 service -> worker payout = ₹900 (90%), cooperative service fee = ₹100 (10%)
    coop_fee_pct = coop.service_fee_pct if (coop and coop.service_fee_pct and coop.service_fee_pct >= 10.0) else 10.0
    welfare_pct = coop.welfare_pct if (coop and coop.welfare_pct is not None) else 5.0

    service_amount = booking.total_amount
    coop_fee = round(service_amount * (coop_fee_pct / 100.0), 2)
    worker_payout = round(service_amount - coop_fee, 2)
    welfare_contrib = round(service_amount * (welfare_pct / 100.0), 2)

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

@router.post("/create-order", response_model=schemas.CreateOrderResponse)
def create_payment_order(
    req: schemas.CreateOrderRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(models.Booking).filter(models.Booking.id == req.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    # Validate booking ownership: customer can only create order for their own booking
    if user.role == "CUSTOMER":
        if not user.customer or booking.customer_id != user.customer.id:
            raise HTTPException(status_code=403, detail="Not authorized to pay for this booking.")

    # Prevent duplicate payment
    if (booking.payment and booking.payment.status == "PAID") or getattr(booking, "payment_status", None) == "PAID":
        raise HTTPException(status_code=400, detail="This booking has already been paid.")

    # Always enforce database amount (convert to paise)
    service_amount = float(booking.total_amount)
    amount_paise = int(round(service_amount * 100))

    try:
        from services.payment_service import create_razorpay_order
        order_data = create_razorpay_order(
            amount_paise=amount_paise,
            booking_id=booking.id,
            booking_number=booking.booking_number
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Razorpay order creation failed: {str(e)}"
        )

    # Record PaymentTransaction
    txn = models.PaymentTransaction(
        booking_id=booking.id,
        razorpay_order_id=order_data["order_id"],
        amount=service_amount,
        currency=order_data.get("currency", "INR"),
        status="CREATED"
    )
    db.add(txn)
    db.commit()

    return schemas.CreateOrderResponse(
        order_id=order_data["order_id"],
        amount=amount_paise,
        currency=order_data.get("currency", "INR"),
        key_id=order_data["key_id"]
    )

@router.post("/verify", response_model=schemas.VerifyPaymentResponse)
def verify_payment(
    req: schemas.VerifyPaymentRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(models.Booking).filter(models.Booking.id == req.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    # Validate booking ownership
    if user.role == "CUSTOMER":
        if not user.customer or booking.customer_id != user.customer.id:
            raise HTTPException(status_code=403, detail="Not authorized to pay for this booking.")

    # Prevent duplicate payment
    if (booking.payment and booking.payment.status == "PAID") or getattr(booking, "payment_status", None) == "PAID":
        raise HTTPException(status_code=400, detail="This booking has already been paid.")

    # Cryptographically verify Razorpay signature
    from services.payment_service import verify_payment_signature
    is_valid = verify_payment_signature(
        razorpay_order_id=req.razorpay_order_id,
        razorpay_payment_id=req.razorpay_payment_id,
        razorpay_signature=req.razorpay_signature
    )

    # Find corresponding transaction
    txn = db.query(models.PaymentTransaction).filter(
        models.PaymentTransaction.razorpay_order_id == req.razorpay_order_id
    ).first()

    if not is_valid:
        if txn:
            txn.status = "FAILED"
            txn.error_code = "BAD_SIGNATURE"
            txn.error_description = "Payment signature verification failed."
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment signature verification failed. Untrusted payment details."
        )

    # Update transaction to PAID
    if txn:
        txn.status = "PAID"
        txn.razorpay_payment_id = req.razorpay_payment_id
        txn.razorpay_signature = req.razorpay_signature
        txn.paid_at = datetime.datetime.utcnow()

    # Calculate transparent breakdown: ₹900 worker payout, ₹100 cooperative service fee for ₹1000 service
    coop = db.query(models.Cooperative).first()
    # Explicit requirement: For ₹1000 service -> worker payout = ₹900 (90%), cooperative service fee = ₹100 (10%)
    coop_fee_pct = coop.service_fee_pct if (coop and coop.service_fee_pct and coop.service_fee_pct >= 10.0) else 10.0
    welfare_pct = coop.welfare_pct if (coop and coop.welfare_pct is not None) else 5.0

    service_amount = booking.total_amount
    coop_fee = round(service_amount * (coop_fee_pct / 100.0), 2)
    worker_payout = round(service_amount - coop_fee, 2)
    welfare_contrib = round(service_amount * (welfare_pct / 100.0), 2)

    # Mark booking paid and completed
    booking.payment_status = "PAID"
    if booking.status in ["REQUESTED", "ALLOCATED", "ACCEPTED", "IN_PROGRESS"]:
        booking.status = "COMPLETED"
    if not booking.completed_at:
        booking.completed_at = datetime.datetime.utcnow()

    # Update or create Payment record
    payment = db.query(models.Payment).filter(models.Payment.booking_id == booking.id).first()
    if not payment:
        payment = models.Payment(
            booking_id=booking.id,
            service_amount=service_amount,
            coop_fee=coop_fee,
            worker_payout=worker_payout,
            welfare_contribution=welfare_contrib,
            payment_method="RAZORPAY",
            status="PAID",
            transaction_id=req.razorpay_payment_id,
            razorpay_order_id=req.razorpay_order_id,
            razorpay_payment_id=req.razorpay_payment_id,
            paid_at=datetime.datetime.utcnow()
        )
        db.add(payment)
    else:
        payment.status = "PAID"
        payment.payment_method = "RAZORPAY"
        payment.transaction_id = req.razorpay_payment_id
        payment.razorpay_order_id = req.razorpay_order_id
        payment.razorpay_payment_id = req.razorpay_payment_id
        payment.service_amount = service_amount
        payment.coop_fee = coop_fee
        payment.worker_payout = worker_payout
        payment.welfare_contribution = welfare_contrib
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
        "razorpay_payment_id": req.razorpay_payment_id,
        "payment_method": "Razorpay"
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

    # Credit collective welfare fund
    if coop and welfare_contrib > 0:
        db.add(models.WelfareTransaction(
            cooperative_id=coop.id,
            worker_id=booking.worker_id,
            booking_id=booking.id,
            amount=welfare_contrib,
            category="RESERVE",
            type="CREDIT",
            description=f"Welfare contribution from booking #{booking.booking_number} ({booking.service_type})"
        ))

    # Notify worker of payment receipt
    if booking.worker:
        db.add(models.Notification(
            user_id=booking.worker.user_id,
            title="Payment Received",
            message=f"₹{payment.worker_payout} credited for completed booking #{booking.booking_number} via Razorpay.",
            type="SUCCESS"
        ))

    db.commit()

    return schemas.VerifyPaymentResponse(
        success=True,
        message="Payment verified and processed successfully. Digital invoice generated.",
        payment_id=req.razorpay_payment_id,
        order_id=req.razorpay_order_id,
        amount=payment.service_amount,
        status="PAID"
    )

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
    from routers.feedback import submit_customer_feedback
    fb_req = schemas.FeedbackCreate(
        booking_id=req.booking_id,
        rating=req.rating or req.stars,
        stars=req.stars or req.rating,
        feedback=req.feedback
    )
    return submit_customer_feedback(fb_req, user, db)
