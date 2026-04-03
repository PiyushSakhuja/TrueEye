import json
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv
import os
from datetime import datetime

load_dotenv()

# Connect to MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://admin:admin123@trusteye.itkr2zr.mongodb.net/?appName=trusteye")
client = MongoClient(MONGO_URI)
db = client["test"]
collection = db["logs"]

print("Connecting to DB...")
print("Collections:", db.list_collection_names())

# Fetch all logs
logs = list(collection.find({}, {"_id": 0}))
print("Logs fetched:", len(logs))

rows = []
for log in logs:
    meta = log.get("metadata", {})
    timestamp = log.get("timestamp")

    # FIX: handle both datetime objects and ISO strings
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
    dow  = dt.weekday()  # 0=Mon, 6=Sun — new feature

    action = log.get("action", "")

    row = {
        "entityId":           log.get("entityId", ""),
        "entityType":         log.get("entityType", ""),
        "action":             action,
        "riskTag":            log.get("riskTag", "normal"),

        # Time features
        "hour":               hour,
        "day_of_week":        dow,                              # NEW
        "is_off_hours":       1 if hour < 8 or hour > 20 else 0,
        "is_weekend":         1 if dow >= 5 else 0,            # NEW

        # File / data features
        "file_size_mb":       meta.get("fileSizeMB", 0),
        "is_external_dest":   1 if meta.get("destination", "") == "external" else 0,
        "is_unauthorized":    1 if meta.get("accessType", "") == "unauthorized" else 0,

        # Device / network features
        "data_rate_mbps":     meta.get("dataRateMBps", 0),
        "pages_printed":      meta.get("pages", 0),
        "data_transferred":   meta.get("dataTransferredMB", 0),
        "is_unknown_dest":    1 if "unknown" in str(meta.get("destinationIP", "")) else 0,
        "is_external_server": 1 if meta.get("destination", "") == "external_server" else 0,

        # Action one-hot encoding
        "is_download":        1 if action == "download"  else 0,
        "is_upload":          1 if action == "upload"    else 0,  # FIX: was missing
        "is_send_data":       1 if action == "send_data" else 0,
        "is_print":           1 if action == "print"     else 0,
        "is_stream":          1 if action == "stream"    else 0,
        "is_login":           1 if action == "login"     else 0,  # NEW
    }
    rows.append(row)

df = pd.DataFrame(rows)
df.to_csv("../data/features.csv", index=False)
print(f"Extracted {len(df)} rows with features.")
