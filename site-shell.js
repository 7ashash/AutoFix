(function () {
  const API_BASE = "http://localhost:4000/api";
  const AUTH_TOKEN_KEY = "autofixAuthToken";
  const AUTH_USER_KEY = "loggedInUser";

  function getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY) || "";
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_USER_KEY)) || null;
    } catch {
      return null;
    }
  }

  function saveSession(token, user) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }

  async function refreshSessionUser() {
    const token = getToken();
    const cachedUser = getUser();
    if (!token) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const payload = await response.json().catch(() => null);
      const profile = payload?.data?.user || payload?.data || null;
      if (!response.ok || !payload?.success || !profile) {
        if (response.status === 401) {
          clearSession();
          return null;
        }

        return cachedUser;
      }

      saveSession(token, profile);
      return profile;
    } catch {
      return cachedUser;
    }
  }

  async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (!headers.has("Content-Type") && options.body) {
      headers.set("Content-Type", "application/json");
    }

    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success) {
      const message = payload?.error?.message || "Request failed";
      if (response.status === 401) {
        clearSession();
      }
      const error = new Error(message);
      error.statusCode = response.status;
      error.payload = payload;
      throw error;
    }

    return payload.data;
  }

  function requireRoleAccess({ admin = false, dealer = false } = {}, userOverride = null) {
    const user = userOverride || getUser();

    if (!user) {
      window.location.href = "signin.html";
      return false;
    }

    if (admin && !user.dashboardAccess?.admin) {
      window.location.href = "index.html";
      return false;
    }

    if (dealer && !(user.dashboardAccess?.dealer || user.dashboardAccess?.admin)) {
      window.location.href = "index.html";
      return false;
    }

    return true;
  }

  window.AutoFixAuth = {
    apiBase: API_BASE,
    getToken,
    getUser,
    saveSession,
    clearSession,
    refreshSessionUser,
    apiFetch,
    requireRoleAccess
  };

  const TOAST_VARIANT_KEYWORDS = {
    success: ["success", "added", "saved", "updated", "created", "restored", "confirmed", "processed", "logged out"],
    error: ["error", "failed", "unable", "could not", "incorrect", "invalid", "empty", "required", "please", "no product", "not found"],
    warning: ["warning", "skipped", "old preview", "choose", "select", "fill"]
  };
  const TOAST_ICONS = {
    success: "✓",
    error: "!",
    warning: "!",
    info: "i"
  };
  let toastRoot = null;
  let dialogRoot = null;

  function inferToastType(message, preferredType = "") {
    const directType = String(preferredType || "").toLowerCase();
    if (["success", "error", "warning", "info"].includes(directType)) {
      return directType;
    }

    const normalized = String(message || "").toLowerCase();
    for (const [type, keywords] of Object.entries(TOAST_VARIANT_KEYWORDS)) {
      if (keywords.some((keyword) => normalized.includes(keyword))) {
        return type;
      }
    }

    return "info";
  }

  function ensureToastRoot() {
    if (toastRoot && document.body.contains(toastRoot)) {
      return toastRoot;
    }

    toastRoot = document.createElement("div");
    toastRoot.className = "autofix-toast-root";
    toastRoot.setAttribute("aria-live", "polite");
    toastRoot.setAttribute("aria-atomic", "false");
    document.body.appendChild(toastRoot);
    return toastRoot;
  }

  function showToast(message, options = {}) {
    const text = String(message || "Something needs your attention.").trim();
    const type = inferToastType(text, options.type);
    const root = ensureToastRoot();
    const toast = document.createElement("div");
    toast.className = `autofix-toast autofix-toast--${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.innerHTML = `
      <span class="autofix-toast__icon" aria-hidden="true">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
      <span class="autofix-toast__message"></span>
      <button class="autofix-toast__close" type="button" aria-label="Dismiss notification">×</button>
    `;
    toast.querySelector(".autofix-toast__message").textContent = text;

    const close = () => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => toast.remove(), 220);
    };

    toast.querySelector(".autofix-toast__close").addEventListener("click", close);
    root.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    window.setTimeout(close, Number(options.duration || 3600));
    return toast;
  }

  function ensureDialogRoot() {
    if (dialogRoot && document.body.contains(dialogRoot)) {
      return dialogRoot;
    }

    dialogRoot = document.createElement("div");
    dialogRoot.className = "autofix-dialog-root";
    document.body.appendChild(dialogRoot);
    return dialogRoot;
  }

  function openDialog({
    title = "Confirm action",
    message = "",
    confirmText = "Confirm",
    cancelText = "Cancel",
    type = "warning",
    input = false,
    defaultValue = ""
  } = {}) {
    return new Promise((resolve) => {
      const root = ensureDialogRoot();
      const backdrop = document.createElement("div");
      backdrop.className = "autofix-dialog-backdrop";
      backdrop.innerHTML = `
        <section class="autofix-dialog autofix-dialog--${inferToastType(message, type)}" role="dialog" aria-modal="true" aria-labelledby="autofixDialogTitle">
          <span class="autofix-dialog__eyebrow">${input ? "Input required" : "Action check"}</span>
          <h2 id="autofixDialogTitle">${title}</h2>
          <p class="autofix-dialog__message"></p>
          ${input ? '<label class="autofix-dialog__field"><span>Reason</span><input type="text"></label>' : ""}
          <div class="autofix-dialog__actions">
            <button class="autofix-dialog__btn autofix-dialog__btn--ghost" type="button" data-dialog-cancel>${cancelText}</button>
            <button class="autofix-dialog__btn autofix-dialog__btn--primary" type="button" data-dialog-confirm>${confirmText}</button>
          </div>
        </section>
      `;

      const messageNode = backdrop.querySelector(".autofix-dialog__message");
      const inputNode = backdrop.querySelector("input");
      const confirmButton = backdrop.querySelector("[data-dialog-confirm]");
      const cancelButton = backdrop.querySelector("[data-dialog-cancel]");

      messageNode.textContent = String(message || "Do you want to continue?");
      if (inputNode) {
        inputNode.value = defaultValue;
      }

      const cleanup = (value) => {
        backdrop.classList.remove("is-visible");
        window.setTimeout(() => backdrop.remove(), 180);
        resolve(value);
      };

      confirmButton.addEventListener("click", () => cleanup(inputNode ? inputNode.value : true));
      cancelButton.addEventListener("click", () => cleanup(inputNode ? null : false));
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) {
          cleanup(inputNode ? null : false);
        }
      });
      backdrop.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          cleanup(inputNode ? null : false);
        }
        if (event.key === "Enter" && inputNode && document.activeElement === inputNode) {
          cleanup(inputNode.value);
        }
      });

      root.appendChild(backdrop);
      requestAnimationFrame(() => backdrop.classList.add("is-visible"));
      window.setTimeout(() => (inputNode || confirmButton).focus(), 80);
    });
  }

  window.AutoFixToast = {
    show: showToast,
    success: (message, options = {}) => showToast(message, { ...options, type: "success" }),
    error: (message, options = {}) => showToast(message, { ...options, type: "error" }),
    warning: (message, options = {}) => showToast(message, { ...options, type: "warning" }),
    info: (message, options = {}) => showToast(message, { ...options, type: "info" })
  };
  window.AutoFixNotify = showToast;
  window.AutoFixDialog = {
    confirm: (message, options = {}) => openDialog({
      title: options.title || "Confirm action",
      message,
      confirmText: options.confirmText || "Confirm",
      cancelText: options.cancelText || "Cancel",
      type: options.type || "warning"
    }),
    prompt: (message, defaultValue = "", options = {}) => openDialog({
      title: options.title || "Add details",
      message,
      confirmText: options.confirmText || "Save",
      cancelText: options.cancelText || "Cancel",
      type: options.type || "info",
      input: true,
      defaultValue
    })
  };
  window.alert = (message) => showToast(message);

  const pageName = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const headerSlot = document.getElementById("site-header");
  const footerSlot = document.getElementById("site-footer");

  if (!headerSlot || !footerSlot) {
    return;
  }

  const currentUser = getUser();
  const shellLinks = [
    { key: "home", href: "index.html", label: "Home" },
    { key: "shop", href: "index.html#replacementSection", label: "Shop Parts" },
    { key: "verify", href: "verify.html", label: "Verify Part" },
    { key: "dealers", href: "dealers.html", label: "Dealers" }
  ];

  const dashboardLinks = [];
  if (currentUser?.dashboardAccess?.dealer || currentUser?.dashboardAccess?.admin) {
    dashboardLinks.push({ key: "dashboard", href: "dealer-dashboard.html", label: "Dealer Dashboard" });
  }
  if (currentUser?.dashboardAccess?.admin) {
    dashboardLinks.push({ key: "admin", href: "admin-dashboard.html", label: "Admin Dashboard" });
  }
  const canRequestDealerAccess = Boolean(currentUser && !currentUser?.dashboardAccess?.dealer && !currentUser?.dashboardAccess?.admin);

  const drawerLinks = [...shellLinks, ...dashboardLinks];

  const pageToActiveKey = {
    "index.html": "home",
    "product.html": "shop",
    "search.html": "shop",
    "model.html": "shop",
    "car-products.html": "shop",
    "cart.html": "shop",
    "checkout.html": "shop",
    "order.html": "shop",
    "verify.html": "verify",
    "report.html": "verify",
    "dealers.html": "dealers",
    "dealerparts.html": "dealers",
    "dealer-access-request.html": "dealers",
    "dealer-dashboard.html": "dashboard",
    "admin-dashboard.html": "admin"
  };

  const activeKey = pageToActiveKey[pageName] || "";

  const icon = {
    menu: '<svg class="site-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    robot: '<svg class="site-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="8" width="16" height="10" rx="3"/><path d="M12 4v4M9 2h6"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M8 18v2M16 18v2"/></svg>',
    user: '<svg class="site-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/></svg>',
    cart: '<svg class="site-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2.5 11h10.8L21 7H7.3"/></svg>',
    close: '<svg class="site-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6 18 18M18 6 6 18"/></svg>'
  };

  const navMarkup = shellLinks
    .map((link) => {
      const active = link.key === activeKey ? ' aria-current="page"' : "";
      return `<a class="site-nav__link" href="${link.href}"${active}>${link.label}</a>`;
    })
    .join("");

  const drawerAccountMarkup = currentUser
    ? `
        <a class="site-drawer__link" href="profile.html">Profile</a>
        <a class="site-drawer__link" href="order.html">Orders</a>
        ${canRequestDealerAccess ? '<a class="site-drawer__link" href="dealer-access-request.html">Request Dealer Access</a>' : ""}
        <button class="site-drawer__logout" type="button" data-autofix-logout>Log Out</button>
      `
    : `
        <a class="site-drawer__link" href="signin.html">Sign In</a>
        <a class="site-drawer__link" href="signup.html">Create Account</a>
      `;

  const footerAccountMarkup = currentUser
    ? `
        <li><a href="profile.html">Profile</a></li>
        <li><a href="order.html">Orders</a></li>
        ${canRequestDealerAccess ? '<li><a href="dealer-access-request.html">Request Dealer Access</a></li>' : ""}
        <li><button class="site-footer__logout" type="button" data-autofix-logout>Log Out</button></li>
      `
    : `
        <li><a href="signin.html">Sign In</a></li>
        <li><a href="signup.html">Create Account</a></li>
      `;

  headerSlot.innerHTML = `
    <header class="site-header">
      <div class="site-header__inner">
        <div class="site-header__row">
          <a class="site-brand" href="index.html">
            <span class="site-brand__mark">AF</span>
            <span class="site-brand__text-wrap">
              <span class="site-brand__title">AutoFix</span>
            </span>
          </a>

          <nav class="site-nav" aria-label="Primary">
            ${navMarkup}
          </nav>

          <div class="site-header__actions">
            <button class="site-action-btn" id="siteAssistantToggle" type="button">
              ${icon.robot}
              <span>Assistant</span>
            </button>

            <button class="site-action-btn" id="siteAuthBtn" type="button">
              ${icon.user}
              <span id="siteAuthText">${currentUser ? (currentUser.fullName?.split(" ")[0] || "Account") : "Sign In"}</span>
            </button>

            <a class="site-action-btn site-action-btn--cart" href="cart.html">
              ${icon.cart}
              <span>Cart</span>
              <span class="site-cart-count" id="siteCartCount">0</span>
            </a>
          </div>

          <button class="site-menu-btn" id="siteMenuToggle" type="button" aria-label="Open navigation">
            ${icon.menu}
          </button>
        </div>
      </div>
    </header>

    <aside class="site-drawer" id="siteDrawer" aria-hidden="true">
      <div class="site-drawer__header">
        <h2 class="site-drawer__title">Menu</h2>
        <button class="site-drawer__close" id="siteDrawerClose" type="button" aria-label="Close navigation">
          ${icon.close}
        </button>
      </div>

      <div class="site-drawer__body">
        <nav class="site-drawer__nav" aria-label="Drawer">
          ${drawerLinks.map((link) => `<a class="site-drawer__link" href="${link.href}">${link.label}</a>`).join("")}
          ${drawerAccountMarkup}
          <a class="site-drawer__link" href="cart.html">Cart</a>
        </nav>
      </div>
    </aside>

    <aside class="site-assistant" id="siteAssistant" aria-hidden="true">
      <div class="site-assistant__header">
        <h2 class="site-assistant__title">AutoFix Assistant</h2>
        <button class="site-assistant__close" id="siteAssistantClose" type="button" aria-label="Close assistant">
          ${icon.close}
        </button>
      </div>

      <div class="site-assistant__body">
        <div class="site-assistant__app" id="siteAssistantApp">
          <div class="site-assistant__loading-card">
            <span class="site-assistant__badge">AutoFix AI</span>
            <h3>Loading assistant...</h3>
            <p>
              The assistant is preparing your parts-search and diagnosis workspace.
            </p>
          </div>
        </div>
      </div>
    </aside>

    <div class="site-overlay" id="siteShellOverlay"></div>
  `;

  footerSlot.innerHTML = `
    <footer class="site-footer">
      <div class="site-footer__inner">
        <div class="site-footer__grid">
          <div class="site-footer__brand">
            <a class="site-brand" href="index.html">
              <span class="site-brand__mark">AF</span>
              <span class="site-brand__text-wrap">
                <span class="site-brand__title">AutoFix</span>
                <span class="site-brand__subtitle">Smart parts platform</span>
              </span>
            </a>

            <p class="site-footer__text">
              Find compatible spare parts faster, verify authenticity, and move through the buying journey with more confidence.
            </p>
          </div>

          <div class="site-footer__column">
            <h4>Platform</h4>
            <ul class="site-footer__links">
              <li><a href="index.html">Home</a></li>
              <li><a href="index.html#replacementSection">Shop Parts</a></li>
              <li><a href="verify.html">Verify Part</a></li>
              <li><a href="dealers.html">Dealers</a></li>
            </ul>
          </div>

          <div class="site-footer__column">
            <h4>Account</h4>
            <ul class="site-footer__links">
              ${footerAccountMarkup}
              <li><a href="cart.html">Cart</a></li>
              ${currentUser?.dashboardAccess?.dealer || currentUser?.dashboardAccess?.admin ? '<li><a href="dealer-dashboard.html">Dealer Dashboard</a></li>' : ''}
              ${currentUser?.dashboardAccess?.admin ? '<li><a href="admin-dashboard.html">Admin Dashboard</a></li>' : ''}
            </ul>
          </div>

          <div class="site-footer__column">
            <h4>More</h4>
            <ul class="site-footer__links">
              <li><span class="site-footer__muted">AI parts search + diagnosis</span></li>
              <li><a href="report.html">Report Suspicion</a></li>
              <li><a href="checkout.html">Checkout Demo</a></li>
            </ul>
          </div>
        </div>

        <div class="site-footer__bottom">
          <span><strong>AutoFix</strong> modern automotive marketplace experience.</span>
          <span>&copy; 2026 AutoFix. All rights reserved.</span>
        </div>
      </div>
    </footer>
  `;

  if (["signin.html", "signup.html"].includes(pageName)) {
    document.body.classList.add("site-shell-auth");
  }

  document.body.classList.add("site-shell-page");

  const overlay = document.getElementById("siteShellOverlay");
  const drawer = document.getElementById("siteDrawer");
  const assistant = document.getElementById("siteAssistant");
  const menuToggle = document.getElementById("siteMenuToggle");
  const drawerClose = document.getElementById("siteDrawerClose");
  const assistantToggle = document.getElementById("siteAssistantToggle");
  const assistantClose = document.getElementById("siteAssistantClose");
  const authBtn = document.getElementById("siteAuthBtn");
  const cartCount = document.getElementById("siteCartCount");
  const assistantRoot = document.getElementById("siteAssistantApp");
  let assistantModulePromise = null;

  function renderAssistantLoadError() {
    if (!assistantRoot) {
      return;
    }

    assistantRoot.innerHTML = `
      <div class="site-assistant__loading-card site-assistant__loading-card--error">
        <span class="site-assistant__badge">Assistant Error</span>
        <h3>Assistant could not load</h3>
        <p>Please refresh the page and try again. If the problem continues, restart the local AutoFix stack.</p>
      </div>
    `;
  }

  function loadAssistantScript() {
    if (window.AutoFixAssistantBoot) {
      return Promise.resolve(window.AutoFixAssistantBoot);
    }

    if (assistantModulePromise) {
      return assistantModulePromise;
    }

    assistantModulePromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-autofix-assistant-script]');

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(window.AutoFixAssistantBoot));
        existingScript.addEventListener("error", reject);
        return;
      }

      const script = document.createElement("script");
      script.src = "assistant-ui.js";
      script.defer = true;
      script.dataset.autofixAssistantScript = "true";
      script.addEventListener("load", () => resolve(window.AutoFixAssistantBoot));
      script.addEventListener("error", reject);
      document.body.appendChild(script);
    }).catch((error) => {
      assistantModulePromise = null;
      throw error;
    });

    return assistantModulePromise;
  }

  async function ensureAssistantApp() {
    if (!assistantRoot) {
      return null;
    }

    try {
      const boot = await loadAssistantScript();
      if (typeof boot !== "function") {
        throw new Error("Assistant module did not expose a boot function");
      }

      const instance = boot({
        root: assistantRoot,
        assistantPanel: assistant,
        closeAssistant
      });

      if (instance?.refresh) {
        instance.refresh();
      }

      return instance;
    } catch {
      renderAssistantLoadError();
      return null;
    }
  }

  function openDrawer() {
    if (assistant) {
      assistant.classList.remove("is-open");
    }
    drawer.classList.add("is-open");
    overlay.classList.add("is-visible");
  }

  function closeDrawer() {
    drawer.classList.remove("is-open");
    if (!assistant || !assistant.classList.contains("is-open")) {
      overlay.classList.remove("is-visible");
    }
  }

  function openAssistant() {
    if (drawer) {
      drawer.classList.remove("is-open");
    }
    if (assistant) {
      assistant.classList.add("is-open");
    }
    overlay.classList.add("is-visible");
    ensureAssistantApp();
  }

  function closeAssistant() {
    if (assistant) {
      assistant.classList.remove("is-open");
    }
    if (!drawer || !drawer.classList.contains("is-open")) {
      overlay.classList.remove("is-visible");
    }
  }

  function syncCartCount() {
    let total = Number(localStorage.getItem("autofixCartCount") || 0);

    if (!Number.isFinite(total) || total <= 0) {
      const cart = JSON.parse(localStorage.getItem("cart")) || [];
      total = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }

    if (cartCount) {
      cartCount.textContent = total;
    }
  }

  if (menuToggle) {
    menuToggle.addEventListener("click", openDrawer);
  }

  if (drawerClose) {
    drawerClose.addEventListener("click", closeDrawer);
  }

  if (assistantToggle) {
    assistantToggle.addEventListener("click", openAssistant);
  }

  if (assistantClose) {
    assistantClose.addEventListener("click", closeAssistant);
  }

  if (overlay) {
    overlay.addEventListener("click", () => {
      closeDrawer();
      closeAssistant();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDrawer();
      closeAssistant();
    }
  });

  if (authBtn) {
    authBtn.addEventListener("click", () => {
      const activeUser = getUser();

      if (!activeUser) {
        window.location.href = "signin.html";
        return;
      }

      if (activeUser.dashboardAccess?.admin) {
        window.location.href = "admin-dashboard.html";
        return;
      }

      if (activeUser.dashboardAccess?.dealer) {
        window.location.href = "dealer-dashboard.html";
        return;
      }

      window.location.href = "profile.html";
    });
  }

  document.querySelectorAll("[data-autofix-logout]").forEach((button) => {
    button.addEventListener("click", () => {
      clearSession();
      localStorage.removeItem("autofixCartCount");
      localStorage.removeItem("autofixLastOrderId");
      closeDrawer();
      closeAssistant();
      window.location.href = "index.html";
    });
  });

  window.addEventListener("autofix-cart-updated", (event) => {
    if (cartCount) {
      cartCount.textContent = Number(event?.detail?.count || 0);
    }
  });

  syncCartCount();
})();

