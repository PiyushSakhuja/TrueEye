import json
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv
import os
from datetime import datetime
load_dotenv()

# Connect to MongoDB
client = MongoClient("mongodb+srv://admin:admin123@trusteye.itkr2zr.mongodb.net/?appName=trusteye")
db = client["test"]
collection = db["logs"]

# Fetch all logs
logs = list(collection.find({}, {"_id": 0}))
print("Connecting to DB...")
print("Collections:", db.list_collection_names())

logs = list(collection.find({}, {"_id": 0}))
print("Logs fetched:", len(logs))
rows = []
for log in logs:
    meta = log.get("metadata", {})
    timestamp = log.get("timestamp")
    hour = timestamp.hour  # extract hour from ISO string

    row = {
        "entityId":          log["entityId"],
        "entityType":        log["entityType"],
        "action":            log["action"],
        "riskTag":           log.get("riskTag", "normal"),
        "hour":              hour,

        # Time features
        "is_off_hours":      1 if hour < 8 or hour > 20 else 0,

        # File features
        "file_size_mb":      meta.get("fileSizeMB", 0),
        "is_external_dest":  1 if meta.get("destination", "") == "external" else 0,
        "is_unauthorized":   1 if meta.get("accessType", "") == "unauthorized" else 0,

        # Device features
        "data_rate_mbps":    meta.get("dataRateMBps", 0),
        "pages_printed":     meta.get("pages", 0),
        "data_transferred":  meta.get("dataTransferredMB", 0),
        "is_unknown_dest":   1 if "unknown" in str(meta.get("destinationIP", "")) else 0,
        "is_external_server":1 if meta.get("destination", "") == "external_server" else 0,

        # Action encoding
        "is_download":       1 if log["action"] == "download" else 0,
        "is_send_data":      1 if log["action"] == "send_data" else 0,
        "is_print":          1 if log["action"] == "print" else 0,
        "is_stream":         1 if log["action"] == "stream" else 0,
    }
    rows.append(row)

df = pd.DataFrame(rows)
df.to_csv("../data/features.csv", index=False)
print(f"Extracted {len(df)} rows with features.")