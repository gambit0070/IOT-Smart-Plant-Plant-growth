from flask import Blueprint, request, jsonify, g
import sqlite3

bp_notification = Blueprint("notification_settings", __name__)

DB_FILE = "blynk_data.db"          # путь к вашей базе

def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_FILE, check_same_thread=False)
    return g.db


# ------------------- GET  /notification-settings -------------------
@bp_notification.route("/notification-settings", methods=["GET"])
def get_notification_settings():
    row = db().execute("SELECT * FROM notification_settings WHERE id = 1").fetchone()
    if not row:
        return jsonify({"error": "not found"}), 404

    columns = [d[1] for d in db().execute("PRAGMA table_info(notification_settings)")]
   

    return jsonify(dict(zip(columns, row)))


# ------------------- POST /notification-settings -------------------
@bp_notification.route("/notification-settings", methods=["POST"])
def save_notification_settings():
    data = request.get_json(force=True)

    # список допустимых полей — игнорируем всё лишнее
    allowed = [
        "min_temp", "max_temp", "min_humid", "max_humid",
        "min_press", "max_press",
        "cold_alert", "heat_alert", "dry_alert", "humid_alert",
        "low_press_alert", "high_press_alert"
    ]
    payload = {k: data.get(k) for k in allowed}

    set_clause = ", ".join(f"{k} = :{k}" for k in payload.keys())
    q = f"UPDATE notification_settings SET {set_clause} WHERE id = 1"

    db().execute(q, payload)
    db().commit()
    return jsonify({"status": "ok"})