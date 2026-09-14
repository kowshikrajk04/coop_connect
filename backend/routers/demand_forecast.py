from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models
from ml.demand_forecaster import forecaster

router = APIRouter(prefix="/api/demand-forecast", tags=["demand-forecast"])

@router.get("")
def get_demand_forecast(db: Session = Depends(get_db)):
    bookings = db.query(models.Booking).all()
    booking_dicts = []
    for b in bookings:
        booking_dicts.append({
            "service_type": b.service_type,
            "customer_address": b.customer_address,
            "scheduled_time": b.scheduled_time,
            "created_at": b.created_at.isoformat()
        })

    forecast_result = forecaster.generate_forecast(booking_dicts)
    return forecast_result
