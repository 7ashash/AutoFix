document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("signinForm");
  const redirectParam = new URLSearchParams(window.location.search).get("redirect");
  const safeRedirect = redirectParam && /\.html(?:[?#].*)?$/i.test(redirectParam)
    ? redirectParam
    : "";

  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("signinEmail").value.trim();
    const password = document.getElementById("signinPassword").value.trim();

    try {
      const data = await window.AutoFixAuth.apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      window.AutoFixAuth.saveSession(data.token, data.user);

      if (safeRedirect) {
        window.location.href = safeRedirect;
        return;
      }

      if (data.user?.dashboardAccess?.admin) {
        window.location.href = "admin-dashboard.html";
        return;
      }

      if (data.user?.dashboardAccess?.dealer) {
        window.location.href = "dealer-dashboard.html";
        return;
      }

      window.location.href = "index.html";
    } catch (error) {
      window.AutoFixToast.error(error.message || "Unable to sign in right now.");
    }
  });
});
