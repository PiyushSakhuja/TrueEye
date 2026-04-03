const express = require("express");
const router = express.Router();

const Log = require("./models/Log");
const { generateLogs } = require("./utils/logGenerator");

// Generate logs
router.get("/generate", async (req, res) => {
  const logs = generateLogs(20);
  await Log.insertMany(logs);

  res.json({ message: "Logs generated", logs });
});

// Get logs
router.get("/logs", async (req, res) => {
  const logs = await Log.find().sort({ timestamp: -1 });
  res.json(logs);
});
router.post("/score", async (req, res) => {
  const io = req.app.get("io");
  
  // ... your scoring logic ...

  if (riskScore >= 80) {
    io.emit("new-alert", {
      entityId:  "user_3",
      riskScore: 91,
      riskLevel: "critical",
      reason:    "Unauthorized external download at off-hours",
      timestamp: new Date().toISOString()
    });
  }

  res.json({ status: "scored" });
});
module.exports = router;