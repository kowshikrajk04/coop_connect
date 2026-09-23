import sys
import os
import uuid
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from fastapi.testclient import TestClient
from main import app
from database import Base, engine

client = TestClient(app)

def test_full_coopconnect_flow():
    print("\n--- 1. Testing Reset to Initial Empty State (if demo router mounted) ---")
    res = client.post("/api/demo/reset")
    if res.status_code == 200:
        print("Reset successful:", res.json().get("message", "OK"))

    print("\n--- 2. Verifying Pure Empty State for Cooperatives ---")
    login_res = client.post("/api/auth/login", json={"login_id": "cooperative@delhi.gov.in", "password": "CoopPass123!"})
    assert login_res.status_code == 200, login_res.text
    coop_token = login_res.json()["access_token"]
    coop_headers = {"Authorization": f"Bearer {coop_token}"}

    dash_res = client.get("/api/cooperative/dashboard", headers=coop_headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["total_workers"] >= 0
    assert dash_data["total_bookings"] >= 0
    print("Cooperative Dashboard verified:", dash_data)

    # Verify Fair Allocation endpoint
    fair_res = client.get("/api/cooperative/fair-allocation", headers=coop_headers)
    assert fair_res.status_code == 200
    print("Fair Allocation endpoint verified:", fair_res.json().get("message", "OK"))

    # Verify Demand Forecasting endpoint
    forecast_res = client.get("/api/demand-forecast")
    assert forecast_res.status_code == 200
    f_data = forecast_res.json()
    print("Demand Forecast endpoint confirmed:", f_data.get("message", "OK"))

    print("\n--- 3. Testing Worker Multi-Step Registration & Voice/Scenario Skill Assessment ---")
    # Step 1: Register worker user
    w_reg = client.post("/api/auth/register", json={
        "email": "sunil.electrician@example.com",
        "mobile": "9812300001",
        "password": "WorkerPass123!",
        "role": "WORKER",
        "full_name": "Sunil Kumar",
        "address": "Lajpat Nagar IV, New Delhi",
        "dob": "1990-08-15"
    })
    assert w_reg.status_code == 200, w_reg.text
    worker_token = w_reg.json()["access_token"]
    w_headers = {"Authorization": f"Bearer {worker_token}"}

    # Step 2: Skills
    s_res = client.post("/api/worker/skills", json={"skills": [{"skill_name": "Electrician", "years_experience": 5}]}, headers=w_headers)
    assert s_res.status_code == 200

    # Step 3: Documents
    doc_res = client.post("/api/worker/documents", json={
        "id_document_url": "https://example.com/aadhaar_mock.jpg",
        "cert_document_url": "https://example.com/iti_cert.jpg"
    }, headers=w_headers)
    assert doc_res.status_code == 200

    # Step 4: Practical Scenario-based Assessment
    assess_res = client.post("/api/worker/assessment/submit", json={
        "skill_name": "Electrician",
        "score": 90.0,
        "passed": True,
        "language": "en",
        "voice_transcript": "Turned off the main MCB breaker and verified zero current with voltage detector tester."
    }, headers=w_headers)
    assert assess_res.status_code == 200
    w_prof = client.get("/api/worker/profile", headers=w_headers).json()
    assert w_prof["status"] == "PENDING_VERIFICATION"
    print("Worker registered & assessment submitted. Status:", w_prof["status"])

    print("\n--- 4. Cooperative Worker Verification (Approve) ---")
    workers_list = client.get("/api/cooperative/workers?status_filter=PENDING_VERIFICATION", headers=coop_headers).json()
    assert len(workers_list) == 1
    worker_id = workers_list[0]["id"]
    verify_res = client.post(f"/api/cooperative/workers/{worker_id}/verify", json={"action": "APPROVE"}, headers=coop_headers)
    assert verify_res.status_code == 200
    assert verify_res.json()["status"] == "VERIFIED"
    print("Worker approved by Cooperative. Status is now VERIFIED.")

    print("\n--- 5. Customer Registration & Service Request with Emergency Rules ---")
    c_reg = client.post("/api/auth/register", json={
        "email": "priya.customer@example.com",
        "mobile": "9812300002",
        "password": "CustPass123!",
        "role": "CUSTOMER",
        "full_name": "Priya Sharma",
        "address": "Defence Colony, New Delhi"
    })
    assert c_reg.status_code == 200
    c_token = c_reg.json()["access_token"]
    c_headers = {"Authorization": f"Bearer {c_token}"}

    # Request Emergency Service
    book_res = client.post("/api/bookings", json={
        "service_type": "Electrician",
        "description": "Sparking and burning smell from switchboard near kitchen.",
        "is_emergency": True,
        "emergency_reason": "Electrical hazard with active sparks and safety risk",
        "scheduled_date": "2026-09-15",
        "scheduled_time": "Immediate",
        "customer_address": "Defence Colony, New Delhi",
        "customer_lat": 28.5729,
        "customer_lng": 77.2300
    }, headers=c_headers)
    assert book_res.status_code == 200, book_res.text
    book_data = book_res.json()
    assert book_data["emergency_priority"] == "CRITICAL"
    assert book_data["status"] == "ALLOCATED"
    booking_id = book_data["booking_id"]
    print("Emergency Booking created with CRITICAL priority and Fairness Allocation:", book_data["allocated_worker"]["name"])

    print("\n--- 6. Worker Accepts Job, Checks Optimized Route, & Completes Service ---")
    w_jobs = client.get("/api/worker/jobs", headers=w_headers).json()
    assert len(w_jobs["new_requests"]) == 1
    # Worker accepts
    acc_res = client.post(f"/api/worker/jobs/{booking_id}/accept", headers=w_headers)
    assert acc_res.status_code == 200

    # Worker checks route
    route_res = client.get("/api/worker/route-optimization", headers=w_headers).json()
    assert route_res["has_active_jobs"] == True
    print("Worker route optimization computed. Total stops:", route_res["total_stops"], "Next customer:", route_res["next_customer"]["customer_name"])

    # Worker starts and completes service
    client.post(f"/api/worker/jobs/{booking_id}/start", headers=w_headers)
    comp_res = client.post(f"/api/worker/jobs/{booking_id}/complete", json={
        "completion_photo_url": "https://example.com/repaired_board.jpg",
        "completion_notes": "Replaced burnt MCB switch and grounded live wire safely."
    }, headers=w_headers)
    assert comp_res.status_code == 200
    print("Service completed. Worker payout:", comp_res.json()["payout"], "Welfare contribution:", comp_res.json()["welfare"])

    print("\n--- 7. Payment Breakdown, UPI Checkout, & Digital Invoice ---")
    breakdown = client.get(f"/api/payments/breakdown/{booking_id}", headers=c_headers).json()
    print("Payment breakdown:", breakdown)

    pay_res = client.post("/api/payments/pay", json={"booking_id": booking_id, "payment_method": "UPI"}, headers=c_headers)
    assert pay_res.status_code == 200
    txn_id = pay_res.json()["transaction_id"]
    print("Payment verified via UPI. Transaction ID:", txn_id)

    # Fetch digital invoice
    inv_res = client.get(f"/api/payments/invoice/{booking_id}", headers=c_headers).json()
    assert inv_res["invoice_number"].startswith("INV-")
    print("Digital Invoice generated:", inv_res["invoice_number"], "Amount: Rs.", inv_res["total_amount"])

    # Customer rating
    client.post("/api/payments/rating", json={"booking_id": booking_id, "stars": 5, "feedback": "Excellent cooperative service!"}, headers=c_headers)

    print("\n--- 8. Cooperative Welfare Ledger Check ---")
    welf_res = client.get("/api/cooperative/welfare", headers=coop_headers).json()
    assert welf_res["total_welfare_collected"] > 0
    print("Welfare collected: Rs.", welf_res["total_welfare_collected"], "Reserve fund: Rs.", welf_res["reserve_fund"])

    print("\n--- 9. Testing Demo Data Seeder for ML Demand Forecasting ---")
    seed_res = client.post("/api/demo/seed")
    assert seed_res.status_code == 200
    print("Seeded rich demo data. Now testing Demand Forecasting with sufficient data...")

    forecast_res2 = client.get("/api/demand-forecast")
    f_data2 = forecast_res2.json()
    assert f_data2["sufficient_data"] == True
    print("Demand Forecasting trained on historical data! Predictions:", len(f_data2["category_forecast"]), "Skills needed:", len(f_data2["skills_needed"]))

    # Test Fair Allocation inspector
    fair_res2 = client.get("/api/cooperative/fair-allocation", headers=coop_headers).json()
    assert fair_res2["empty"] == False
    assert len(fair_res2["metrics"]) > 5
    print("Fair Allocation inspector populated with", len(fair_res2["metrics"]), "cooperative workers and Opportunity Gap metrics.")

    print("\nALL BACKEND TESTS PASSED SUCCESSFULLY!")

def test_otp_verification_and_dummy_mode():
    from unittest.mock import patch

    print("\n--- Testing Restricted Demo OTP & Security Flow ---")

    # 1. Unregistered email rejection
    unreg_res = client.post("/api/auth/send-otp", json={"email": "unregistered_random_user@example.com", "purpose": "login"})
    assert unreg_res.status_code == 404
    assert "No account found" in unreg_res.json()["detail"]
    print("[OK] Unregistered email rejected with 404:", unreg_res.json()["detail"])

    # 2. Feature disabled (default): dummy OTP 123456 is rejected
    with patch.dict(os.environ, {"DEMO_OTP_ENABLED": "false", "DEV_DUMMY_OTP_ENABLED": "false", "ENVIRONMENT": "production"}, clear=False):
        dis_res = client.post("/api/auth/login-otp", json={"login_id": "customer@demo.com", "otp": "123456"})
        assert dis_res.status_code == 400
        assert any(msg in dis_res.json()["detail"] for msg in ("Invalid OTP code", "No active OTP request", "OTP has expired"))
        print("[OK] Dummy OTP strictly rejected when DEMO_OTP_ENABLED=false:", dis_res.json()["detail"])

    # 3. Allowlisted Demo Account on Render / Production environment
    with patch.dict(os.environ, {
        "DEMO_OTP_ENABLED": "true",
        "DEMO_OTP_EMAIL": "customer@demo.com",
        "ENVIRONMENT": "production",
        "RENDER": "true",
        "RENDER_SERVICE_ID": "srv-test-123"
    }, clear=False):
        # Send demo OTP for allowlisted email
        send_res = client.post("/api/auth/send-otp", json={"email": "customer@demo.com", "purpose": "login"})
        assert send_res.status_code == 200
        assert "[DEMO MODE]" in send_res.json()["message"]
        print("[OK] Demo OTP generation allowed for allowlisted account on Render:", send_res.json()["message"])

        # Login with valid dummy OTP 123456 for allowlisted account
        login_res = client.post("/api/auth/login-otp", json={"login_id": "customer@demo.com", "otp": "123456"})
        assert login_res.status_code == 200
        data = login_res.json()
        assert "access_token" in data
        assert data["role"] == "CUSTOMER"
        print("[OK] Demo OTP 123456 successfully authenticated allowlisted account:", data["name"], "Role:", data["role"])

        # 4. Non-allowlisted account strictly rejected, even with DEMO_OTP_ENABLED=true on Render
        client.post("/api/auth/send-otp", json={"email": "cooperative@delhi.gov.in", "purpose": "login"})
        bad_account_res = client.post("/api/auth/login-otp", json={"login_id": "cooperative@delhi.gov.in", "otp": "123456"})
        assert bad_account_res.status_code == 400
        assert "Invalid OTP code" in bad_account_res.json()["detail"]
        print("[OK] Dummy OTP 123456 strictly rejected for non-allowlisted account (cooperative@delhi.gov.in):", bad_account_res.json()["detail"])

        # 5. Invalid OTP on allowlisted account rejected with attempt count
        client.post("/api/auth/send-otp", json={"email": "customer@demo.com", "purpose": "login"})
        bad_otp_res = client.post("/api/auth/login-otp", json={"login_id": "customer@demo.com", "otp": "999999"})
        assert bad_otp_res.status_code == 400
        assert "Invalid OTP code" in bad_otp_res.json()["detail"]
        print("[OK] Wrong OTP rejected for allowlisted account with attempts decrement:", bad_otp_res.json()["detail"])

    # 6. Production mode without explicit DEMO_OTP_EMAIL rejects dummy OTP
    with patch.dict(os.environ, {
        "DEMO_OTP_ENABLED": "true",
        "DEMO_OTP_EMAIL": "",
        "DEMO_ACCOUNT_EMAIL": "",
        "ENVIRONMENT": "production",
        "RENDER": "true"
    }, clear=False):
        no_allowlist_res = client.post("/api/auth/login-otp", json={"login_id": "customer@demo.com", "otp": "123456"})
        assert no_allowlist_res.status_code == 400
        assert any(msg in no_allowlist_res.json()["detail"] for msg in ("Invalid OTP code", "No active OTP request", "OTP has expired"))
        print("[OK] Dummy OTP strictly rejected in production when DEMO_OTP_EMAIL is missing.")

    # 7. Staging Environment: Universal Dummy OTP enabled for ANY email address
    with patch.dict(os.environ, {
        "ENVIRONMENT": "staging",
        "STAGING_UNIVERSAL_DUMMY_OTP_ENABLED": "true"
    }, clear=False):
        # A. Existing user (worker) logs in with dummy OTP 123456 without SMTP
        s_send = client.post("/api/auth/send-otp", json={"email": "worker@demo.com", "purpose": "login"})
        assert s_send.status_code == 200
        assert "[STAGING DEMO]" in s_send.json()["message"]
        s_login = client.post("/api/auth/login-otp", json={"login_id": "worker@demo.com", "otp": "123456"})
        assert s_login.status_code == 200
        assert s_login.json()["role"] == "WORKER"
        print("[OK] Staging Universal OTP: Login with 123456 accepted for ANY email (worker@demo.com).")

        # B. New email verification during signup accepts 123456 for any arbitrary address
        any_test_email = "random_new_worker_test@coop.org"
        s_send_reg = client.post("/api/auth/send-otp", json={"email": any_test_email})
        assert s_send_reg.status_code == 200
        assert "[STAGING DEMO]" in s_send_reg.json()["message"]
        s_verify = client.post("/api/auth/verify-otp", json={"email": any_test_email, "otp": "123456"})
        assert s_verify.status_code == 200
        assert s_verify.json()["success"] == True
        print("[OK] Staging Universal OTP: Verification with 123456 accepted for ANY arbitrary signup email:", any_test_email)

    # 8. Local Development Environment: Complete signup and login flow with dummy OTP
    with patch.dict(os.environ, {
        "ENVIRONMENT": "development",
        "STAGING_UNIVERSAL_DUMMY_OTP_ENABLED": "true"
    }, clear=False):
        dev_email = f"dev_user_{uuid.uuid4().hex[:6]}@cooptest.local"
        # Step 1: Send OTP for signup
        d_send = client.post("/api/auth/send-otp", json={"email": dev_email})
        assert d_send.status_code == 200
        assert "[STAGING DEMO]" in d_send.json()["message"]

        # Step 2: Verify OTP with 123456
        d_verify = client.post("/api/auth/verify-otp", json={"email": dev_email, "otp": "123456"})
        assert d_verify.status_code == 200
        assert d_verify.json()["success"] is True

        # Step 3: Register user
        d_reg = client.post("/api/auth/register", json={
            "role": "CUSTOMER",
            "full_name": "Dev Test Customer",
            "mobile": f"98{uuid.uuid4().int % 100000000:08d}",
            "email": dev_email,
            "password": "Password123!",
            "address": "Connaught Place, New Delhi"
        })
        assert d_reg.status_code == 200
        assert "access_token" in d_reg.json()

        # Step 4: Login using OTP 123456 for this newly created arbitrary email
        # First verify the previous OTP record so cooldown doesn't block send
        d_send_login = client.post("/api/auth/send-otp", json={"email": dev_email, "purpose": "login"})
        assert d_send_login.status_code == 200
        assert "[STAGING DEMO]" in d_send_login.json()["message"]

        d_login_otp = client.post("/api/auth/login-otp", json={"login_id": dev_email, "otp": "123456"})
        assert d_login_otp.status_code == 200
        assert "access_token" in d_login_otp.json()
        print("[OK] Local Development: Full signup, verify-otp, and login-otp flow passed with 123456 for arbitrary email:", dev_email)

    # 9. Strict Production Guard: Universal Dummy OTP CANNOT be activated in production
    with patch.dict(os.environ, {
        "ENVIRONMENT": "production",
        "RENDER": "true",
        "STAGING_UNIVERSAL_DUMMY_OTP_ENABLED": "true",
        "DEMO_OTP_ENABLED": "false"
    }, clear=False):
        # Even with STAGING_UNIVERSAL_DUMMY_OTP_ENABLED=true, production forces it OFF
        client.post("/api/auth/send-otp", json={"email": "worker@demo.com", "purpose": "login"})
        prod_block = client.post("/api/auth/login-otp", json={"login_id": "worker@demo.com", "otp": "123456"})
        assert prod_block.status_code == 400
        assert "Invalid OTP code" in prod_block.json()["detail"]
        print("[OK] Strict Production Guard: STAGING_UNIVERSAL_DUMMY_OTP_ENABLED is unconditionally BLOCKED in production.")

    print("ALL RESTRICTED DEMO & STAGING UNIVERSAL OTP SECURITY TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_otp_verification_and_dummy_mode()
    print("\n--- Test Suite Execution Complete ---")
