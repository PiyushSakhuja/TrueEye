// utils/logGenerator.js

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomIP() {
  return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

function generateTimestamp(hour) {
  const date = new Date();
  date.setHours(hour);
  return date;
}

function generateLogs(count = 20) {
  const userActions = ["login", "logout", "download", "upload", "view"];
  const deviceActions = ["print", "stream", "send_data"];

  const devices = ["laptop", "mobile", "desktop"];
  const locations = ["India", "USA", "Germany"];
  const suspiciousLocations = ["Russia", "China"];

  const files = ["report.pdf", "data.csv", "salary.xlsx", "db_dump.sql"];

  let logs = [];

  for (let i = 0; i < count; i++) {
    const isDevice = Math.random() < 0.3; // 30% IoT
    const suspicious = Math.random() < 0.2; // 20% anomalies

    const hour = suspicious
      ? Math.floor(Math.random() * 5) // 0–5 AM
      : Math.floor(Math.random() * 9) + 9; // 9–17

    let log = {
      entityId: isDevice
        ? "device_" + Math.floor(Math.random() * 3)
        : "user_" + Math.floor(Math.random() * 5),

      entityType: isDevice ? "device" : "user",

      action: "",
      timestamp: generateTimestamp(hour),

      metadata: {},

      riskTag: suspicious ? "suspicious" : "normal"
    };

    // 🧑 USER LOGS
    if (!isDevice) {
      const action = suspicious ? "download" : random(userActions);
      log.action = action;

      if (action === "login") {
        log.metadata = {
          ip: randomIP(),
          location: suspicious ? random(suspiciousLocations) : "India",
          device: suspicious ? "unknown" : random(devices),
          loginStatus: "success"
        };
      }

      else if (action === "logout") {
        log.metadata = {
          sessionDuration: Math.floor(Math.random() * 300) // seconds
        };
      }

      else if (action === "download" || action === "upload") {
        log.metadata = {
          fileName: random(files),
          fileSizeMB: suspicious
            ? Math.floor(Math.random() * 5000) + 500
            : Math.floor(Math.random() * 50) + 1,
          destination: suspicious ? "external" : "internal",
          accessType: suspicious ? "unauthorized" : "authorized"
        };
      }

      else if (action === "view") {
        log.metadata = {
          resource: random(files),
          accessTime: Math.floor(Math.random() * 10) // seconds
        };
      }
    }

    // 🤖 IoT DEVICE LOGS
    else {
      const action = random(deviceActions);
      log.action = action;

      if (action === "print") {
        log.metadata = {
          pages: suspicious
            ? Math.floor(Math.random() * 1000) + 200
            : Math.floor(Math.random() * 50) + 1,
          document: random(files),
          status: "completed"
        };
      }

      else if (action === "stream") {
        log.metadata = {
          dataRateMBps: suspicious
            ? Math.floor(Math.random() * 100) + 50
            : Math.floor(Math.random() * 5) + 1,
          destinationIP: suspicious ? "unknown_ip" : randomIP()
        };
      }

      else if (action === "send_data") {
        log.metadata = {
          dataTransferredMB: suspicious
            ? Math.floor(Math.random() * 5000) + 1000
            : Math.floor(Math.random() * 100) + 10,
          destination: suspicious ? "external_server" : "internal_server"
        };
      }
    }

    logs.push(log);
  }

  return logs;
}

module.exports = { generateLogs };