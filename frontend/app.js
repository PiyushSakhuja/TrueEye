const fallbackScores = [
  { entityId: "device_0", risk_score: 84.2, risk_level: "critical", total_logs: 12, anomaly_count: 3 },
  { entityId: "device_1", risk_score: 52.6, risk_level: "medium", total_logs: 8, anomaly_count: 1 },
  { entityId: "device_2", risk_score: 39.1, risk_level: "low", total_logs: 7, anomaly_count: 0 },
  { entityId: "user_0", risk_score: 91.4, risk_level: "critical", total_logs: 15, anomaly_count: 4 },
  { entityId: "user_1", risk_score: 74.8, risk_level: "high", total_logs: 11, anomaly_count: 2 },
  { entityId: "user_2", risk_score: 63.7, risk_level: "high", total_logs: 13, anomaly_count: 2 },
  { entityId: "user_3", risk_score: 47.3, risk_level: "medium", total_logs: 10, anomaly_count: 1 },
  { entityId: "user_4", risk_score: 28.9, risk_level: "low", total_logs: 9, anomaly_count: 0 }
];

const fallbackLogs = [
  {
    entityId: "user_0",
    entityType: "user",
    action: "login",
    timestamp: "2026-04-03T07:14:00.000Z",
    riskTag: "suspicious",
    metadata: { ip: "192.168.41.12", location: "Germany", device: "unknown", loginStatus: "success" }
  },
  {
    entityId: "user_0",
    entityType: "user",
    action: "download",
    timestamp: "2026-04-03T07:42:00.000Z",
    riskTag: "suspicious",
    metadata: { fileName: "salary.xlsx", fileSizeMB: 3400, destination: "external", accessType: "unauthorized" }
  },
  {
    entityId: "device_0",
    entityType: "device",
    action: "stream",
    timestamp: "2026-04-03T08:05:00.000Z",
    riskTag: "suspicious",
    metadata: { dataRateMBps: 77, destinationIP: "unknown_ip" }
  },
  {
    entityId: "user_1",
    entityType: "user",
    action: "upload",
    timestamp: "2026-04-03T09:11:00.000Z",
    riskTag: "normal",
    metadata: { fileName: "report.pdf", fileSizeMB: 12, destination: "internal", accessType: "authorized" }
  },
  {
    entityId: "user_2",
    entityType: "user",
    action: "view",
    timestamp: "2026-04-03T09:28:00.000Z",
    riskTag: "normal",
    metadata: { resource: "data.csv", accessTime: 5 }
  },
  {
    entityId: "device_1",
    entityType: "device",
    action: "print",
    timestamp: "2026-04-03T10:02:00.000Z",
    riskTag: "normal",
    metadata: { pages: 16, document: "report.pdf", status: "completed" }
  },
  {
    entityId: "user_3",
    entityType: "user",
    action: "download",
    timestamp: "2026-04-03T11:48:00.000Z",
    riskTag: "normal",
    metadata: { fileName: "data.csv", fileSizeMB: 18, destination: "internal", accessType: "authorized" }
  },
  {
    entityId: "device_2",
    entityType: "device",
    action: "send_data",
    timestamp: "2026-04-03T12:22:00.000Z",
    riskTag: "normal",
    metadata: { dataTransferredMB: 46, destination: "internal_server" }
  },
  {
    entityId: "user_4",
    entityType: "user",
    action: "logout",
    timestamp: "2026-04-03T13:05:00.000Z",
    riskTag: "normal",
    metadata: { sessionDuration: 124 }
  },
  {
    entityId: "user_2",
    entityType: "user",
    action: "download",
    timestamp: "2026-04-03T14:20:00.000Z",
    riskTag: "suspicious",
    metadata: { fileName: "db_dump.sql", fileSizeMB: 780, destination: "external", accessType: "unauthorized" }
  }
];

const state = {
  authMode: "login",
  session: loadSession(),
  scores: [],
  logs: [],
  alerts: [],
  usingFallback: false,
  backendAvailable: false,
  mlAvailable: false
};

const elements = {
  authView: document.getElementById("authView"),
  dashboardView: document.getElementById("dashboardView"),
  authForm: document.getElementById("authForm"),
  authSubmit: document.getElementById("authSubmit"),
  authHelper: document.getElementById("authHelper"),
  nameField: document.getElementById("nameField"),
  teamField: document.getElementById("teamField"),
  nameInput: document.getElementById("nameInput"),
  teamInput: document.getElementById("teamInput"),
  emailInput: document.getElementById("emailInput"),
  passwordInput: document.getElementById("passwordInput"),
  authTabs: Array.from(document.querySelectorAll(".auth-tab")),
  refreshBtn: document.getElementById("refreshBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  dashboardGreeting: document.getElementById("dashboardGreeting"),
  sidebarUser: document.getElementById("sidebarUser"),
  sidebarTeam: document.getElementById("sidebarTeam"),
  backendState: document.getElementById("backendState"),
  mlState: document.getElementById("mlState"),
  fallbackState: document.getElementById("fallbackState"),
  entityCount: document.getElementById("entityCount"),
  avgRisk: document.getElementById("avgRisk"),
  activeAnomalies: document.getElementById("activeAnomalies"),
  topEntity: document.getElementById("topEntity"),
  topEntityMeta: document.getElementById("topEntityMeta"),
  trendSummary: document.getElementById("trendSummary"),
  lineChart: document.getElementById("lineChart"),
  barChart: document.getElementById("barChart"),
  anomalySummary: document.getElementById("anomalySummary"),
  anomalyList: document.getElementById("anomalyList"),
  activitySummary: document.getElementById("activitySummary"),
  activityTableBody: document.getElementById("activityTableBody"),
  alertBanner: document.getElementById("alertBanner"),
  alertRailCount: document.getElementById("alertRailCount"),
  alertRail: document.getElementById("alertRail"),
  toastStack: document.getElementById("toastStack")
};

init();

function init() {
  bindEvents();
  updateAuthMode(state.authMode);

  if (state.session) {
    openDashboard();
    return;
  }

  showView("auth");
}

function bindEvents() {
  elements.authTabs.forEach((tab) => {
    tab.addEventListener("click", () => updateAuthMode(tab.dataset.mode));
  });

  elements.authForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value.trim();
    if (!email || !password) return;

    const enteredName = elements.nameInput.value.trim();
    const enteredTeam = elements.teamInput.value.trim();

    state.session = {
      name: enteredName || email.split("@")[0].replace(/[._-]/g, " "),
      team: enteredTeam || "Security Operations",
      email
    };

    saveSession(state.session);
    openDashboard();
  });

  elements.refreshBtn.addEventListener("click", async () => {
    await loadDashboardData(true);
  });

  elements.downloadBtn.addEventListener("click", () => {
    const entity = state.scores[0] ? state.scores[0].entityId : "user_0";
    const fakeAlert = {
      id: "manual-" + Date.now(),
      title: "Different device download detected",
      entityId: entity,
      severity: "critical",
      score: 94.3,
      source: "Download trigger",
      detail: "Download requested from an unfamiliar desktop in Germany with an external destination target.",
      timestamp: new Date().toISOString()
    };

    state.alerts.unshift(fakeAlert);
    renderDashboard();
    showBanner(fakeAlert);
    showToast("Anomaly triggered", entity + " attempted a sensitive download from a different device.");
  });

  elements.logoutBtn.addEventListener("click", () => {
    state.session = null;
    state.alerts = [];
    clearSession();
    elements.alertBanner.classList.remove("is-visible");
    elements.alertBanner.innerHTML = "";
    elements.authForm.reset();
    updateAuthMode("login");
    showView("auth");
  });
}

function updateAuthMode(mode) {
  state.authMode = mode;
  const signupMode = mode === "signup";

  elements.authTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.mode === mode);
  });

  elements.nameField.classList.toggle("is-visible", signupMode);
  elements.teamField.classList.toggle("is-visible", signupMode);
  elements.authSubmit.textContent = signupMode ? "Create Mock Account" : "Open Dashboard";
  elements.authHelper.textContent = signupMode
    ? "Signup is mocked too. Fill the optional profile fields or skip them."
    : "Mock login only. Use any valid-looking email and password to continue.";
}

async function openDashboard() {
  showView("dashboard");
  elements.alertBanner.classList.remove("is-visible");
  elements.alertBanner.innerHTML = "";

  const displayName = titleCase(state.session && state.session.name ? state.session.name : "Analyst");
  elements.dashboardGreeting.textContent = displayName + ", your anomaly queue is ready.";
  elements.sidebarUser.textContent = displayName;
  elements.sidebarTeam.textContent = state.session && state.session.team ? state.session.team : "Security Operations";

  await loadDashboardData(false);
}

function showView(view) {
  elements.authView.classList.toggle("view-active", view === "auth");
  elements.dashboardView.classList.toggle("view-active", view === "dashboard");
}

async function loadDashboardData(silentRefresh) {
  if (!silentRefresh) {
    showToast("Loading dashboard", "Pulling scores and recent logs from the backend.");
  }

  const [scoresResult, logsResult] = await Promise.all([
    getJson("/api/scores"),
    getJson("/api/logs?limit=12")
  ]);

  state.backendAvailable = logsResult.ok;
  state.mlAvailable = scoresResult.ok;
  state.usingFallback = !scoresResult.ok || !logsResult.ok;
  state.scores = scoresResult.ok && Array.isArray(scoresResult.data) && scoresResult.data.length
    ? scoresResult.data
    : fallbackScores;
  state.logs = logsResult.ok && Array.isArray(logsResult.data) && logsResult.data.length
    ? logsResult.data
    : fallbackLogs;

  if (!state.alerts.length) {
    state.alerts = buildAlertRailSeed(state.scores, state.logs);
  }

  renderDashboard();

  if (silentRefresh) {
    showToast(
      "Dashboard refreshed",
      state.usingFallback
        ? "Data reloaded in fallback demo mode because one or more APIs were unavailable."
        : "Live backend and ML data refreshed successfully."
    );
  }
}

function renderDashboard() {
  const metrics = deriveMetrics(state.scores, state.logs);
  const trendSeries = buildTrendSeries(state.logs, state.scores);
  const anomalyItems = buildAnomalyFeed(state.logs, state.scores, state.alerts);
  const recentLogs = state.logs
    .slice()
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 8);

  elements.backendState.textContent = state.backendAvailable ? "Live" : "Fallback";
  elements.mlState.textContent = state.mlAvailable ? "Live" : "Fallback";
  elements.fallbackState.textContent = state.usingFallback ? "On" : "Off";
  elements.entityCount.textContent = String(metrics.entityCount);
  elements.avgRisk.textContent = Math.round(metrics.averageRisk) + "%";
  elements.activeAnomalies.textContent = String(anomalyItems.length);
  elements.topEntity.textContent = metrics.topEntity ? metrics.topEntity.entityId : "None";
  elements.topEntityMeta.textContent = metrics.topEntity
    ? Math.round(metrics.topEntity.risk_score) + "% risk score"
    : "Waiting for telemetry.";

  elements.trendSummary.textContent = trendSeries.length + " events mapped across the latest activity window";
  elements.anomalySummary.textContent = anomalyItems.length + " investigation items";
  elements.activitySummary.textContent = recentLogs.length + " recent logs shown";
  elements.alertRailCount.textContent = Math.min(state.alerts.length, 4) + " alerts";

  elements.lineChart.innerHTML = renderLineChart(trendSeries);
  elements.barChart.innerHTML = renderBarChart(state.scores);
  elements.anomalyList.innerHTML = anomalyItems.length
    ? anomalyItems.map(renderAnomalyCard).join("")
    : '<div class="empty-state">No anomalies right now. Generate logs or trigger the download alert to populate this view.</div>';
  elements.activityTableBody.innerHTML = recentLogs.map(renderActivityRow).join("");
  elements.alertRail.innerHTML = state.alerts.slice(0, 4).map(renderAlertRailCard).join("");
}

function deriveMetrics(scores, logs) {
  const entityIds = new Set();
  scores.forEach((item) => entityIds.add(item.entityId));
  logs.forEach((log) => entityIds.add(log.entityId));

  const averageRisk = scores.length
    ? scores.reduce((sum, item) => sum + Number(item.risk_score || 0), 0) / scores.length
    : 0;

  const topEntity = scores.length
    ? scores.slice().sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))[0]
    : null;

  return {
    entityCount: entityIds.size,
    averageRisk,
    topEntity
  };
}

function buildTrendSeries(logs, scores) {
  const scoreMap = new Map(scores.map((item) => [item.entityId, Number(item.risk_score || 0)]));

  return logs
    .slice()
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .slice(-10)
    .map((log) => {
      const meta = log.metadata || {};
      let intensity = 18;

      if (log.riskTag === "suspicious") intensity += 28;
      if (meta.accessType === "unauthorized") intensity += 18;
      if (meta.destination === "external" || meta.destination === "external_server") intensity += 12;
      if (meta.device === "unknown" || meta.destinationIP === "unknown_ip") intensity += 14;
      if (log.action === "download" || log.action === "send_data" || log.action === "stream") intensity += 8;

      const modelBoost = (scoreMap.get(log.entityId) || 0) * 0.35;
      return {
        label: formatTime(log.timestamp),
        value: Math.min(100, Math.round(intensity + modelBoost)),
        action: humanizeAction(log.action)
      };
    });
}

function buildAnomalyFeed(logs, scores, alerts) {
  const items = [];

  alerts.forEach((alert) => {
    items.push({
      id: alert.id || alert.entityId + "-" + alert.timestamp,
      title: alert.title || "Escalated anomaly",
      detail: alert.detail,
      entityId: alert.entityId,
      severity: alert.severity || scoreToLevel(alert.score || 0),
      score: alert.score || 0,
      source: alert.source || "Analyst action",
      timestamp: alert.timestamp
    });
  });

  scores
    .filter((item) => Number(item.risk_score || 0) >= 60)
    .slice(0, 4)
    .forEach((item) => {
      items.push({
        id: "score-" + item.entityId,
        title: "Elevated ML risk on " + item.entityId,
        detail: (item.anomaly_count || 0) + " anomalies detected across " + (item.total_logs || 0) + " logs.",
        entityId: item.entityId,
        severity: item.risk_level || scoreToLevel(item.risk_score),
        score: Number(item.risk_score || 0),
        source: "ML scoring",
        timestamp: new Date().toISOString()
      });
    });

  logs
    .filter(isSuspiciousLog)
    .slice(0, 5)
    .forEach((log, index) => {
      items.push({
        id: "log-" + index + "-" + log.entityId,
        title: humanizeAction(log.action) + " anomaly",
        detail: describeLogContext(log),
        entityId: log.entityId,
        severity: log.riskTag === "suspicious" ? "high" : "medium",
        score: deriveLogSeverityScore(log),
        source: "Behavioral rule",
        timestamp: log.timestamp
      });
    });

  return dedupeById(items)
    .sort((a, b) => {
      const severityDelta = severityRank(b.severity) - severityRank(a.severity);
      return severityDelta !== 0 ? severityDelta : new Date(b.timestamp) - new Date(a.timestamp);
    })
    .slice(0, 6);
}

function buildAlertRailSeed(scores, logs) {
  const seed = [];

  scores
    .slice()
    .sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))
    .slice(0, 2)
    .forEach((item) => {
      seed.push({
        id: "seed-score-" + item.entityId,
        title: "High risk entity",
        entityId: item.entityId,
        severity: item.risk_level || scoreToLevel(item.risk_score),
        score: Number(item.risk_score || 0),
        source: "ML scoring",
        detail: item.entityId + " is trending above the analyst threshold.",
        timestamp: new Date().toISOString()
      });
    });

  const suspiciousLog = logs.find(isSuspiciousLog);
  if (suspiciousLog) {
    seed.push({
      id: "seed-log-" + suspiciousLog.entityId,
      title: "Suspicious activity detected",
      entityId: suspiciousLog.entityId,
      severity: "high",
      score: deriveLogSeverityScore(suspiciousLog),
      source: "Behavioral rule",
      detail: describeLogContext(suspiciousLog),
      timestamp: suspiciousLog.timestamp
    });
  }

  return seed;
}

function renderLineChart(series) {
  if (!series.length) {
    return '<div class="empty-state">No chart data available yet.</div>';
  }

  const width = 620;
  const height = 220;
  const points = series.map((point, index) => {
    const x = (index / Math.max(series.length - 1, 1)) * (width - 40) + 20;
    const y = height - (point.value / 100) * 170 - 20;
    return { label: point.label, value: point.value, action: point.action, x, y };
  });

  const polyline = points.map((point) => point.x + "," + point.y).join(" ");
  const area = points[0].x + "," + (height - 10) + " " + polyline + " " + points[points.length - 1].x + "," + (height - 10);
  const peak = points.reduce((best, point) => (point.value > best.value ? point : best), points[0]);
  const average = Math.round(points.reduce((sum, point) => sum + point.value, 0) / points.length);

  return `
    <div class="chart-frame">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Behavior risk trend">
        <defs>
          <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="rgba(228, 125, 47, 0.34)"></stop>
            <stop offset="100%" stop-color="rgba(228, 125, 47, 0.02)"></stop>
          </linearGradient>
        </defs>
        <line x1="20" y1="20" x2="20" y2="${height - 10}" stroke="rgba(15,45,50,0.16)"></line>
        <line x1="20" y1="${height - 10}" x2="${width - 20}" y2="${height - 10}" stroke="rgba(15,45,50,0.16)"></line>
        <polygon points="${area}" fill="url(#lineFill)"></polygon>
        <polyline points="${polyline}" fill="none" stroke="#d9612f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
        ${points.map((point) => `
          <g>
            <circle cx="${point.x}" cy="${point.y}" r="5" fill="#0f6b63"></circle>
            <text x="${point.x}" y="${height + 6}" text-anchor="middle" fill="#466067" font-size="12">${point.label}</text>
          </g>
        `).join("")}
      </svg>
      <div class="chart-legend">
        <span>Average signal <strong>${average}%</strong></span>
        <span>Peak event <strong>${peak.action}</strong></span>
      </div>
    </div>
  `;
}

function renderBarChart(scores) {
  if (!scores.length) {
    return '<div class="empty-state">No entity scores available.</div>';
  }

  return scores
    .slice()
    .sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))
    .slice(0, 6)
    .map((item) => `
      <div class="bar-row">
        <div class="bar-row-header">
          <span>${item.entityId}</span>
          <strong>${Math.round(Number(item.risk_score || 0))}%</strong>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${Math.min(100, Number(item.risk_score || 0))}%"></div>
        </div>
      </div>
    `)
    .join("");
}

function renderAnomalyCard(item) {
  return `
    <article class="anomaly-card">
      <div class="anomaly-header">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.entityId)} • ${escapeHtml(item.source)}</span>
        </div>
        <span class="severity-pill severity-${escapeHtml(item.severity)}">${escapeHtml(item.severity)}</span>
      </div>
      <p>${escapeHtml(item.detail)}</p>
      <span>Risk score ${Math.round(Number(item.score || 0))}% • ${formatDateTime(item.timestamp)}</span>
    </article>
  `;
}

function renderAlertRailCard(item) {
  return `
    <article class="alert-card">
      <span class="severity-pill severity-${escapeHtml(item.severity)}">${escapeHtml(item.severity)}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.entityId)} • ${escapeHtml(item.detail)}</p>
      <span>${formatDateTime(item.timestamp)}</span>
    </article>
  `;
}

function renderActivityRow(log) {
  const context = describeLogContext(log);
  const isAlert = isSuspiciousLog(log);

  return `
    <tr>
      <td>${escapeHtml(log.entityId)}</td>
      <td><span class="tag">${escapeHtml(log.entityType)}</span></td>
      <td>${escapeHtml(humanizeAction(log.action))}</td>
      <td>${escapeHtml(context)}</td>
      <td>${isAlert ? '<span class="tag tag-alert">Alert</span> ' : ""}${formatTime(log.timestamp)}</td>
    </tr>
  `;
}

function isSuspiciousLog(log) {
  const meta = log.metadata || {};
  return (
    log.riskTag === "suspicious" ||
    meta.accessType === "unauthorized" ||
    meta.destination === "external" ||
    meta.destination === "external_server" ||
    meta.device === "unknown" ||
    meta.destinationIP === "unknown_ip"
  );
}

function deriveLogSeverityScore(log) {
  const meta = log.metadata || {};
  let score = 42;

  if (log.riskTag === "suspicious") score += 16;
  if (meta.accessType === "unauthorized") score += 18;
  if (meta.destination === "external" || meta.destination === "external_server") score += 12;
  if (meta.device === "unknown" || meta.destinationIP === "unknown_ip") score += 10;
  if (meta.fileSizeMB) score += Math.min(20, meta.fileSizeMB / 200);

  return Math.min(99, Math.round(score));
}

function describeLogContext(log) {
  const meta = log.metadata || {};

  if (log.action === "login") {
    return "Login from " + (meta.device || "known device") + " in " + (meta.location || "unknown location");
  }

  if (log.action === "download" || log.action === "upload") {
    return (meta.fileName || "File") + " to " + (meta.destination || "internal") + " (" + (meta.accessType || "authorized") + ")";
  }

  if (log.action === "stream") {
    return "Stream to " + (meta.destinationIP || "destination") + " at " + (meta.dataRateMBps || 0) + " MBps";
  }

  if (log.action === "send_data") {
    return (meta.dataTransferredMB || 0) + " MB sent to " + (meta.destination || "server");
  }

  if (log.action === "print") {
    return (meta.pages || 0) + " pages of " + (meta.document || "document");
  }

  if (log.action === "logout") {
    return "Session duration " + (meta.sessionDuration || 0) + " seconds";
  }

  if (log.action === "view") {
    return "Viewed " + (meta.resource || "resource") + " in " + (meta.accessTime || 0) + " seconds";
  }

  return "Behavior event recorded";
}

function showBanner(alert) {
  elements.alertBanner.classList.add("is-visible");
  elements.alertBanner.innerHTML = `
    <strong>${escapeHtml(alert.title)}</strong>
    <p>${escapeHtml(alert.entityId)} • ${escapeHtml(alert.detail)}</p>
  `;
}

function showToast(title, message) {
  const toast = document.createElement("article");
  toast.className = "toast";
  toast.innerHTML = "<h4>" + escapeHtml(title) + "</h4><p>" + escapeHtml(message) + "</p>";
  elements.toastStack.prepend(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3200);
}

async function getJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false, data: null };
    }

    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, data: null };
  }
}

function loadSession() {
  try {
    return JSON.parse(window.localStorage.getItem("trueeye-session"));
  } catch (error) {
    return null;
  }
}

function saveSession(session) {
  window.localStorage.setItem("trueeye-session", JSON.stringify(session));
}

function clearSession() {
  window.localStorage.removeItem("trueeye-session");
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function severityRank(level) {
  if (level === "critical") return 4;
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

function scoreToLevel(score) {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function humanizeAction(action) {
  return String(action || "event")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function titleCase(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
