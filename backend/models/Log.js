const mongoose = require("mongoose");

const LogSchema = new mongoose.Schema({
  entityId: String,
  entityType: String, // user or device
  action: String,
  timestamp: Date,

  metadata: {
    type: Object, // flexible for different actions
    default: {}
  },

  riskTag: String // only for demo, not for ML
});

module.exports = mongoose.model("Log", LogSchema);