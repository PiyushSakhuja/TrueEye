const express = require("express");
const router  = express.Router();
const fetch   = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const Log = require("./models/Log");
const { generateLogs } = require("./utils/logGenerator");

const ML_API = process.env.ML_API || "http://localhost:5000";

// ── Generate logs ───────────────────────────────────────────────────────────
router.get("/generate", async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 20;
    const logs  = generateLogs(count);
    await Log.insertMany(logs);
    res.json({ message: `${count} logs generated`, count: logs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get logs ────────────────────────────────────────────────────────────────
router.get("/logs", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs  = await Log.find().sort({ timestamp: -1 }).limit(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Score one log (FIX: was broken — riskScore never defined) ───────────────
router.post("/score", async (req, res) => {
  const io = req.app.get("io");
  try {
    const log = req.body;

    // Call Python ML API
    const mlRes = await fetch(`${ML_API}/score-one`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(log),
    });

    if (!mlRes.ok) {
      const err = await mlRes.json();
      return res.status(mlRes.status).json({ error: err });
    }

    const result = await mlRes.json();

    // Emit real-time alert for high-risk events
    if (result.risk_score >= 60) {
      io.emit("new-alert", {
        entityId:   result.entityId,
        riskScore:  result.risk_score,
        riskLevel:  result.risk_level,
        isAnomaly:  result.is_anomaly,
        timestamp:  new Date().toISOString(),
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Score all recent logs ───────────────────────────────────────────────────
router.post("/score-all", async (req, res) => {
  const io = req.app.get("io");
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs  = await Log.find().sort({ timestamp: -1 }).limit(limit).lean();

    const results = [];
    for (const log of logs) {
      try {
        const mlRes = await fetch(`${ML_API}/score-one`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(log),
        });
        const result = await mlRes.json();
        results.push(result);

        if (result.risk_score >= 60) {
          io.emit("new-alert", {
            entityId:  result.entityId,
            riskScore: result.risk_score,
            riskLevel: result.risk_level,
            isAnomaly: result.is_anomaly,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (_) {
        // skip individual failures
      }
    }

    res.json({ scored: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get entity risk scores from ML ─────────────────────────────────────────
router.get("/scores", async (req, res) => {
  try {
    const mlRes  = await fetch(`${ML_API}/scores`);
    const scores = await mlRes.json();
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: "ML API unreachable: " + err.message });
  }
});

// ── Trigger model retrain ───────────────────────────────────────────────────
router.post("/retrain", async (req, res) => {
  try {
    const mlRes  = await fetch(`${ML_API}/retrain`, { method: "POST" });
    const result = await mlRes.json();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "ML API unreachable: " + err.message });
  }
});

module.exports = router;
