import os
import re
import hmac
import hashlib
import secrets
import logging
from pathlib import Path
from dotenv import load_dotenv
from typing import Tuple
import resend

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger("coopconnect.email")

SALT = os.getenv("OTP_SECRET_SALT", "coopconnect_otp_secure_salt_2026")
EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"


def normalize_email(email: str) -> Tuple[bool, str]:
    """
    Validates and normalizes an email address.
    Returns (is_valid, normalized_email_lowercase).
    """
    if not email:
        return False, ""
    cleaned = email.strip().lower()
    if re.match(EMAIL_REGEX, cleaned):
        return True, cleaned
    return False, ""


def generate_secure_otp(length: int = 6) -> str:
    """Generates a cryptographically secure 6-digit numeric OTP."""
    return str(secrets.randbelow(900000) + 100000)


def hash_otp(otp: str, target: str) -> str:
    """
    Generates a secure salted SHA-256 hash of the OTP bound to the recipient target.
    Target should be the normalized email.
    """
    payload = f"{SALT}:{target.strip().lower()}:{otp.strip()}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def verify_otp_hash(submitted_otp: str, target: str, stored_hash: str) -> bool:
    """Timing-attack-resistant comparison of submitted OTP with stored hash."""
    candidate_hash = hash_otp(submitted_otp, target)
    return hmac.compare_digest(candidate_hash, stored_hash)


def send_email_otp(recipient_email: str, otp: str) -> dict:
    """
    Sends CoopConnect verification OTP using Resend HTTPS Email API.
    Does not use SMTP, bypassing port 587 blocking on cloud platforms like Render Free.
    Logs errors securely without exposing credentials or OTP content.
    """
    resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
    from_email = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev").strip() or "onboarding@resend.dev"

    try:
        otp_expiry_seconds = int(os.getenv("OTP_EXPIRY", "300"))
    except ValueError:
        otp_expiry_seconds = 300
    expiry_minutes = max(1, otp_expiry_seconds // 60)

    # Safely mask email address for logging
    parts = recipient_email.split("@")
    masked_target = (
        f"{parts[0][:3]}***@{parts[1]}"
        if len(parts) == 2 and len(parts[0]) >= 3
        else "***"
    )

    if not resend_api_key or resend_api_key == "YOUR_RESEND_API_KEY":
        logger.warning(
            "Resend credentials not configured (RESEND_API_KEY missing or placeholder)."
        )
        return {
            "success": False,
            "reason": "credentials_missing",
            "message": "Email service is not configured."
        }

    # Set Resend API key
    resend.api_key = resend_api_key

    text_body = (
        f"Your CoopConnect verification OTP is: {otp}\n\n"
        f"This OTP is valid for {expiry_minutes} minutes.\n"
        "Do not share this OTP with anyone.\n"
    )

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px; }}
    .container {{ max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; }}
    .header {{ text-align: center; margin-bottom: 24px; }}
    .title {{ font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }}
    .subtitle {{ font-size: 14px; color: #64748b; }}
    .otp-box {{ text-align: center; margin: 28px 0; background: #f1f5f9; padding: 20px; border-radius: 8px; border: 1px dashed #cbd5e1; }}
    .otp-code {{ font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: 'Courier New', monospace; }}
    .info {{ font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 12px; }}
    .footer {{ text-align: center; margin-top: 32px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">CoopConnect</div>
      <div class="subtitle">Platform for Fair Work Cooperatives</div>
    </div>
    <p class="info">Hello,</p>
    <p class="info">Your CoopConnect verification code is:</p>
    <div class="otp-box">
      <div class="otp-code">{otp}</div>
    </div>
    <p class="info">This code is valid for <strong>{expiry_minutes} minutes</strong>. For security reasons, never share this OTP with anyone.</p>
    <p class="info">If you did not request this verification code, please ignore this email.</p>
    <div class="footer">
      &copy; 2026 CoopConnect. All rights reserved.
    </div>
  </div>
</body>
</html>"""

    params: resend.Emails.SendParams = {
        "from": from_email if ("<" in from_email or "@" in from_email) else f"CoopConnect <{from_email}>",
        "to": [recipient_email],
        "subject": "CoopConnect Email Verification",
        "text": text_body,
        "html": html_body,
    }

    try:
        response = resend.Emails.send(params)
        logger.info(
            "Verification OTP email successfully dispatched to %s via Resend HTTPS API (id: %s).",
            masked_target,
            response.get("id") if isinstance(response, dict) else getattr(response, "id", "sent")
        )
        return {
            "success": True,
            "message": "Verification code sent to your email."
        }
    except Exception as e:
        logger.error("Resend API error during OTP dispatch: %s", type(e).__name__)
        return {
            "success": False,
            "reason": "email_error",
            "message": "Failed to send verification email."
        }