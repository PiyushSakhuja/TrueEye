document.addEventListener("DOMContentLoaded", () => {
  const app = window.TrustEye;
  const session = app.requireRole("user");
  if (!session) return;

  const elements = {
    simDisplayName: document.getElementById("simDisplayName"),
    simEmail: document.getElementById("simEmail"),
    simUserEntity: document.getElementById("simUserEntity"),
    simDeviceEntity: document.getElementById("simDeviceEntity"),
    stressModeToggle: document.getElementById("stressModeToggle"),
    stressModeStatus: document.getElementById("stressModeStatus"),
    lastRiskScore: document.getElementById("lastRiskScore"),
    lastRiskLevel: document.getElementById("lastRiskLevel"),
    actionCount: document.getElementById("actionCount"),
    resultPanel: document.getElementById("resultPanel"),
    activityFeed: document.getElementById("activityFeed"),
    logoutBtn: document.getElementById("logoutBtn"),
    actionTriggers: Array.from(document.querySelectorAll(".action-trigger"))
  };

  const state = {
    actionCount: 0
  };

  elements.simDisplayName.textContent = session.displayName;
  elements.simEmail.textContent = session.email;
  elements.simUserEntity.textContent = session.userEntityId;
  elements.simDeviceEntity.textContent = session.deviceEntityId;
  elements.stressModeStatus.textContent = elements.stressModeToggle.checked ? "On" : "Off";
  elements.resultPanel.innerHTML = '<div class="empty-state">Run an action to see the ML response payload and risk score.</div>';

  bindEvents();

  function bindEvents() {
    elements.logoutBtn.addEventListener("click", () => app.logout());

    elements.stressModeToggle.addEventListener("change", () => {
      elements.stressModeStatus.textContent = elements.stressModeToggle.checked ? "On" : "Off";
      app.toast(
        "Stress mode updated",
        elements.stressModeToggle.checked
          ? "Actions will now bias toward suspicious metadata."
          : "Actions will now use more normal telemetry.",
        "info"
      );
    });

    elements.actionTriggers.forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.action;
        const payload = buildPayload(action, elements.stressModeToggle.checked, session);
        await triggerAction(button, action, payload);
      });
    });
  }

  async function triggerAction(button, action, payload) {
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Sending...";
    app.setLoader(true, `Sending ${action.replace(/_/g, " ")} event to /api/score...`);

    try {
      const result = await app.request("/score", {
        method: "POST",
        body: payload
      });

      state.actionCount += 1;
      elements.actionCount.textContent = String(state.actionCount);

      renderResult(action, payload, result);
      addActivity(action, payload, result);
      updateScoreSummary(result);

      const riskLevel = String(result.risk_level || "low").toLowerCase();
      app.toast(
        `${app.titleCase(action.replace(/_/g, " "))} scored`,
        result.message || `${result.entityId} returned ${Math.round(Number(result.risk_score || 0))}% risk.`,
        riskLevel === "critical" || riskLevel === "high" ? "danger" : "success"
      );
    } catch (error) {
      app.toast("Action failed", error.message, "danger");
      addActivity(action, payload, { error: error.message });
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
      app.setLoader(false);
    }
  }

  function renderResult(action, payload, result) {
    const level = String(result.risk_level || "unknown").toLowerCase();
    const badge = level === "critical"
      ? "badge-critical"
      : level === "high"
        ? "badge-high"
        : level === "medium"
          ? "badge-medium"
          : "badge-low";

    elements.resultPanel.innerHTML = `
      <article class="result-card ${app.levelClass(level)}">
        <div class="result-card__head">
          <span class="badge ${badge}">${app.escapeHtml(level)}</span>
          <span class="muted-copy">${app.escapeHtml(app.formatDateTime(new Date().toISOString()))}</span>
        </div>
        <strong>${app.escapeHtml(app.titleCase(action.replace(/_/g, " ")))}</strong>
        <p>Entity: ${app.escapeHtml(result.entityId || payload.entityId)}</p>
        <p>Risk score: ${result.risk_score != null ? Math.round(Number(result.risk_score)) + "%" : "Model pending"}</p>
        <p>${app.escapeHtml(result.message || `Anomaly flag: ${result.is_anomaly ? "true" : "false"}`)}</p>
        <pre class="result-json">${app.escapeHtml(JSON.stringify(payload, null, 2))}</pre>
      </article>
    `;
  }

  function updateScoreSummary(result) {
    elements.lastRiskScore.textContent = result.risk_score != null ? `${Math.round(Number(result.risk_score))}%` : "--";
    elements.lastRiskLevel.textContent = result.risk_level ? app.titleCase(result.risk_level) : "Pending";
  }

  function addActivity(action, payload, result) {
    const entry = document.createElement("article");
    entry.className = "feed-entry";
    entry.innerHTML = `
      <strong>${app.escapeHtml(app.titleCase(action.replace(/_/g, " ")))}</strong>
      <p>${app.escapeHtml(payload.entityId)} • ${app.escapeHtml(result.error || result.message || `Risk ${Math.round(Number(result.risk_score || 0))}%`)}</p>
      <span>${app.escapeHtml(app.formatDateTime(payload.timestamp))}</span>
    `;
    elements.activityFeed.prepend(entry);
  }

  function buildPayload(action, stressMode, activeSession) {
    const suspicious = stressMode ? Math.random() < 0.72 : Math.random() < 0.2;
    const files = ["report.pdf", "salary.xlsx", "db_dump.sql", "strategy.docx", "data.csv"];
    const userPayload = {
      entityId: activeSession.userEntityId,
      entityType: "user",
      action,
      timestamp: new Date().toISOString(),
      metadata: {}
    };

    const devicePayload = {
      entityId: activeSession.deviceEntityId,
      entityType: "device",
      action,
      timestamp: new Date().toISOString(),
      metadata: {}
    };

    if (action === "login") {
      userPayload.metadata = {
        ip: `192.168.${app.randomInt(1, 255)}.${app.randomInt(1, 255)}`,
        location: suspicious ? app.randomChoice(["Russia", "China", "Germany"]) : "India",
        device: suspicious ? "unknown" : app.randomChoice(["laptop", "mobile", "desktop"]),
        loginStatus: "success"
      };
      return userPayload;
    }

    if (action === "download" || action === "upload") {
      userPayload.metadata = {
        fileName: app.randomChoice(files),
        fileSizeMB: suspicious ? app.randomInt(1200, 5000) : app.randomInt(10, 180),
        destination: suspicious ? "external" : "internal",
        accessType: suspicious ? "unauthorized" : "authorized"
      };
      return userPayload;
    }

    if (action === "send_data") {
      devicePayload.metadata = {
        dataTransferredMB: suspicious ? app.randomInt(1200, 5000) : app.randomInt(30, 180),
        destination: suspicious ? "external_server" : "internal_server"
      };
      return devicePayload;
    }

    if (action === "print") {
      devicePayload.metadata = {
        pages: suspicious ? app.randomInt(200, 1000) : app.randomInt(1, 40),
        document: app.randomChoice(files),
        status: "completed"
      };
      return devicePayload;
    }

    return userPayload;
  }
});
