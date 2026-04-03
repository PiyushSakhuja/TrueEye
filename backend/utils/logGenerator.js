function generateLogs(count = 10) {
  const logs = [];

  for (let i = 0; i < count; i++) {
    const suspicious = Math.random() < 0.2;

    logs.push({
      userId: "user" + (Math.floor(Math.random() * 3) + 1),
      action: suspicious ? "download" : "login",
      timestamp: new Date(),
      ip: "192.168.1." + Math.floor(Math.random() * 255),
      location: suspicious ? "Russia" : "India",
      fileSize: suspicious ? 3000 : 20,
      riskTag: suspicious ? "suspicious" : "normal"
    });
  }

  return logs;
}

module.exports = { generateLogs };