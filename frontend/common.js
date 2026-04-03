(() => {
  const appOrigin = window.location.origin && window.location.origin.startsWith("http")
    ? window.location.origin
    : "http://localhost:3000";

  const fallbackScores = [
    { entityId: "user_0", risk_score: 91, risk_level: "critical", total_logs: 14, anomaly_count: 4 },
    { entityId: "user_1", risk_score: 76, risk_level: "high", total_logs: 11, anomaly_count: 2 },
    { entityId: "user_2", risk_score: 62, risk_level: "high", total_logs: 12, anomaly_count: 2 },
    { entityId: "user_3", risk_score: 44, risk_level: "medium", total_logs: 9, anomaly_count: 1 },
    { entityId: "user_4", risk_score: 31, risk_level: "low", total_logs: 8, anomaly_count: 0 },
    { entityId: "device_0", risk_score: 83, risk_level: "critical", total_logs: 10, anomaly_count: 3 },
    { entityId: "device_1", risk_score: 55, risk_level: "medium", total_logs: 7, anomaly_count: 1 },
    { entityId: "device_2", risk_score: 36, risk_level: "low", total_logs: 6, anomaly_count: 0 }
  ];

  const fallbackLogs = [
    {
      entityId: "user_0",
      entityType: "user",
      action: "login",
      timestamp: "2026-04-03T01:04:00.000Z",
      riskTag: "suspicious",
      metadata: { location: "Germany", device: "unknown", loginStatus: "success" }
    },
    {
      entityId: "user_0",
      entityType: "user",
      action: "download",
      timestamp: "2026-04-03T01:32:00.000Z",
      riskTag: "suspicious",
      metadata: { fileName: "salary.xlsx", fileSizeMB: 2400, destination: "external", accessType: "unauthorized" }
    },
    {
      entityId: "device_0",
      entityType: "device",
      action: "send_data",
      timestamp: "2026-04-03T02:10:00.000Z",
      riskTag: "suspicious",
      metadata: { dataTransferredMB: 3200, destination: "external_server" }
    },
    {
      entityId: "user_2",
      entityType: "user",
      action: "upload",
      timestamp: "2026-04-03T08:22:00.000Z",
      riskTag: "normal",
      metadata: { fileName: "report.pdf", fileSizeMB: 24, destination: "internal", accessType: "authorized" }
    },
    {
      entityId: "device_1",
      entityType: "device",
      action: "print",
      timestamp: "2026-04-03T09:15:00.000Z",
      riskTag: "normal",
      metadata: { pages: 18, document: "report.pdf", status: "completed" }
    },
    {
      entityId: "user_3",
      entityType: "user",
      action: "download",
      timestamp: "2026-04-03T10:48:00.000Z",
      riskTag: "normal",
      metadata: { fileName: "report.pdf", fileSizeMB: 14, destination: "internal", accessType: "authorized" }
    }
  ];

  const TrustEye = {
    ORIGIN: appOrigin,
    API_BASE: `${appOrigin}/api`,
    STORAGE_KEY: "trusteye-session",
    FALLBACK_SCORES: fallbackScores,
    FALLBACK_LOGS: fallbackLogs,

    getSession() {
      try {
        const raw = window.localStorage.getItem(this.STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        return null;
      }
    },

    saveSession(session) {
      window.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
    },

    clearSession() {
      window.localStorage.removeItem(this.STORAGE_KEY);
    },

    buildSession(email, role) {
      const cleanEmail = String(email || "").trim().toLowerCase();
      return {
        email: cleanEmail,
        role,
        displayName: this.titleCase(cleanEmail.split("@")[0].replace(/[._-]/g, " ") || role),
        userEntityId: this.mapEntity(cleanEmail, "user", 5),
        deviceEntityId: this.mapEntity(cleanEmail, "device", 3)
      };
    },

    mapEntity(email, prefix, count) {
      let hash = 0;
      for (let index = 0; index < email.length; index += 1) {
        hash = (hash + email.charCodeAt(index) * (index + 3)) % 100000;
      }
      return `${prefix}_${hash % count}`;
    },

    async request(path, options = {}) {
      const config = {
        method: options.method || "GET",
        headers: { "Content-Type": "application/json", ...(options.headers || {}) }
      };

      if (options.body !== undefined) {
        config.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
      }

      const response = await fetch(`${this.API_BASE}${path}`, config);
      const text = await response.text();
      let data = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch (error) {
        data = text;
      }

      if (!response.ok) {
        throw new Error(typeof data === "object" && data && data.error ? data.error : `Request failed (${response.status})`);
      }

      return data;
    },

    setLoader(isVisible, message) {
      const loader = document.getElementById("loader");
      const loaderText = document.getElementById("loaderText");
      if (!loader) return;
      loader.classList.toggle("is-hidden", !isVisible);
      if (loaderText && message) {
        loaderText.textContent = message;
      }
    },

    toast(title, message, tone = "info") {
      const stack = document.getElementById("toastStack");
      if (!stack) return;

      const toast = document.createElement("article");
      toast.className = `toast toast-${tone}`;
      toast.innerHTML = `
        <strong>${this.escapeHtml(title)}</strong>
        <p>${this.escapeHtml(message)}</p>
      `;

      stack.prepend(toast);
      window.setTimeout(() => toast.remove(), 4200);
    },

    requireRole(role) {
      const session = this.getSession();
      if (!session || session.role !== role) {
        window.location.replace("/");
        return null;
      }
      return session;
    },

    logout() {
      this.clearSession();
      window.location.replace("/");
    },

    levelClass(level) {
      const value = String(level || "low").toLowerCase();
      if (value === "critical") return "is-critical";
      if (value === "high") return "is-high";
      if (value === "medium") return "is-medium";
      return "is-low";
    },

    scoreToLevel(score) {
      if (score >= 80) return "critical";
      if (score >= 60) return "high";
      if (score >= 40) return "medium";
      return "low";
    },

    isSuspiciousLog(log) {
      const meta = log && log.metadata ? log.metadata : {};
      return (
        log.riskTag === "suspicious" ||
        meta.accessType === "unauthorized" ||
        meta.destination === "external" ||
        meta.destination === "external_server" ||
        meta.device === "unknown" ||
        meta.destinationIP === "unknown_ip"
      );
    },

    describeLog(log) {
      const meta = log && log.metadata ? log.metadata : {};
      switch (log.action) {
        case "login":
          return `Login from ${meta.device || "known"} device in ${meta.location || "unknown"} location`;
        case "download":
        case "upload":
          return `${meta.fileName || "File"} to ${meta.destination || "internal"} (${meta.accessType || "authorized"})`;
        case "send_data":
          return `${meta.dataTransferredMB || 0} MB sent to ${meta.destination || "server"}`;
        case "stream":
          return `Stream to ${meta.destinationIP || "destination"} at ${meta.dataRateMBps || 0} MBps`;
        case "print":
          return `${meta.pages || 0} pages of ${meta.document || "document"}`;
        default:
          return "Telemetry event recorded";
      }
    },

    formatTime(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "--";
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    },

    formatDateTime(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Unknown time";
      return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    },

    titleCase(value) {
      return String(value || "")
        .split(" ")
        .filter(Boolean)
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
        .join(" ");
    },

    escapeHtml(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },

    randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    randomChoice(values) {
      return values[Math.floor(Math.random() * values.length)];
    }
  };

  window.TrustEye = TrustEye;
})();
