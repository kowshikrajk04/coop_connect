from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
import models
from routers import auth, customer, worker, cooperative, bookings, payments, demand_forecast, notifications, demo_data, assessment

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CoopConnect API",
    description="Backend services for CoopConnect – AI-Powered Cooperative Workforce Marketplace",
    version="1.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(auth.router)
app.include_router(customer.router)
app.include_router(worker.router)
app.include_router(cooperative.router)
app.include_router(bookings.router)
app.include_router(payments.router)
app.include_router(demand_forecast.router)
app.include_router(notifications.router)
app.include_router(demo_data.router)
app.include_router(assessment.router)

@app.get("/")
def root():
    return {
        "platform": "CoopConnect",
        "tagline": "Fair Work • Stronger Communities",
        "status": "online",
        "version": "1.0.0"
    }

@app.get("/health")
def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
