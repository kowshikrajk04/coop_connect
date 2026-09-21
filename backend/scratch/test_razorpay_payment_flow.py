import os
import sys
import time
import json
import uuid
import hmac
import hashlib
from datetime import datetime

# Add backend directory to sys.path
sys.path.insert(0, r"c:\Users\HP\Downloads\coopconnect\backend")
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from database import SessionLocal, engine
import models
from services.payment_service import get_razorpay_keys, generate_test_signature

def run_tests():
    print("=" * 70)
    print("COOPCONNECT RAZORPAY TEST MODE PAYMENT INTEGRATION TEST SUITE")
    print("=" * 70)

    db = SessionLocal()
    key_id, key_secret = get_razorpay_keys()
    print(f"Razorpay Key ID configured: {key_id}")
    print(f"Razorpay Key Secret configured: {'*' * len(key_secret)} (length={len(key_secret)})")

    # Step 1: Ensure Cooperative exists
    coop = db.query(models.Cooperative).first()
    if not coop:
        print("Creating test cooperative...")
        coop_user = models.User(
            email=f"test_coop_{uuid.uuid4().hex[:6]}@example.com",
            mobile=f"98{uuid.uuid4().int % 100000000:08d}",
            hashed_password="testhash123",
            role="COOPERATIVE",
            is_active=True,
            otp_verified=True
        )
        db.add(coop_user)
        db.commit()
        coop = models.Cooperative(
            user_id=coop_user.id,
            name="Apex Workers Cooperative Society",
            registration_number=f"COOP-{uuid.uuid4().hex[:8].upper()}",
            contact_person="Director Sharma",
            mobile=coop_user.mobile,
            email=coop_user.email,
            address="Cooperative Bhavan, New Delhi",
            service_fee_pct=10.0,
            welfare_pct=5.0
        )
        db.add(coop)
        db.commit()
        db.refresh(coop)

    # Step 2: Create Test Customers A and B
    customer_a_user = models.User(
        email=f"customer_a_{uuid.uuid4().hex[:6]}@example.com",
        mobile=f"98{uuid.uuid4().int % 100000000:08d}",
        hashed_password="testhash123",
        role="CUSTOMER",
        is_active=True,
        otp_verified=True
    )
    db.add(customer_a_user)
    db.commit()
    customer_a = models.Customer(
        user_id=customer_a_user.id,
        full_name="Rajesh Kumar",
        address="Flat 402, Green Avenue, Delhi"
    )
    db.add(customer_a)

    customer_b_user = models.User(
        email=f"customer_b_{uuid.uuid4().hex[:6]}@example.com",
        mobile=f"98{uuid.uuid4().int % 100000000:08d}",
        hashed_password="testhash123",
        role="CUSTOMER",
        is_active=True,
        otp_verified=True
    )
    db.add(customer_b_user)
    db.commit()
    customer_b = models.Customer(
        user_id=customer_b_user.id,
        full_name="Pooja Verma",
        address="House 12, Sector 15, Gurgaon"
    )
    db.add(customer_b)
    db.commit()

    # Step 3: Create Booking of exactly ₹1000 for Customer A
    booking_number = f"BK-TEST-{uuid.uuid4().hex[:6].upper()}"
    booking = models.Booking(
        booking_number=booking_number,
        customer_id=customer_a.id,
        service_type="Electrician",
        description="Complete wiring and fuse box overhaul",
        scheduled_date="2026-09-22",
        scheduled_time="Morning (8:00 AM - 12:00 PM)",
        customer_address=customer_a.address,
        status="COMPLETED",
        total_amount=1000.0,
        payment_status="PENDING"
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    print(f"\n[1] Booking created: #{booking.booking_number} (ID={booking.id}) for ₹{booking.total_amount}")

    # Step 4: Test create-order logic
    from routers.payments import create_payment_order, verify_payment
    import schemas

    # Test Customer A creating order
    order_req = schemas.CreateOrderRequest(booking_id=booking.id, amount=1000.0)
    order_res = create_payment_order(req=order_req, user=customer_a_user, db=db)
    print(f"[2] Razorpay Order Created successfully:")
    print(f"    Order ID: {order_res.order_id}")
    print(f"    Amount in Paise: {order_res.amount} (₹{order_res.amount / 100})")
    print(f"    Currency: {order_res.currency}")
    print(f"    Key ID: {order_res.key_id}")

    assert order_res.amount == 100000, f"Expected 100000 paise (₹1000), got {order_res.amount}"
    assert order_res.currency == "INR"
    assert order_res.order_id is not None

    # Verify transaction record created in database
    txn = db.query(models.PaymentTransaction).filter(
        models.PaymentTransaction.razorpay_order_id == order_res.order_id
    ).first()
    assert txn is not None, "PaymentTransaction was not created in database!"
    assert txn.status == "CREATED"
    assert txn.amount == 1000.0
    print("    [PASS] PaymentTransaction recorded in Neon PostgreSQL with status 'CREATED'")

    # Step 5: Test Security - Unauthorized Customer B cannot create order for Customer A's booking
    print("\n[3] Testing Security: Customer B attempting to create order for Customer A's booking...")
    try:
        create_payment_order(req=order_req, user=customer_b_user, db=db)
        print("    [FAIL] Expected 403 Forbidden, but request succeeded!")
        sys.exit(1)
    except Exception as e:
        if hasattr(e, "status_code") and e.status_code == 403:
            print("    [PASS] Unauthorized payment attempt correctly blocked with HTTP 403 Forbidden!")
        else:
            print(f"    [FAIL] Unexpected exception: {e}")
            sys.exit(1)

    # Step 6: Test Security - Invalid Signature Verification
    print("\n[4] Testing Security: Invalid payment signature verification...")
    invalid_verify_req = schemas.VerifyPaymentRequest(
        razorpay_order_id=order_res.order_id,
        razorpay_payment_id="pay_fake_99999999",
        razorpay_signature="bad_tampered_signature_hex",
        booking_id=booking.id
    )
    try:
        verify_payment(req=invalid_verify_req, user=customer_a_user, db=db)
        print("    [FAIL] Invalid signature was accepted!")
        sys.exit(1)
    except Exception as e:
        if hasattr(e, "status_code") and e.status_code == 400:
            print("    [PASS] Invalid signature was rejected with HTTP 400 Bad Request!")
            db.refresh(txn)
            assert txn.status == "FAILED", f"Expected transaction status FAILED, got {txn.status}"
            print("    [PASS] PaymentTransaction status marked as 'FAILED'")
        else:
            print(f"    [FAIL] Unexpected exception: {e}")
            sys.exit(1)

    # Step 7: Test Valid Signature Verification
    print("\n[5] Testing Valid Payment Verification & Breakdown...")
    valid_payment_id = f"pay_test_{uuid.uuid4().hex[:12]}"
    valid_signature = generate_test_signature(order_res.order_id, valid_payment_id)

    valid_verify_req = schemas.VerifyPaymentRequest(
        razorpay_order_id=order_res.order_id,
        razorpay_payment_id=valid_payment_id,
        razorpay_signature=valid_signature,
        booking_id=booking.id
    )

    verify_res = verify_payment(req=valid_verify_req, user=customer_a_user, db=db)
    print("    Payment verification response:", verify_res)
    assert verify_res.success is True
    assert verify_res.status == "PAID"
    assert verify_res.payment_id == valid_payment_id

    # Verify Neon PostgreSQL state
    db.refresh(booking)
    assert booking.payment_status == "PAID", f"Booking payment_status expected PAID, got {booking.payment_status}"
    
    payment = db.query(models.Payment).filter(models.Payment.booking_id == booking.id).first()
    assert payment is not None, "Payment record not found in database!"
    assert payment.status == "PAID"
    assert payment.transaction_id == valid_payment_id
    assert payment.payment_method == "RAZORPAY"

    print("\n[6] Verifying Cooperative Payment Breakdown:")
    print(f"    Service Amount: ₹{payment.service_amount}")
    print(f"    Worker Payout: ₹{payment.worker_payout}")
    print(f"    Cooperative Service Fee: ₹{payment.coop_fee}")
    print(f"    Welfare Contribution: ₹{payment.welfare_contribution}")

    assert payment.service_amount == 1000.0, f"Expected 1000, got {payment.service_amount}"
    assert payment.worker_payout == 900.0, f"Expected 900.0 worker payout for ₹1000 service, got {payment.worker_payout}"
    assert payment.coop_fee == 100.0, f"Expected 100.0 cooperative service fee for ₹1000 service, got {payment.coop_fee}"
    print("    [PASS] Worker payout = ₹900.0, Cooperative fee = ₹100.0 verified!")

    # Verify digital invoice
    invoice = db.query(models.Invoice).filter(models.Invoice.payment_id == payment.id).first()
    assert invoice is not None, "Digital invoice was not generated!"
    print(f"    [PASS] Digital Invoice generated: {invoice.invoice_number}")

    # Step 8: Test Duplicate Payment Prevention
    print("\n[7] Testing Security: Duplicate payment prevention...")
    try:
        create_payment_order(req=order_req, user=customer_a_user, db=db)
        print("    [FAIL] Duplicate order creation allowed!")
        sys.exit(1)
    except Exception as e:
        if hasattr(e, "status_code") and e.status_code == 400:
            print("    [PASS] Duplicate create-order blocked with HTTP 400 (Already Paid)!")
        else:
            print(f"    [FAIL] Unexpected exception: {e}")
            sys.exit(1)

    try:
        verify_payment(req=valid_verify_req, user=customer_a_user, db=db)
        print("    [FAIL] Duplicate verification allowed!")
        sys.exit(1)
    except Exception as e:
        if hasattr(e, "status_code") and e.status_code == 400:
            print("    [PASS] Duplicate verification blocked with HTTP 400 (Already Paid)!")
        else:
            print(f"    [FAIL] Unexpected exception: {e}")
            sys.exit(1)

    # Step 9: Verify Cooperative Dashboard reflects the fee
    print("\n[8] Verifying Cooperative Dashboard Revenue...")
    from routers.cooperative import get_cooperative_dashboard
    coop_dash = get_cooperative_dashboard(user=coop.user, db=db)
    print(f"    Cooperative Revenue: ₹{coop_dash['cooperative_revenue']}")
    print(f"    Welfare Fund: ₹{coop_dash['welfare_fund']}")
    assert coop_dash['cooperative_revenue'] >= 100.0
    print("    [PASS] Cooperative Dashboard reflects updated revenue from Razorpay payment!")

    print("\n" + "=" * 70)
    print("ALL RAZORPAY PAYMENT INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)
    db.close()

if __name__ == "__main__":
    run_tests()
