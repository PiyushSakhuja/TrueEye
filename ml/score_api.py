from flask import Flask, jsonify, request
from pymongo import MongoClient
from dotenv import load_dotenv
import pickle, pandas as pd, numpy as np, os, subprocess
from datetime import datetime
load_dotenv()
app = Flask(__name__)

client = MongoClient("mongodb+srv://admin:admin123@trusteye.itkr2zr.mongodb.net/?appName=trusteye")
db = client["test"]

model  = pickle.load(open("model.pkl", "rb"))
scaler = pickle.load(open("scaler.pkl", "rb"))

FEATURES = [
    "hour", "is_off_hours",
    "file_size_mb", "is_external_dest", "is_unauthorized",
    "data_rate_mbps", "pages_printed", "data_transferred",
    "is_unknown_dest", "is_external_server",
    "is_download", "is_send_data", "is_print", "is_stream"
]

@app.route('/scores')
def get_scores():
    scores = list(db["scores"].find({}, {"_id": 0}))
    return jsonify(scores)

@app.route('/score-one', methods=['POST'])
def score_one():
    """Score a single new log entry in real time"""
    log = request.json
    meta = log.get("metadata", {})
    timestamp = log.get("timestamp")
    if isinstance(timestamp, str):
        dt = datetime.fromisoformat(timestamp)
    else:
        dt = timestamp

    hour = dt.hour
    row = {
        "hour":               hour,
        "is_off_hours":       1 if hour < 8 or hour > 20 else 0,
        "file_size_mb":       meta.get("fileSizeMB", 0),
        "is_external_dest":   1 if meta.get("destination", "") == "external" else 0,
        "is_unauthorized":    1 if meta.get("accessType", "") == "unauthorized" else 0,
        "data_rate_mbps":     meta.get("dataRateMBps", 0),
        "pages_printed":      meta.get("pages", 0),
        "data_transferred":   meta.get("dataTransferredMB", 0),
        "is_unknown_dest":    1 if "unknown" in str(meta.get("destinationIP","")) else 0,
        "is_external_server": 1 if meta.get("destination","") == "external_server" else 0,
        "is_download":        1 if log["action"] == "download" else 0,
        "is_send_data":       1 if log["action"] == "send_data" else 0,
        "is_print":           1 if log["action"] == "print" else 0,
        "is_stream":          1 if log["action"] == "stream" else 0,
    }

    X = pd.DataFrame([row])[FEATURES].fillna(0)
    X_scaled = scaler.transform(X)
    raw = model.decision_function(X_scaled)[0]

    # Use same scale as training (rough estimate)
    risk = float(np.clip(100 - ((raw + 0.5) / 1.0 * 100), 0, 100))

    return jsonify({
        "entityId":   log["entityId"],
        "risk_score": round(risk, 1),
        "risk_level": "critical" if risk >= 80 else "high" if risk >= 60 else "medium" if risk >= 40 else "low"
    })

@app.route('/retrain', methods=['POST'])
def retrain():
    subprocess.run(["python", "feature_extract.py"])
    subprocess.run(["python", "train.py"])
    return jsonify({"status": "Model retrained successfully"})

if __name__ == '__main__':
    app.run(port=5000, debug=True)