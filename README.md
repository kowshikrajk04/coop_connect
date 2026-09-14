# CoopConnect – AI-Powered Cooperative Workforce Marketplace

> **Tagline**: *“Fair Work • Stronger Communities”*

CoopConnect is a production-style full-stack web application designed for Indian labour cooperatives (such as electricians, plumbers, carpenters, painters, cleaners, caregivers, drivers, gardeners, and technicians).

Unlike commercial gig-booking apps that extract excessive platform fees and concentrate jobs among a few top-rated individuals, CoopConnect empowers registered labour cooperatives with **fairness-aware AI allocation**, **transparent pricing**, **route optimization**, **dedicated worker welfare funds**, and **machine-learning demand forecasting**.

---

## Key Features & Pillars

1. **Verified Cooperative Workers**
   - 4-Step Worker Registration: Personal Information, Multiple Trade Skills, Document Proofs, and Practical Scenario-Based Skill Assessments.
   - Speech-to-Text voice answers supported via the Web Speech API with bilingual (English/Hindi) testing.
   - Cooperative Board Dossier review and approval gate (`PENDING_VERIFICATION` → `VERIFIED`). Only verified workers are allocated customer jobs.

2. **Fairness-Aware AI Worker Allocation**
   - Mathematical formula:
     $$\text{Suitable Worker Score} = (0.25 \times \text{Skill}) + (0.15 \times \text{Success}) + (0.15 \times \text{Availability}) + (0.15 \times \text{Distance}) + (0.10 \times \text{Rating}) + (0.20 \times \text{Opportunity Factor})$$
   - Explicit **Opportunity Gap** calculation prevents commercial gig bias by boosting qualified members with fewer recent assignments.
   - Strict Emergency Rule Evaluation: evaluates safety hazards (sparks, burst pipes, gas leaks) and boosts proximity and instant availability weighting.

3. **Transparent Cooperative Pricing & Digital Invoicing**
   - Zero hidden markups.
   - Configurable cooperative fee split (e.g., 90% Worker Payout, 5% Cooperative Fee, 5% Worker Welfare Contribution).
   - Digital invoice generation with breakdown and print/export capability.

4. **Route & Schedule Optimization**
   - Sequences daily customer jobs using nearest-neighbor greedy TSP to minimize travel distance and fatigue.
   - Real-time ETA and direct **Start Navigation** button opening Google Maps directions.

5. **Democratic Cooperative Management & Welfare Ledger**
   - Transparent welfare pool tracking across Reserve Fund (40%), Skill Training (25%), Emergency Healthcare (20%), and Worker Pension (15%).
   - Immutable audit ledger recording every credit and transaction.

6. **Demand Forecasting & Workforce Planning**
   - Machine learning demand forecasting for service trades, location hotspots, and peak time windows.
   - **Strict Data Threshold Guarantee**: If historical bookings are fewer than 8, displays the truthful status: **“Not enough data for reliable forecasting yet.”**

7. **Clean, Trustworthy Design System**
   - Pure crisp white background (`#ffffff`) throughout.
   - Primary cooperative blue `#2563eb`.
   - Large readable typography, large action buttons, rounded cards, soft shadows.
   - Genuine empty states by default across all screens with an optional, clearly labeled **"Load Demo Data"** button and **"Reset to Empty State"** tool.

---

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide React icons, Web Speech API.
- **Backend**: FastAPI (Python), SQLAlchemy, Pydantic, Scikit-learn / XGBoost.
- **Database**: SQLite default (`coopconnect.db`) with automatic schema creation and PostgreSQL compatibility via `DATABASE_URL`.

---

## Quick Start

### 1. Launch Backend and Frontend Together
On Windows, double-click or run:
```powershell
.\run_coopconnect.bat
```

Or run separately:

**Backend (Terminal 1):**
```powershell
cd backend
python main.py
```
Backend API will be available at `http://127.0.0.1:8000` (Swagger Docs: `http://127.0.0.1:8000/docs`).

**Frontend (Terminal 2):**
```powershell
cd frontend
npm run dev
```
Frontend will be available at `http://localhost:3000`.

---

## User Roles & Demonstration Accounts

The platform launches with clean, genuine empty states. You can either register new accounts through the forms or click **"Load Demo Data (Optional)"** in the top navigation bar to populate realistic cooperative scenarios.

| Role | Demo Login | Password | Key Features |
|---|---|---|---|
| **Customer** | `customer@demo.com` | `DemoPass123!` | Book 10 trades, emergency evaluation, track booking, UPI payment, invoice, rating |
| **Worker** | `worker@demo.com` | `DemoPass123!` | Availability toggle, route optimization, completion photo proof, earnings & welfare |
| **Cooperative** | `cooperative@delhi.gov.in` | `CoopPass123!` | Worker verification dossier, fair allocation metrics, welfare ledger, demand forecast |

---

## Automated Test Suite
To run the automated backend verification test suite covering all 9 core workflows:
```powershell
python backend/test_suite.py
```
