import math
from typing import List, Dict, Any, Optional
import numpy as np

try:
    from sklearn.ensemble import GradientBoostingRegressor
    import xgboost as xgb
    HAS_ML = True
except ImportError:
    HAS_ML = False

def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine formula to calculate spherical distance between coordinates in km"""
    R = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

class FairnessAwareWorkerAllocator:
    """
    Fairness-Aware AI Worker Allocation Engine.
    
    Formula:
    Suitable Worker Score = 
        w_skill * SkillSuitability +
        w_success * ServiceSuccess +
        w_availability * Availability +
        w_distance * LocationSuitability +
        w_rating * RatingScore +
        w_fairness * OpportunityGapFactor
    """
    
    def __init__(self):
        # Default balanced weights
        self.w_skill = 0.25
        self.w_success = 0.15
        self.w_avail = 0.15
        self.w_distance = 0.15
        self.w_rating = 0.10
        self.w_fairness = 0.20

    def evaluate_emergency_priority(self, is_emergency: bool, reason: Optional[str]) -> str:
        """
        Predefined priority evaluation rules:
        - CRITICAL: Electrical hazard, live spark, major water burst, safety risk
        - HIGH: Gas smell, major sewage leakage, essential equipment failure
        - MEDIUM: Single light failure, slow leak
        - LOW: Normal requested services
        """
        if not is_emergency:
            return "NORMAL"
        
        if not reason:
            return "HIGH"
            
        reason_lower = reason.lower()
        critical_keywords = [
            "spark", "electric shock", "short circuit", "fire", "live wire", 
            "hazard", "burst pipe", "flooding", "safety", "danger", "urgent"
        ]
        high_keywords = [
            "leak", "gas", "sewage", "overflow", "no power", "blackout", "elderly"
        ]
        
        for kw in critical_keywords:
            if kw in reason_lower:
                return "CRITICAL"
        for kw in high_keywords:
            if kw in reason_lower:
                return "HIGH"
                
        return "MEDIUM"

    def rank_workers(
        self,
        service_type: str,
        customer_lat: float,
        customer_lng: float,
        candidate_workers: List[Dict[str, Any]],
        is_emergency: bool = False,
        emergency_priority: str = "NORMAL"
    ) -> List[Dict[str, Any]]:
        """
        Filters eligible verified workers and ranks them using multi-objective fairness AI scoring.
        """
        if not candidate_workers:
            return []

        # Adjust weights dynamically if Emergency
        w_skill = self.w_skill
        w_success = self.w_success
        w_avail = self.w_avail
        w_dist = self.w_distance
        w_rating = self.w_rating
        w_fairness = self.w_fairness

        if is_emergency or emergency_priority in ["CRITICAL", "HIGH"]:
            # Prioritize distance proximity and instant availability for urgent response
            w_dist = 0.35
            w_avail = 0.25
            w_skill = 0.20
            w_fairness = 0.10
            w_rating = 0.05
            w_success = 0.05

        # Compute average jobs among candidates to calculate relative opportunity gap
        all_job_counts = [w.get("completed_jobs", 0) + w.get("active_jobs", 0) for w in candidate_workers]
        avg_jobs = max(1.0, float(np.mean(all_job_counts)) if all_job_counts else 1.0)
        max_jobs = max(1.0, float(np.max(all_job_counts)) if all_job_counts else 1.0)

        scored_candidates = []

        for worker in candidate_workers:
            # 1. Verification and eligibility gate: ONLY verified workers can be allocated
            if worker.get("status") != "VERIFIED":
                continue

            # Must have the requested skill
            worker_skills = worker.get("skills", [])
            has_skill = any(s.get("skill_name") == service_type for s in worker_skills)
            if not has_skill:
                continue

            # Check skill assessment score
            assessments = worker.get("assessments", [])
            skill_assess = next((a for a in assessments if a.get("skill_name") == service_type), None)
            assessment_score = skill_assess.get("score", 75.0) if skill_assess else 70.0
            
            # 1. Skill Suitability Score (0 - 100)
            skill_exp = next((s.get("years_experience", 1) for s in worker_skills if s.get("skill_name") == service_type), 1)
            skill_score = min(100.0, (assessment_score * 0.7) + (min(skill_exp, 10) * 3.0))

            # 2. Service Success Score (0 - 100)
            total = max(1, worker.get("total_jobs", 0))
            completed = worker.get("completed_jobs", 0)
            completion_ratio = completed / total if total > 0 else 0.8
            success_score = completion_ratio * 100.0

            # 3. Availability Score (0 - 100)
            is_avail = 1.0 if worker.get("is_available", True) else 0.0
            active_jobs = worker.get("active_jobs", 0)
            # Penalize if already carrying multiple active jobs
            workload_penalty = max(0.0, 1.0 - (active_jobs * 0.3))
            availability_score = (is_avail * 80.0) + (workload_penalty * 20.0)

            # 4. Location Suitability Score (0 - 100)
            w_lat = worker.get("latitude", customer_lat)
            w_lng = worker.get("longitude", customer_lng)
            distance_km = calculate_distance_km(customer_lat, customer_lng, w_lat, w_lng)
            # Within 2 km = 100, drops off smoothly; > 25 km gets lower score
            distance_score = max(10.0, 100.0 - (distance_km * 3.5))

            # 5. Rating Score (0 - 100)
            rating = worker.get("rating", 5.0)
            rating_score = (rating / 5.0) * 100.0

            # 6. Opportunity Gap / Fairness Factor (0 - 100)
            # High score for qualified workers who have received fewer jobs recently!
            worker_jobs = worker.get("completed_jobs", 0) + active_jobs
            if max_jobs == 0:
                fairness_factor = 95.0
            else:
                # Inversely proportional to workload ratio
                allocation_ratio = worker_jobs / max_jobs
                fairness_factor = max(15.0, 100.0 - (allocation_ratio * 80.0))

            # Composite Suitable Worker Score
            composite_score = (
                (w_skill * skill_score) +
                (w_success * success_score) +
                (w_avail * availability_score) +
                (w_dist * distance_score) +
                (w_rating * rating_score) +
                (w_fairness * fairness_factor)
            )

            # Classify Opportunity Gap for Cooperative dashboard
            if fairness_factor >= 75.0:
                opp_gap = "High Opportunity Need"
            elif fairness_factor <= 35.0:
                opp_gap = "Heavily Utilized"
            else:
                opp_gap = "Balanced"

            scored_candidates.append({
                "worker_id": worker["id"],
                "worker_name": worker["full_name"],
                "mobile": worker.get("mobile"),
                "suitability_score": round(composite_score, 1),
                "skill_score": round(skill_score, 1),
                "success_score": round(success_score, 1),
                "availability_score": round(availability_score, 1),
                "distance_score": round(distance_score, 1),
                "distance_km": distance_km,
                "rating_score": round(rating_score, 1),
                "fairness_factor": round(fairness_factor, 1),
                "opportunity_gap": opp_gap,
                "active_jobs": active_jobs,
                "completed_jobs": completed,
                "rating": rating
            })

        # Sort descending by composite suitability score
        scored_candidates.sort(key=lambda x: x["suitability_score"], reverse=True)
        return scored_candidates

allocator = FairnessAwareWorkerAllocator()
