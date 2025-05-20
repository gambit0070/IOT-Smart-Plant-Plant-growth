from flask import Blueprint, jsonify, g
import sqlite3

bp_alerts = Blueprint("alerts", __name__)
DB = "blynk_data.db"

def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB, check_same_thread=False)
    return g.db

@bp_alerts.route("/alerts", methods=["GET"])
def get_alerts():
    rows = db().execute(
        "SELECT id, type, message, timestamp FROM alerts WHERE is_read=0"
    ).fetchall()
    alerts = [
        {"id": r[0], "type": r[1], "message": r[2], "timestamp": r[3]}
        for r in rows
    ]
    if alerts:
        ids = tuple(a["id"] for a in alerts)
        db().execute(f"UPDATE alerts SET is_read=1 WHERE id IN ({','.join('?'*len(ids))})", ids)
        db().commit()
    return jsonify(alerts)