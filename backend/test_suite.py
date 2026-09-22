import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from fastapi.testclient import TestClient
from main import app
from database import Base, engine

client = TestClient(app)

def test_full_coopconnect_flow():
    print("\n--- 1. Testing Reset to Initial Empty State ---")
    res = client.post("/api/demo/reset")
    assert res.status_code == 200, res.text
    print("Reset successful:", res.json()["message"])

    print("\n--- 2. Verifying Pure Empty State for Cooperatives ---")
    login_res = client.post("/api/auth/login", json={"login_id": "cooperative@delhi.gov.in", "password": "CoopPass123!"})
    assert login_res.status_code == 200, login_res.text
    coop_token = login_res.json()["access_token"]
    coop_headers = {"Authorization": f"Bearer {coop_token}"}

    dash_res = client.get("/api/cooperative/dashboard", headers=coop_headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["total_workers"] == 0
    assert dash_data["total_bookings"] == 0
    print("Cooperative Dashboard verified in clean empty state:", dash_data)

    # Verify Fair Allocation empty state
    fair_res = client.get("/api/cooperative/fair-allocation", headers=coop_headers)
    assert fair_res.status_code == 200
    assert fair_res.json()["empty"] == True
    print("Fair Allocation empty state verified:", fair_res.json()["message"])

    # Verify Demand Forecasting empty state ("Not enough data for reliable forecasting yet.")
    forecast_res = client.get("/api/demand-forecast")
    assert forecast_res.status_code == 200
    f_data = forecast_res.json()
    assert f_data["sufficient_data"] == False
    assert f_data["message"] == "Not enough data for reliable forecasting yet."
    print("Demand Forecast empty state confirmed:", f_data["message"])

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

    print("\n--- Testing OTP Verification & Dummy Mode Flow ---")

    # 1. Unregistered email rejection
    unreg_res = client.post("/api/auth/send-otp", json={"email": "unregistered_random_user@example.com", "purpose": "login"})
    assert unreg_res.status_code == 404
    assert "No account found" in unreg_res.json()["detail"]
    print("Unregistered email rejected with 404:", unreg_res.json()["detail"])

    # 2. Dummy OTP enabled: send and login with 123456
    with patch.dict(os.environ, {"DEV_DUMMY_OTP_ENABLED": "true", "ENVIRONMENT": "development"}, clear=False):
        send_res = client.post("/api/auth/send-otp", json={"email": "customer@demo.com", "purpose": "login"})
        assert send_res.status_code == 200
        assert "[DEV MODE]" in send_res.json()["message"]
        print("Dummy OTP send successful:", send_res.json()["message"])

        # Login with valid dummy OTP 123456
        login_res = client.post("/api/auth/login-otp", json={"login_id": "customer@demo.com", "otp": "123456"})
        assert login_res.status_code == 200
        data = login_res.json()
        assert "access_token" in data
        assert data["role"] == "CUSTOMER"
        print("Dummy OTP 123456 accepted! Logged in as:", data["name"], "Role:", data["role"])

    # 3. Invalid OTP rejected with attempts count
    with patch.dict(os.environ, {"DEV_DUMMY_OTP_ENABLED": "true", "ENVIRONMENT": "development"}, clear=False):
        # Generate new OTP
        client.post("/api/auth/send-otp", json={"email": "customer@demo.com", "purpose": "login"})
        bad_res = client.post("/api/auth/login-otp", json={"login_id": "customer@demo.com", "otp": "999999"})
        assert bad_res.status_code == 400
        assert "Invalid OTP code" in bad_res.json()["detail"]
        print("Invalid OTP rejected with attempt count:", bad_res.json()["detail"])

    # 4. Dummy OTP rejected in production
    with patch.dict(os.environ, {"DEV_DUMMY_OTP_ENABLED": "true", "ENVIRONMENT": "production"}, clear=False):
        prod_res = client.post("/api/auth/login-otp", json={"login_id": "customer@demo.com", "otp": "123456"})
        assert prod_res.status_code == 400
        assert "Invalid OTP code" in prod_res.json()["detail"]
        print("Dummy OTP strictly rejected in production environment.")

    print("ALL OTP & DUMMY MODE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_otp_verification_and_dummy_mode()
    test_full_coopconnect_flow()
