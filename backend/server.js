const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);  // wrap express in http server
const frontendDir = path.join(__dirname, "..", "frontend");
const frontendFiles = new Set([
  "index.html",
  "dashboard.html",
  "user.html",
  "styles.css",
  "common.js",
  "auth.js",
  "dashboard.js",
  "user.js",
  "app.js"
]);

// Socket.IO attached to http server
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

// Make io accessible in routes
app.set("io", io);

// DB connect
mongoose.connect(process.env.MONGO_URI || "mongodb+srv://admin:admin123@trusteye.itkr2zr.mongodb.net/?appName=trusteye")
  .then(() => console.log("DB connected"))
  .catch(err => console.log(err));

// Routes
const routes = require("./routes");
app.use("/api", routes);
app.use(express.static(frontendDir));
app.get("/:frontendFile", (req, res, next) => {
  const { frontendFile } = req.params;
  if (!frontendFiles.has(frontendFile)) {
    return next();
  }
  return res.sendFile(path.join(frontendDir, frontendFile));
});

// Socket.IO events
io.on("connection", (socket) => {
  console.log("Analyst connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Analyst disconnected:", socket.id);
  });
});

// Helper function — call this from anywhere to fire an alert
app.set("sendAlert", (alertData) => {
  io.emit("new-alert", alertData);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

// Use server.listen instead of app.listen
server.listen(process.env.PORT || 3000, () => 
  console.log("Server running on 3000")
);
