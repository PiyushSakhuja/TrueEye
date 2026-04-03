document.addEventListener("DOMContentLoaded", () => {
  const app = window.TrustEye;
  const session = app.getSession();

  if (session && session.role === "admin") {
    window.location.replace("/dashboard.html");
    return;
  }

  if (session && session.role === "user") {
    window.location.replace("/user.html");
    return;
  }

  const authForm = document.getElementById("authForm");
  const authTitle = document.getElementById("authTitle");
  const authSubtitle = document.getElementById("authSubtitle");
  const authHint = document.getElementById("authHint");
  const authSubmit = document.getElementById("authSubmit");
  const roleSelect = document.getElementById("roleSelect");
  const modeButtons = Array.from(document.querySelectorAll(".segment-btn"));

  let mode = "login";

  function updateMode(nextMode) {
    mode = nextMode;
    modeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.mode === nextMode);
    });

    if (nextMode === "signup") {
      authTitle.textContent = "Create your TrustEye workspace";
      authSubtitle.textContent = "Signup is mocked. Choose a role and we route you into the correct interface.";
      authHint.textContent = "Admin opens dashboard.html. User opens user.html.";
      authSubmit.textContent = "Create Mock Account";
    } else {
      authTitle.textContent = "Login to TrustEye";
      authSubtitle.textContent = "Sign in to the correct workspace. No real authentication is required.";
      authHint.textContent = "Admins open the SOC dashboard. Users open the activity simulator.";
      authSubmit.textContent = "Continue to Workspace";
    }
  }

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => updateMode(button.dataset.mode));
  });

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("emailInput").value.trim();
    const password = document.getElementById("passwordInput").value.trim();
    const role = roleSelect.value;

    if (!email || !password) {
      app.toast("Missing fields", "Enter an email and password to continue.", "warning");
      return;
    }

    const sessionPayload = app.buildSession(email, role);
    app.saveSession(sessionPayload);
    app.setLoader(true, `${mode === "signup" ? "Creating" : "Opening"} ${role} workspace...`);

    window.setTimeout(() => {
      app.setLoader(false);
      window.location.href = role === "admin" ? "/dashboard.html" : "/user.html";
    }, 600);
  });

  updateMode("login");
});
