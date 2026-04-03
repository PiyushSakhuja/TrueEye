const mongoose = require("mongoose");

const LogSchema = new mongoose.Schema({
  userId: String,
  action: String,
  timestamp: Date,
  ip: String,
  location: String,
  fileSize: Number,
  riskTag: String
});

module.exports = mongoose.model("Log", LogSchema);