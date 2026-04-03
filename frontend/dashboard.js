document.addEventListener("DOMContentLoaded", () => {
  const app = window.TrustEye;
  const session = app.requireRole("admin");
  if (!session) return;

  const elements = {
    sidebarUserName: document.getElementById("sidebarUserName"),
    sidebarUserEmail: document.getElementById("sidebarUserEmail"),
    topbarUser: document.getElementById("topbarUser"),
    socketState: document.getElementById("socketState"),
    mlFeedStatus: document.getElementById("mlFeedStatus"),
    alertCounter: document.getElementById("alertCounter"),
    alertBadge: document.getElementById("alertBadge"),
    entityCount: document.getElementById("entityCount"),
    averageRisk: document.getElementById("averageRisk"),
    anomalyCount: document.getElementById("anomalyCount"),
    topEntity: document.getElementById("topEntity"),
    topEntityMeta: document.getElementById("topEntityMeta"),
    alertList: document.getElementById("alertList"),
    statusFeed: document.getElementById("statusFeed"),
    commandOutput: document.getElementById("commandOutput"),
    logsTableBody: document.getElementById("logsTableBody"),
    logSearchInput: document.getElementById("logSearchInput"),
    logFilterSelect: document.getElementById("logFilterSelect"),
    refreshBtn: document.getElementById("refreshBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    generateBtn: document.getElementById("generateBtn"),
    scoreAllBtn: document.getElementById("scoreAllBtn"),
    retrainBtn: document.getElementById("retrainBtn"),
    generateCountInput: document.getElementById("generateCountInput")
  };

  const state = {
    scores: [],
    logs: [],
    alerts: [],
    anomalySeries: [],
    riskChart: null,
    anomalyChart: null,
    socket: null,
    audioContext: null
  };

  elements.sidebarUserName.textContent = session.displayName;
  elements.sidebarUserEmail.textContent = session.email;
  elements.topbarUser.textContent = session.displayName;

  document.addEventListener("pointerdown", unlockAudio, { once: true });

  bindEvents();
  initialize();

  async function initialize() {
    app.setLoader(true, "Loading TrustEye dashboard...");
    addStatus("System", "Bootstrapping dashboard telemetry.");

    await Promise.all([loadScores(), loadLogs()]);
    seedAlerts();
    buildAnomalySeries();
    setupCharts();
    renderSummary();
    renderAlerts();
    renderLogs();
    connectSocket();

    app.setLoader(false);
    addStatus("Ready", "Dashboard synchronized with backend APIs.");
  }

  function bindEvents() {
    elements.refreshBtn.addEventListener("click", async () => {
      await withButtonLoading(elements.refreshBtn, "Refreshing...", async () => {
        await Promise.all([loadScores(), loadLogs()]);
        seedAlerts();
        buildAnomalySeries();
        updateCharts();
        renderSummary();
        renderAlerts();
        renderLogs();
        addStatus("Refresh", "Dashboard data refreshed successfully.");
      });
    });

    elements.logoutBtn.addEventListener("click", () => app.logout());

    elements.logSearchInput.addEventListener("input", renderLogs);
    elements.logFilterSelect.addEventListener("change", renderLogs);

    elements.generateBtn.addEventListener("click", async () => {
      const count = Number(elements.generateCountInput.value || 20);
      await withButtonLoading(elements.generateBtn, "Generating...", async () => {
        const response = await app.request(`/generate?count=${count}`);
        addCommand("Generate Logs", response.message || `${count} logs generated.`);
        await Promise.all([loadLogs(), loadScores()]);
        seedAlerts();
        buildAnomalySeries();
        updateCharts();
        renderSummary();
        renderLogs();
      });
    });

    elements.scoreAllBtn.addEventListener("click", async () => {
      await withButtonLoading(elements.scoreAllBtn, "Scoring...", async () => {
        const response = await app.request("/score-all", { method: "POST" });
        addCommand("Score All Logs", `${response.scored || 0} logs scored by the ML service.`);
        await Promise.all([loadScores(), loadLogs()]);
        seedAlerts();
        buildAnomalySeries();
        updateCharts();
        renderSummary();
        renderAlerts();
        renderLogs();
      });
    });

    elements.retrainBtn.addEventListener("click", async () => {
      await withButtonLoading(elements.retrainBtn, "Starting...", async () => {
        const response = await app.request("/retrain", { method: "POST" });
        addCommand("Retrain Model", response.message || "Retrain started...");
        addStatus("Retrain", "Retrain started...");
        app.toast("Retrain started", "The model is retraining in the background.", "warning");
      });
    });
  }

  async function loadScores() {
    try {
      const scores = await app.request("/scores");
      state.scores = Array.isArray(scores) && scores.length ? scores : app.FALLBACK_SCORES;
      elements.mlFeedStatus.textContent = Array.isArray(scores) && scores.length ? "Live" : "Fallback";
    } catch (error) {
      state.scores = app.FALLBACK_SCORES;
      elements.mlFeedStatus.textContent = "Fallback";
      addStatus("ML Feed", error.message);
    }
  }

  async function loadLogs() {
    try {
      const logs = await app.request("/logs?limit=100");
      state.logs = Array.isArray(logs) && logs.length ? logs : app.FALLBACK_LOGS;
    } catch (error) {
      state.logs = app.FALLBACK_LOGS;
      addStatus("Log Feed", error.message);
    }
  }

  function seedAlerts() {
    const seeded = [];

    state.scores
      .slice()
      .sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))
      .slice(0, 3)
      .forEach((item) => {
        seeded.push({
          id: `seed-score-${item.entityId}`,
          entityId: item.entityId,
          riskScore: Number(item.risk_score || 0),
          riskLevel: item.risk_level || app.scoreToLevel(item.risk_score),
          timestamp: new Date().toISOString(),
          source: "Score snapshot"
        });
      });

    state.logs
      .filter((log) => app.isSuspiciousLog(log))
      .slice(0, 3)
      .forEach((log) => {
        seeded.push({
          id: `seed-log-${log.entityId}-${log.action}`,
          entityId: log.entityId,
          riskScore: 68,
          riskLevel: "high",
          timestamp: log.timestamp,
          source: log.action
        });
      });

    state.alerts = dedupeAlerts([...state.alerts, ...seeded]).slice(0, 8);
  }

  function buildAnomalySeries() {
    const counts = new Map();

    state.logs
      .filter((log) => app.isSuspiciousLog(log))
      .slice()
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .forEach((log) => {
        const label = app.formatTime(log.timestamp);
        counts.set(label, (counts.get(label) || 0) + 1);
      });

    state.anomalySeries = Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .slice(-10);

    if (!state.anomalySeries.length) {
      state.anomalySeries = [{ label: app.formatTime(new Date().toISOString()), count: 0 }];
    }
  }

  function setupCharts() {
    if (typeof Chart === "undefined") {
      addStatus("Chart.js", "Chart.js CDN failed to load.");
      return;
    }

    const riskContext = document.getElementById("riskChart");
    const anomalyContext = document.getElementById("anomalyChart");

    state.riskChart = new Chart(riskContext, {
      type: "bar",
      data: getRiskChartData(),
      options: chartOptions("Risk Score")
    });

    state.anomalyChart = new Chart(anomalyContext, {
      type: "line",
      data: getAnomalyChartData(),
      options: {
        ...chartOptions("Anomalies"),
        tension: 0.35
      }
    });
  }

  function updateCharts() {
    if (state.riskChart) {
      state.riskChart.data = getRiskChartData();
      state.riskChart.update();
    }

    if (state.anomalyChart) {
      state.anomalyChart.data = getAnomalyChartData();
      state.anomalyChart.update();
    }
  }

  function getRiskChartData() {
    const topScores = state.scores
      .slice()
      .sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))
      .slice(0, 8);

    return {
      labels: topScores.map((item) => item.entityId),
      datasets: [{
        label: "Risk Score",
        data: topScores.map((item) => Number(item.risk_score || 0)),
        backgroundColor: topScores.map((item) => colorForLevel(item.risk_level || app.scoreToLevel(item.risk_score))),
        borderRadius: 10
      }]
    };
  }

  function getAnomalyChartData() {
    return {
      labels: state.anomalySeries.map((point) => point.label),
      datasets: [{
        label: "Anomalies",
        data: state.anomalySeries.map((point) => point.count),
        borderColor: "#ff5e7d",
        backgroundColor: "rgba(255, 94, 125, 0.18)",
        fill: true,
        pointBackgroundColor: "#9effc7",
        pointBorderColor: "#9effc7"
      }]
    };
  }

  function chartOptions(labelText) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#d6e6ff" }
        }
      },
      scales: {
        x: {
          ticks: { color: "#91a7c6" },
          grid: { color: "rgba(145, 167, 198, 0.08)" }
        },
        y: {
          ticks: { color: "#91a7c6" },
          grid: { color: "rgba(145, 167, 198, 0.08)" },
          title: {
            display: true,
            text: labelText,
            color: "#91a7c6"
          }
        }
      }
    };
  }

  function renderSummary() {
    const entityCount = new Set([
      ...state.scores.map((item) => item.entityId),
      ...state.logs.map((log) => log.entityId)
    ]).size;

    const averageRisk = state.scores.length
      ? Math.round(state.scores.reduce((sum, item) => sum + Number(item.risk_score || 0), 0) / state.scores.length)
      : 0;

    const top = state.scores
      .slice()
      .sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))[0];

    const anomalyCount = state.logs.filter((log) => app.isSuspiciousLog(log)).length + state.alerts.length;

    elements.entityCount.textContent = String(entityCount);
    elements.averageRisk.textContent = `${averageRisk}%`;
    elements.anomalyCount.textContent = String(anomalyCount);
    elements.topEntity.textContent = top ? top.entityId : "None";
    elements.topEntityMeta.textContent = top
      ? `${Math.round(Number(top.risk_score || 0))}% risk • ${(top.anomaly_count || 0)} anomalies`
      : "Awaiting telemetry.";
    elements.alertCounter.textContent = String(state.alerts.length);
    elements.alertBadge.textContent = String(state.alerts.length);
  }

  function renderAlerts() {
    if (!state.alerts.length) {
      elements.alertList.innerHTML = '<div class="empty-state">No live alerts yet. Generate logs or simulate suspicious activity.</div>';
      return;
    }

    elements.alertList.innerHTML = state.alerts
      .slice(0, 8)
      .map((alert) => `
        <article class="alert-card ${app.levelClass(alert.riskLevel)}">
          <div class="alert-card__head">
            <span class="badge ${badgeClass(alert.riskLevel)}">${app.escapeHtml(alert.riskLevel)}</span>
            <span class="muted-copy">${app.escapeHtml(app.formatDateTime(alert.timestamp))}</span>
          </div>
          <strong>${app.escapeHtml(alert.entityId)}</strong>
          <p>Risk ${Math.round(Number(alert.riskScore || 0))}% • ${app.escapeHtml(alert.source || "Socket alert")}</p>
        </article>
      `)
      .join("");
  }

  function renderLogs() {
    const query = elements.logSearchInput.value.trim().toLowerCase();
    const filter = elements.logFilterSelect.value;

    const filteredLogs = state.logs.filter((log) => {
      const matchesQuery = !query
        || log.entityId.toLowerCase().includes(query)
        || String(log.action || "").toLowerCase().includes(query)
        || app.describeLog(log).toLowerCase().includes(query);

      const matchesFilter = filter === "all" || app.isSuspiciousLog(log);
      return matchesQuery && matchesFilter;
    });

    if (!filteredLogs.length) {
      elements.logsTableBody.innerHTML = '<tr><td colspan="4" class="empty-cell">No logs match the current filter.</td></tr>';
      return;
    }

    elements.logsTableBody.innerHTML = filteredLogs
      .slice(0, 100)
      .map((log) => `
        <tr class="${app.isSuspiciousLog(log) ? "row-suspicious" : ""}">
          <td>${app.escapeHtml(log.entityId)}</td>
          <td>${app.escapeHtml(app.titleCase(String(log.action || "").replace(/_/g, " ")))}</td>
          <td>${app.escapeHtml(app.describeLog(log))}</td>
          <td>${app.escapeHtml(app.formatDateTime(log.timestamp))}</td>
        </tr>
      `)
      .join("");
  }

  function connectSocket() {
    if (typeof io === "undefined") {
      elements.socketState.textContent = "Socket.IO CDN failed to load.";
      addStatus("Socket", "Real-time stream unavailable.");
      return;
    }

    state.socket = io("http://localhost:3000");

    state.socket.on("connect", () => {
      elements.socketState.textContent = "Connected to real-time stream";
      addStatus("Socket", "Connected to new-alert and retrain events.");
    });

    state.socket.on("disconnect", () => {
      elements.socketState.textContent = "Disconnected from real-time stream";
      addStatus("Socket", "Connection lost. Waiting to reconnect.");
    });

    state.socket.on("new-alert", (payload) => {
      const alert = normalizeAlert(payload, "Socket alert");
      state.alerts = dedupeAlerts([alert, ...state.alerts]).slice(0, 8);
      incrementAnomalySeries(alert.timestamp);
      renderSummary();
      renderAlerts();
      updateCharts();
      addStatus("New Alert", `${alert.entityId} reached ${Math.round(alert.riskScore)}% risk.`);
      app.toast("Critical alert", `${alert.entityId} triggered a ${alert.riskLevel} alert.`, "danger");
      playAlertTone(alert.riskLevel);
    });

    state.socket.on("retrain-complete", async (payload) => {
      addStatus("Retrain Complete", `Model retrained for ${Array.isArray(payload.entities) ? payload.entities.length : 0} entities.`);
      addCommand("Retrain Model", "Retrain complete");
      app.toast("Retrain complete", "TrustEye models were reloaded successfully.", "success");
      await Promise.all([loadScores(), loadLogs()]);
      seedAlerts();
      buildAnomalySeries();
      updateCharts();
      renderSummary();
      renderAlerts();
      renderLogs();
    });

    state.socket.on("retrain-failed", (payload) => {
      addStatus("Retrain Failed", payload && payload.error ? payload.error : "Unknown retrain error.");
      addCommand("Retrain Model", "Retrain failed");
      app.toast("Retrain failed", payload && payload.error ? payload.error : "Unknown retrain error.", "danger");
    });
  }

  function incrementAnomalySeries(timestamp) {
    const label = app.formatTime(timestamp);
    const last = state.anomalySeries[state.anomalySeries.length - 1];

    if (last && last.label === label) {
      last.count += 1;
    } else {
      state.anomalySeries.push({ label, count: 1 });
      if (state.anomalySeries.length > 10) {
        state.anomalySeries.shift();
      }
    }
  }

  function normalizeAlert(payload, source) {
    return {
      entityId: payload.entityId || "unknown_entity",
      riskScore: Number(payload.riskScore || payload.risk_score || 0),
      riskLevel: String(payload.riskLevel || payload.risk_level || app.scoreToLevel(payload.riskScore || payload.risk_score || 0)).toLowerCase(),
      timestamp: payload.timestamp || new Date().toISOString(),
      source
    };
  }

  function addStatus(title, message) {
    prependFeed(elements.statusFeed, title, message);
  }

  function addCommand(title, message) {
    prependFeed(elements.commandOutput, title, message);
  }

  function prependFeed(target, title, message) {
    const entry = document.createElement("article");
    entry.className = "feed-entry";
    entry.innerHTML = `
      <strong>${app.escapeHtml(title)}</strong>
      <p>${app.escapeHtml(message)}</p>
      <span>${app.escapeHtml(app.formatDateTime(new Date().toISOString()))}</span>
    `;
    target.prepend(entry);
  }

  async function withButtonLoading(button, loadingLabel, task) {
    const initialLabel = button.textContent;
    button.disabled = true;
    button.textContent = loadingLabel;
    app.setLoader(true, loadingLabel);

    try {
      await task();
    } catch (error) {
      addCommand("Error", error.message);
      app.toast("Action failed", error.message, "danger");
    } finally {
      button.disabled = false;
      button.textContent = initialLabel;
      app.setLoader(false);
    }
  }

  function colorForLevel(level) {
    const value = String(level || "low").toLowerCase();
    if (value === "critical") return "rgba(255, 94, 125, 0.82)";
    if (value === "high") return "rgba(255, 159, 67, 0.82)";
    if (value === "medium") return "rgba(255, 214, 102, 0.82)";
    return "rgba(110, 231, 183, 0.82)";
  }

  function badgeClass(level) {
    const value = String(level || "low").toLowerCase();
    if (value === "critical") return "badge-critical";
    if (value === "high") return "badge-high";
    if (value === "medium") return "badge-medium";
    return "badge-low";
  }

  function dedupeAlerts(alerts) {
    const seen = new Set();
    return alerts.filter((alert) => {
      const key = alert.id || `${alert.entityId}-${alert.timestamp}-${alert.riskLevel}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function unlockAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    state.audioContext = new AudioContextClass();
  }

  function playAlertTone(level) {
    if (!state.audioContext) return;
    const frequency = level === "critical" ? 880 : level === "high" ? 660 : 520;
    const oscillator = state.audioContext.createOscillator();
    const gain = state.audioContext.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.001;

    oscillator.connect(gain);
    gain.connect(state.audioContext.destination);

    const now = state.audioContext.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    oscillator.start(now);
    oscillator.stop(now + 0.3);
  }
});
