import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from pymongo import MongoClient
from dotenv import load_dotenv
import pickle, json, os
from bson import ObjectId

def convert(obj):
    """Recursively convert ObjectId → str for JSON serialisation."""
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, dict):
        return {k: convert(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert(i) for i in obj]
    return obj

load_dotenv()

MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb+srv://admin:admin123@trusteye.itkr2zr.mongodb.net/?appName=trusteye"
)
client = MongoClient(MONGO_URI)
db = client["test"]

# ---------------------------------------------------------------------------
# Load features
# ---------------------------------------------------------------------------
df = pd.read_csv("../data/features.csv")

# FIX: updated feature list — now includes new columns from feature_extract
FEATURES = [
    "hour", "day_of_week", "is_off_hours", "is_weekend",
    "file_size_mb", "is_external_dest", "is_unauthorized",
    "data_rate_mbps", "pages_printed", "data_transferred",
    "is_unknown_dest", "is_external_server",
    "is_download", "is_upload", "is_send_data",
    "is_print", "is_stream", "is_login",
]

# IMPROVEMENT: use only last 500 rows (rolling window) — keeps model fresh
df = df.tail(500)
df["entityId"] = df["entityId"].astype(str)

groups = df.groupby("entityId")

entity_models  = {}
entity_scalers = {}
entity_score_bounds = {}   # FIX: save (min, max) per entity for consistent scoring
entity_scores  = []

for entity, group in groups:
    if len(group) < 5:
        continue  # not enough data

    # Ensure every feature column exists (fill missing with 0)
    for col in FEATURES:
        if col not in group.columns:
            group[col] = 0

    X = group[FEATURES].fillna(0)

    # Scale
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # IMPROVEMENT: estimate contamination from labelled riskTag if available
    if "riskTag" in group.columns:
        susp_ratio = (group["riskTag"] == "suspicious").mean()
        contamination = float(np.clip(susp_ratio, 0.05, 0.4))
    else:
        contamination = 0.1

    # IMPROVEMENT: more estimators → more stable scores
    model = IsolationForest(
        n_estimators=200,
        contamination=contamination,
        max_samples="auto",
        random_state=42,
    )
    model.fit(X_scaled)

    entity_models[entity]  = model
    entity_scalers[entity] = scaler

    # Compute anomaly scores
    raw_scores = model.decision_function(X_scaled)

    min_s, max_s = float(raw_scores.min()), float(raw_scores.max())
    entity_score_bounds[entity] = (min_s, max_s)  # save for inference

    # FIX: normalise using per-entity min/max — avoids always-100 bug
    if max_s - min_s == 0:
        risk_scores = np.zeros_like(raw_scores)
    else:
        risk_scores = 100.0 - ((raw_scores - min_s) / (max_s - min_s) * 100.0)

    risk_scores = np.round(np.clip(risk_scores, 0, 100), 1)
    max_score = float(risk_scores.max())

    entity_scores.append({
        "entityId":   str(entity),
        "risk_score": max_score,
        "risk_level": (
            "critical" if max_score >= 80 else
            "high"     if max_score >= 60 else
            "medium"   if max_score >= 40 else
            "low"
        ),
        "total_logs":      int(len(group)),
        "anomaly_count":   int((model.predict(X_scaled) == -1).sum()),
    })

# Sort by risk descending
entity_scores.sort(key=lambda x: x["risk_score"], reverse=True)
safe_scores = convert(entity_scores)

print("Scores:", safe_scores)

# Persist to MongoDB
db["scores"].delete_many({})
if safe_scores:
    db["scores"].insert_many(safe_scores)

# Persist models
with open("entity_models.pkl",  "wb") as f:
    pickle.dump(entity_models, f)
with open("entity_scalers.pkl", "wb") as f:
    pickle.dump(entity_scalers, f)
# FIX: also save score bounds
with open("entity_score_bounds.pkl", "wb") as f:
    pickle.dump(entity_score_bounds, f)

# Save JSON snapshot
with open("../data/scores.json", "w") as f:
    json.dump(safe_scores, f, indent=2, default=str)

print(f"\nTraining complete — models for {len(entity_models)} entities")
for e in entity_scores:
    print(e)
