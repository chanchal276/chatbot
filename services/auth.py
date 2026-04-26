import base64
import hashlib
import hmac
import json
import os
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Dict, Optional

from utils.logger import get_logger

logger = get_logger(__name__)

AUTH_STORE_PATH = Path("data/auth_store.json")
RESET_TOKEN_TTL_MINUTES = int(os.getenv("RESET_TOKEN_TTL_MINUTES", "30"))
AUTH_APP_URL = os.getenv("AUTH_APP_URL", "http://localhost:5173")
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USERNAME or "no-reply@example.com")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() in ("true", "1", "yes")
AUTH_SECRET = os.getenv("AUTH_SECRET", "change-this-auth-secret")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_iso() -> str:
    return utc_now().isoformat()


def _read_store() -> Dict[str, Any]:
    if not AUTH_STORE_PATH.exists():
      return {"users": {}, "sessions": {}}
    try:
        return json.loads(AUTH_STORE_PATH.read_text(encoding="utf-8"))
    except Exception:
        logger.warning("Failed to read auth store, creating a fresh one")
        return {"users": {}, "sessions": {}}


def _write_store(store: Dict[str, Any]) -> None:
    AUTH_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    AUTH_STORE_PATH.write_text(json.dumps(store, indent=2, ensure_ascii=True), encoding="utf-8")


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _hash_password(password: str, salt: Optional[str] = None) -> str:
    salt = salt or secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"{salt}${base64.urlsafe_b64encode(derived).decode('utf-8')}"


def _verify_password(password: str, hashed_password: str) -> bool:
    try:
        salt, _ = hashed_password.split("$", 1)
    except ValueError:
        return False
    return hmac.compare_digest(_hash_password(password, salt), hashed_password)


def _sign_value(value: str) -> str:
    signature = hmac.new(AUTH_SECRET.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()
    return signature


def _make_reset_token(email: str) -> str:
    expires_at = int((utc_now() + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)).timestamp())
    nonce = secrets.token_urlsafe(16)
    payload = f"{email}|{expires_at}|{nonce}"
    signature = _sign_value(payload)
    token = base64.urlsafe_b64encode(f"{payload}|{signature}".encode("utf-8")).decode("utf-8")
    return token


def _parse_reset_token(token: str) -> str:
    try:
        decoded = base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
        email, expires_at, nonce, signature = decoded.split("|", 3)
        payload = f"{email}|{expires_at}|{nonce}"
        if not hmac.compare_digest(_sign_value(payload), signature):
            raise ValueError("Invalid token signature")
        if utc_now().timestamp() > int(expires_at):
            raise ValueError("Reset token expired")
        return _normalize_email(email)
    except Exception as exc:
        raise ValueError("Invalid reset token") from exc


def _session_token() -> str:
    return secrets.token_urlsafe(32)


def _public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "email": user["email"],
        "full_name": user.get("full_name", ""),
        "created_at": user.get("created_at"),
        "updated_at": user.get("updated_at"),
    }


def register_user(email: str, password: str, full_name: str) -> Dict[str, Any]:
    store = _read_store()
    normalized_email = _normalize_email(email)
    if normalized_email in store["users"]:
        raise ValueError("An account with this email already exists")

    user = {
        "email": normalized_email,
        "full_name": full_name.strip(),
        "password_hash": _hash_password(password),
        "created_at": utc_iso(),
        "updated_at": utc_iso(),
        "reset_token": None,
        "reset_requested_at": None,
    }
    store["users"][normalized_email] = user
    _write_store(store)
    return _public_user(user)


def login_user(email: str, password: str) -> Dict[str, Any]:
    store = _read_store()
    normalized_email = _normalize_email(email)
    user = store["users"].get(normalized_email)
    if not user or not _verify_password(password, user["password_hash"]):
        raise ValueError("Invalid email or password")

    token = _session_token()
    store["sessions"][token] = {
        "email": normalized_email,
        "created_at": utc_iso(),
    }
    _write_store(store)
    return {"token": token, "user": _public_user(user)}


def logout_user(token: str) -> None:
    store = _read_store()
    if token in store["sessions"]:
        del store["sessions"][token]
        _write_store(store)


def get_user_by_token(token: str) -> Optional[Dict[str, Any]]:
    store = _read_store()
    session = store["sessions"].get(token)
    if not session:
        return None
    user = store["users"].get(session["email"])
    if not user:
        return None
    return _public_user(user)


def update_profile(token: str, full_name: str) -> Dict[str, Any]:
    store = _read_store()
    session = store["sessions"].get(token)
    if not session:
        raise ValueError("Invalid session")
    user = store["users"].get(session["email"])
    if not user:
        raise ValueError("User not found")
    user["full_name"] = full_name.strip()
    user["updated_at"] = utc_iso()
    _write_store(store)
    return _public_user(user)


def send_reset_email(email: str) -> str:
    store = _read_store()
    normalized_email = _normalize_email(email)
    user = store["users"].get(normalized_email)
    if not user:
        raise ValueError("No account found for this email")

    token = _make_reset_token(normalized_email)
    reset_link = f"{AUTH_APP_URL}?reset_token={token}&email={normalized_email}"
    user["reset_token"] = token
    user["reset_requested_at"] = utc_iso()
    user["updated_at"] = utc_iso()
    _write_store(store)

    message = EmailMessage()
    message["Subject"] = "Reset your Smart Research Chatbot password"
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = normalized_email
    message.set_content(
        "We received a request to reset your password.\n\n"
        f"Open this link to choose a new password:\n{reset_link}\n\n"
        f"This link expires in {RESET_TOKEN_TTL_MINUTES} minutes."
    )

    if not SMTP_HOST:
        logger.warning("SMTP is not configured. Reset link for %s: %s", normalized_email, reset_link)
        return reset_link

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as smtp:
        if SMTP_USE_TLS:
            smtp.starttls()
        if SMTP_USERNAME and SMTP_PASSWORD:
            smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
        smtp.send_message(message)

    return reset_link


def reset_password(token: str, new_password: str) -> Dict[str, Any]:
    email = _parse_reset_token(token)
    store = _read_store()
    user = store["users"].get(email)
    if not user:
        raise ValueError("User not found")
    if user.get("reset_token") != token:
        raise ValueError("Reset token is no longer valid")

    user["password_hash"] = _hash_password(new_password)
    user["reset_token"] = None
    user["reset_requested_at"] = None
    user["updated_at"] = utc_iso()

    for session_token, session in list(store["sessions"].items()):
        if session.get("email") == email:
            del store["sessions"][session_token]

    _write_store(store)
    return _public_user(user)
