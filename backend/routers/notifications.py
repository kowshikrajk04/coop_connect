from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from auth_utils import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("")
def get_user_notifications(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    notifs = db.query(models.Notification).filter(
        models.Notification.user_id == user.id
    ).order_by(models.Notification.created_at.desc()).limit(30).all()

    unread_count = sum(1 for n in notifs if not n.read)
    return {
        "unread_count": unread_count,
        "notifications": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "read": n.read,
                "created_at": n.created_at.strftime("%d %b, %I:%M %p")
            }
            for n in notifs
        ]
    }

@router.post("/{notif_id}/read")
def mark_notification_read(notif_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(models.Notification).filter(
        models.Notification.id == notif_id,
        models.Notification.user_id == user.id
    ).first()
    if n:
        n.read = True
        db.commit()
    return {"success": True}
