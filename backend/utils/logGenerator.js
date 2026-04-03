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

// function generateLogs(count = 20) {
//   const userActions = ["login", "logout", "download", "upload", "view"];
//   const deviceActions = ["print", "stream", "send_data"];

//   const devices = ["laptop", "mobile", "desktop"];
//   const locations = ["India", "USA", "Germany"];
//   const suspiciousLocations = ["Russia", "China"];

//   const files = ["report.pdf", "data.csv", "salary.xlsx", "db_dump.sql"];

//   let logs = [];

//   for (let i = 0; i < count; i++) {
//     const isDevice = Math.random() < 0.3; // 30% IoT
//     const suspicious = Math.random() < 0.2; // 20% anomalies

//     const hour = suspicious
//       ? Math.floor(Math.random() * 5) // 0–5 AM
//       : Math.floor(Math.random() * 9) + 9; // 9–17

//     let log = {
//       entityId: isDevice
//         ? "device_" + Math.floor(Math.random() * 3)
//         : "user_" + Math.floor(Math.random() * 5),

//       entityType: isDevice ? "device" : "user",

//       action: "",
//       timestamp: generateTimestamp(hour),

//       metadata: {},

//       riskTag: suspicious ? "suspicious" : "normal"
//     };

//     // 🧑 USER LOGS
//     if (!isDevice) {
//       const action = suspicious ? "download" : random(userActions);
//       log.action = action;

//       if (action === "login") {
//         log.metadata = {
//           ip: randomIP(),
//           location: suspicious ? random(suspiciousLocations) : "India",
//           device: suspicious ? "unknown" : random(devices),
//           loginStatus: "success"
//         };
//       }

//       else if (action === "logout") {
//         log.metadata = {
//           sessionDuration: Math.floor(Math.random() * 300) // seconds
//         };
//       }

//       else if (action === "download" || action === "upload") {
//         log.metadata = {
//           fileName: random(files),
//           fileSizeMB: suspicious
//             ? Math.floor(Math.random() * 5000) + 500
//             : Math.floor(Math.random() * 50) + 1,
//           destination: suspicious ? "external" : "internal",
//           accessType: suspicious ? "unauthorized" : "authorized"
//         };
//       }

//       else if (action === "view") {
//         log.metadata = {
//           resource: random(files),
//           accessTime: Math.floor(Math.random() * 10) // seconds
//         };
//       }
//     }

//     // 🤖 IoT DEVICE LOGS
//     else {
//       const action = random(deviceActions);
//       log.action = action;

//       if (action === "print") {
//         log.metadata = {
//           pages: suspicious
//             ? Math.floor(Math.random() * 1000) + 200
//             : Math.floor(Math.random() * 50) + 1,
//           document: random(files),
//           status: "completed"
//         };
//       }

//       else if (action === "stream") {
//         log.metadata = {
//           dataRateMBps: suspicious
//             ? Math.floor(Math.random() * 100) + 50
//             : Math.floor(Math.random() * 5) + 1,
//           destinationIP: suspicious ? "unknown_ip" : randomIP()
//         };
//       }

//       else if (action === "send_data") {
//         log.metadata = {
//           dataTransferredMB: suspicious
//             ? Math.floor(Math.random() * 5000) + 1000
//             : Math.floor(Math.random() * 100) + 10,
//           destination: suspicious ? "external_server" : "internal_server"
//         };
//       }
//     }

//     logs.push(log);
//   }

//   return logs;
// }

function generateLogs(count = 100) {
  const users = {
    user_0: { location: "India", device: "laptop", avgFile: 20 },
    user_1: { location: "India", device: "mobile", avgFile: 15 },
    user_2: { location: "USA", device: "desktop", avgFile: 30 },
    user_3: { location: "Germany", device: "laptop", avgFile: 25 },
    user_4: { location: "India", device: "desktop", avgFile: 10 }
  };

  const devices = {
    device_0: { type: "printer", avgPages: 20 },
    device_1: { type: "camera", avgRate: 3 },
    device_2: { type: "sensor", avgData: 50 }
  };

  const files = ["report.pdf", "data.csv", "salary.xlsx"];

  let logs = [];

  for (let i = 0; i < count; i++) {
    const isDevice = Math.random() < 0.3;
    const suspicious = Math.random() < 0.15; // 🔥 reduce anomalies

    const hour = suspicious
      ? Math.floor(Math.random() * 6) // 0–6 AM
      : Math.floor(Math.random() * 8) + 10; // 10–18

    let log = {
      entityId: "",
      entityType: "",
      action: "",
      timestamp: new Date(new Date().setHours(hour)),
      metadata: {},
      riskTag: suspicious ? "suspicious" : "normal"
    };

    // 👤 USER
    if (!isDevice) {
      const userId = "user_" + Math.floor(Math.random() * 5);
      const profile = users[userId];

      log.entityId = userId;
      log.entityType = "user";

      const action = suspicious ? "download" : random(["login", "download", "view"]);
      log.action = action;

      if (action === "login") {
        log.metadata = {
          ip: randomIP(),
          location: suspicious ? "Russia" : profile.location,
          device: suspicious ? "unknown" : profile.device,
          loginStatus: "success"
        };
      }

      if (action === "download") {
        log.metadata = {
          fileName: random(files),
          fileSizeMB: suspicious
            ? profile.avgFile * 50 // 🔥 big spike
            : profile.avgFile + Math.random() * 5,
          destination: suspicious ? "external" : "internal",
          accessType: suspicious ? "unauthorized" : "authorized"
        };
      }

      if (action === "view") {
        log.metadata = {
          resource: random(files),
          accessTime: 2 + Math.random() * 3
        };
      }
    }

    // 🤖 DEVICE
    else {
      const deviceId = "device_" + Math.floor(Math.random() * 3);
      const profile = devices[deviceId];

      log.entityId = deviceId;
      log.entityType = "device";

      const action = random(["print", "stream", "send_data"]);
      log.action = action;

      if (action === "print") {
        log.metadata = {
          pages: suspicious
            ? profile.avgPages * 20
            : profile.avgPages + Math.random() * 5
        };
      }

      if (action === "stream") {
        log.metadata = {
          dataRateMBps: suspicious
            ? profile.avgRate * 20
            : profile.avgRate + Math.random()
        };
      }

      if (action === "send_data") {
        log.metadata = {
          dataTransferredMB: suspicious
            ? profile.avgData * 50
            : profile.avgData + Math.random() * 10,
          destination: suspicious ? "external_server" : "internal_server"
        };
      }
    }

    logs.push(log);
  }

  return logs;
}

module.exports = { generateLogs };