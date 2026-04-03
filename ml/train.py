import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from pymongo import MongoClient
from dotenv import load_dotenv
import pickle, json, os

load_dotenv()

client = MongoClient("mongodb+srv://admin:admin123@trusteye.itkr2zr.mongodb.net/?appName=trusteye")
db = client["test"]

df = pd.read_csv("../data/features.csv")

FEATURES = [
    "hour", "is_off_hours",
    "file_size_mb", "is_external_dest", "is_unauthorized",
    "data_rate_mbps", "pages_printed", "data_transferred",
    "is_unknown_dest", "is_external_server",
    "is_download", "is_send_data", "is_print", "is_stream"
]

X = df[FEATURES].fillna(0)

# Scale features so large file sizes don't dominate
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Train model
model = IsolationForest(n_estimators=100, contamination=0.15, random_state=42)
model.fit(X_scaled)

# Raw anomaly scores (more negative = more anomalous)
raw_scores = model.decision_function(X_scaled)

# Convert to 0–100 risk score
min_s, max_s = raw_scores.min(), raw_scores.max()
risk_scores = 100 - ((raw_scores - min_s) / (max_s - min_s) * 100)
risk_scores = np.round(risk_scores, 1)

df["risk_score"] = risk_scores

# Group by entity — take MAX risk score
entity_scores = {}
for _, row in df.iterrows():
    eid = row["entityId"]
    score = row["risk_score"]
    if eid not in entity_scores or score > entity_scores[eid]["risk_score"]:
        entity_scores[eid] = {
            "entityId":   eid,
            "entityType": row["entityType"],
            "risk_score": float(score),
            "risk_level": (
                "critical" if score >= 80 else
                "high"     if score >= 60 else
                "medium"   if score >= 40 else
                "low"
            )
        }

results = sorted(entity_scores.values(), key=lambda x: x["risk_score"], reverse=True)

# Save to scores.json
with open("../data/scores.json", "w") as f:
    json.dump(results, f, indent=2)

# Save to MongoDB
db["scores"].delete_many({})
db["scores"].insert_many(results)

# Save model + scaler
with open("model.pkl", "wb") as f:
    pickle.dump(model, f)
with open("scaler.pkl", "wb") as f:
    pickle.dump(scaler, f)

print("\n=== Risk Scores ===")
for r in results:
    bar = "█" * int(r["risk_score"] / 10)
    print(f"{r['entityId']:10} [{bar:<10}] {r['risk_score']:5.1f} — {r['risk_level']}")