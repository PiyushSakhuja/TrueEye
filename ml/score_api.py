from flask import Flask, jsonify, request
from pymongo import MongoClient
from dotenv import load_dotenv
import pickle, pandas as pd, numpy as np, os
from datetime import datetime

load_dotenv()

app = Flask(__name__)

# FIX: read MongoDB URI from env, not hardcoded
MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb+srv://admin:admin123@trusteye.itkr2zr.mongodb.net/"
)
client = MongoClient(MONGO_URI)
db = client["test"]

# ---------------------------------------------------------------------------
# Load models at startup
# ---------------------------------------------------------------------------
def load_models():
    global entity_models, entity_scalers, entity_score_bounds
    try:
        entity_models       = pickle.load(open("entity_models.pkl",       "rb"))
        entity_scalers      = pickle.load(open("entity_scalers.pkl",      "rb"))
        # FIX: load score bounds for consistent per-entity normalisation
        entity_score_bounds = pickle.load(open("entity_score_bounds.pkl", "rb"))
    except FileNotFoundError as e:
        print(f"Warning: model file missing ({e}). Run train.py first.")
        entity_models       = {}
        entity_scalers      = {}
        entity_score_bounds = {}

load_models()

# FIX: updated feature list (must match train.py exactly)
FEATURES = [
    "hour", "day_of_week", "is_off_hours", "is_weekend",
    "file_size_mb", "is_external_dest", "is_unauthorized",
    "data_rate_mbps", "pages_printed", "data_transferred",
    "is_unknown_dest", "is_external_server",
    "is_download", "is_upload", "is_send_data",
    "is_print", "is_stream", "is_login",
]

def extract_features(log):
    """Extract feature dict from a raw log document."""
    meta   = log.get("metadata", {})
    action = log.get("action", "")

    timestamp = log.get("timestamp")
    if isinstance(timestamp, str):
        try:
            dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError:
            dt = datetime.now()
    elif isinstance(timestamp, datetime):
        dt = timestamp
    else:
        dt = datetime.now()

    hour = dt.hour
    dow  = dt.weekday()

    return {
        "hour":               hour,
        "day_of_week":        dow,
        "is_off_hours":       1 if hour < 8 or hour > 20 else 0,
        "is_weekend":         1 if dow >= 5 else 0,
        "file_size_mb":       meta.get("fileSizeMB", 0),
        "is_external_dest":   1 if meta.get("destination", "") == "external"        else 0,
        "is_unauthorized":    1 if meta.get("accessType", "") == "unauthorized"     else 0,
        "data_rate_mbps":     meta.get("dataRateMBps", 0),
        "pages_printed":      meta.get("pages", 0),
        "data_transferred":   meta.get("dataTransferredMB", 0),
        "is_unknown_dest":    1 if "unknown" in str(meta.get("destinationIP", "")) else 0,
        "is_external_server": 1 if meta.get("destination", "") == "external_server" else 0,
        "is_download":        1 if action == "download"  else 0,
        "is_upload":          1 if action == "upload"    else 0,   # FIX: was missing
        "is_send_data":       1 if action == "send_data" else 0,
        "is_print":           1 if action == "print"     else 0,
        "is_stream":          1 if action == "stream"    else 0,
        "is_login":           1 if action == "login"     else 0,
    }

def compute_risk(model, scaler, score_bounds, row_dict):
    """Return (risk_score 0-100, is_anomaly bool) using stored bounds."""
    X        = pd.DataFrame([row_dict])[FEATURES].fillna(0)
    X_scaled = scaler.transform(X)
    raw      = float(model.decision_function(X_scaled)[0])

    min_s, max_s = score_bounds
    if max_s - min_s == 0:
        risk = 50.0
    else:
        # FIX: use training distribution for consistent normalisation
        risk = float(np.clip(
            100.0 - ((raw - min_s) / (max_s - min_s) * 100.0),
            0, 100
        ))

    is_anomaly = int(model.predict(X_scaled)[0] == -1)
    return round(risk, 1), is_anomaly


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/health")
def health():
    return jsonify({"status": "ok", "entities": list(entity_models.keys())})


@app.route("/scores")
def get_scores():
    scores = list(db["scores"].find({}, {"_id": 0}))
    return jsonify(scores)


@app.route("/score-one", methods=["POST"])
def score_one():
    """Score a single log document sent as JSON body."""
    try:
        log       = request.json
        entity_id = log.get("entityId", "")
        row       = extract_features(log)

        if entity_id not in entity_models:
            return jsonify({
                "entityId": entity_id,
                "message":  "Not enough data to build a model yet — send more logs."
            }), 202

        risk, is_anomaly = compute_risk(
            entity_models[entity_id],
            entity_scalers[entity_id],
            entity_score_bounds[entity_id],
            row,
        )

        risk_level = (
            "critical" if risk >= 80 else
            "high"     if risk >= 60 else
            "medium"   if risk >= 40 else
            "low"
        )

        # Persist alert if high risk
        if risk >= 60:
            db["alerts"].insert_one({
                "entityId":   entity_id,
                "risk_score": risk,
                "risk_level": risk_level,
                "is_anomaly": is_anomaly,
                "log":        log,
                "created_at": datetime.utcnow(),
            })

        return jsonify({
            "entityId":   entity_id,
            "risk_score": risk,
            "risk_level": risk_level,
            "is_anomaly": is_anomaly,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/retrain", methods=["POST"])
def retrain():
    """Re-extract features then retrain all entity models."""
    import subprocess
    ml_dir = os.path.dirname(os.path.abspath(__file__))
    for script in ["feature_extract.py", "train.py"]:
        result = subprocess.run(
            ["python", os.path.join(ml_dir, script)],
            capture_output=True, text=True, cwd=ml_dir
        )
        if result.returncode != 0:
            return jsonify({"error": f"{script} failed", "stderr": result.stderr}), 500
    load_models()          # reload after training
    return jsonify({"status": "Model retrained", "entities": list(entity_models.keys())})


if __name__ == "__main__":
    app.run(port=5000, debug=True)
