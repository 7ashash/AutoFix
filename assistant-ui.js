(function () {
  const STORAGE_KEY_PREFIX = "autofixAssistantStateV3";
  const CONTEXT_SCOPE_KEY = "selectedCatalogScope";
  const MAX_HISTORY_MESSAGES = 12;
  const SAVED_VEHICLE_PROMPT_TTL_MS = 60 * 60 * 1000;

  const BRAND_ALIASES = {
    bmw: ["bmw", "بي ام دبليو", "بى ام دبليو", "بي ام", "بى ام"],
    audi: ["audi", "اودي", "أودي"],
    toyota: ["toyota", "تويوتا", "تويوطه"],
    hyundai: ["hyundai", "هيونداي", "هيونداى"],
    mg: ["mg", "ام جي", "إم جي", "ام جى", "إم جى"],
    nissan: ["nissan", "نيسان"],
    mercedes: ["mercedes", "mercedes benz", "مرسيدس", "مرسيدس بنز", "بنز"],
    peugeot: ["peugeot", "بيجو", "بيچو"],
    kia: ["kia", "كيا"],
    chevrolet: ["chevrolet", "شيفروليه", "شيفرولية", "شيفرولت", "شيفرليه"]
  };

  const LOCALES = [
    { code: "ar-eg", label: "العربية" },
    { code: "en", label: "English" }
  ];

  const MODES = [
    {
      key: "parts_search",
      label: {
        en: "Parts search",
        "ar-eg": "بحث قطع"
      }
    },
    {
      key: "fault_diagnosis",
      label: {
        en: "Fault diagnosis",
        "ar-eg": "تشخيص عطل"
      }
    }
  ];

  function normalizeLocale(value) {
    return value === "ar-eg" ? "ar-eg" : "en";
  }

  function normalizeMode(value) {
    return value === "fault_diagnosis" ? "fault_diagnosis" : "parts_search";
  }

  function getDirection(locale) {
    return locale === "ar-eg" ? "rtl" : "ltr";
  }

  function normalizeLooseText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[\u064B-\u065F]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[^a-z0-9\u0600-\u06ff\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function hasLooseMatch(haystack, candidate) {
    const normalizedHaystack = normalizeLooseText(haystack);
    const normalizedCandidate = normalizeLooseText(candidate);

    if (!normalizedCandidate) {
      return false;
    }

    return new RegExp(`(^|\\s)${escapeRegExp(normalizedCandidate)}(\\s|$)`).test(normalizedHaystack);
  }

  function getViewerStorageKey() {
    const currentUser = window.AutoFixAuth?.getUser?.();
    if (currentUser?.id) {
      return `${STORAGE_KEY_PREFIX}:user:${currentUser.id}`;
    }

    return `${STORAGE_KEY_PREFIX}:guest`;
  }

  function getStoredState(viewerStorageKey = getViewerStorageKey()) {
    try {
      return JSON.parse(localStorage.getItem(viewerStorageKey)) || {};
    } catch {
      return {};
    }
  }

  function saveStoredState(nextState, viewerStorageKey = getViewerStorageKey()) {
    localStorage.setItem(viewerStorageKey, JSON.stringify(nextState));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeDisplayText(value, locale) {
    const isArabic = locale === "ar-eg";

    let cleaned = String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      .replace(/^#{1,6}\s*/gm, "")
      .replace(/^[ \t]*[-*][ \t]+/gm, "• ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();

    cleaned = cleaned
      .replace(/\n{2,}/g, "\n")
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      .trim();

    cleaned = isArabic
      ? cleaned.replace(/\n{2,}/g, "\n")
      : cleaned.replace(/\n{3,}/g, "\n\n");

    return cleaned;
  }

  function formatPrice(value) {
    return `${Number(value || 0)} EGP`;
  }

  function getBrandLabel(brandKey) {
    if (window.getAutoFixBrandName) {
      return window.getAutoFixBrandName(brandKey);
    }
    return String(brandKey || "").toUpperCase();
  }

  function historyKey(locale, mode) {
    return `${locale}:${mode}`;
  }

  function normalizeMessageHistory(messages = []) {
    return messages
      .filter((message) => message?.role && message?.text)
      .slice(-MAX_HISTORY_MESSAGES)
      .map((message) => ({
        role: message.role,
        text: String(message.text || "").trim()
      }));
  }

  function mapHistoryRows(rows = []) {
    return rows
      .slice()
      .reverse()
      .flatMap((entry) => ([
        {
          role: "user",
          text: entry.userMessage || "",
          createdAt: entry.createdAt
        },
        {
          role: "assistant",
          text: entry.assistantResponse || "",
          createdAt: entry.createdAt,
          meta: {
            statusLabel: entry.status || "",
            suggestedAction: entry.suggestedAction || "",
            intent: entry.intent || "",
            data: entry.data || {}
          }
        }
      ]));
  }

  function getCurrentContext() {
    const brandKey = window.AutoFixCatalogApi?.normalizeBrandKey(localStorage.getItem("selectedBrand")) || "";
    const modelKey = String(localStorage.getItem("selectedModel") || "").trim().toLowerCase();
    const modelName = String(localStorage.getItem("selectedModelName") || modelKey || "").trim();
    const year = Number(localStorage.getItem("selectedYear") || 0) || null;
    const dealerId = Number(localStorage.getItem("selectedDealerId") || 0) || null;
    const dealerSlug = String(localStorage.getItem("selectedDealerSlug") || "").trim();
    const dealerName = String(localStorage.getItem("selectedDealerName") || dealerSlug || "").trim();
    const partId = Number(localStorage.getItem("selectedPartId") || 0) || null;
    const partSlug = String(localStorage.getItem("selectedPartSlug") || "").trim();
    const scope = String(localStorage.getItem(CONTEXT_SCOPE_KEY) || "marketplace").trim() || "marketplace";

    return {
      brandKey,
      modelKey,
      modelName,
      year,
      dealerId,
      dealerSlug,
      dealerName,
      partId,
      partSlug,
      page: (window.location.pathname.split("/").pop() || "index.html").toLowerCase(),
      scope,
      vehicleLabel: brandKey && modelName && year
        ? `${getBrandLabel(brandKey)} ${modelName} ${year}`
        : ""
    };
  }

  function buildDefaultAssistantMessage(locale, mode) {
    if (locale === "ar-eg") {
      return {
        role: "assistant",
        text: mode === "fault_diagnosis"
          ? "احكيلي العرض الأساسي للعطل، وأنا هرتبه معاك خطوة بخطوة."
          : "اكتب اسم القطعة أو العربية والموديل والسنة، وأنا أطلع لك أنسب نتيجة."
      };
    }

    return {
      role: "assistant",
      text: mode === "fault_diagnosis"
        ? "Tell me the main fault symptom and I’ll walk you through it."
        : "Type the part name or vehicle details and I’ll find the best match."
    };
  }

  function buildModeChangedMessage(locale, mode) {
    if (locale === "ar-eg") {
      return {
        role: "assistant",
        text: mode === "fault_diagnosis"
          ? "تم التحويل لوضع تشخيص العطل. اكتب المشكلة الأساسية."
          : "تم التحويل لوضع بحث القطع. اكتب اسم القطعة أو بيانات العربية."
      };
    }

    return {
      role: "assistant",
      text: mode === "fault_diagnosis"
        ? "Switched to fault diagnosis. Describe the main issue."
        : "Switched to parts search. Type the part or vehicle details."
    };
  }

  function getSavedVehicleLabel(locale, vehicle) {
    if (!vehicle) {
      return locale === "ar-eg" ? "عربيتك المسجلة" : "your saved vehicle";
    }

    return vehicle.label || [vehicle.brandName, vehicle.modelName, vehicle.year].filter(Boolean).join(" ");
  }

  function buildSavedVehicleChoiceMessage(locale, vehicle, choice) {
    const vehicleLabel = getSavedVehicleLabel(locale, vehicle);

    if (locale === "ar-eg") {
      return {
        role: "assistant",
        text: choice === "yes"
          ? `تمام، هعتمد على عربيتك المسجلة: ${vehicleLabel}. ابعتلي اسم القطعة وأنا أدور لك عليها مباشرة.`
          : "أكيد. ابعتلي نوع العربية والموديل والسنة مع اسم القطعة، وأنا أتعامل عليها مباشرة."
      };
    }

    return {
      role: "assistant",
      text: choice === "yes"
        ? `Got it. I’ll use your saved vehicle: ${vehicleLabel}. Send the part name and I’ll search directly.`
        : "Sure. Send the car brand, model, and year with the part name and I’ll search directly."
    };
  }

  function renderSavedVehiclePrompt(locale, vehicle) {
    if (!vehicle) {
      return "";
    }

    const question = locale === "ar-eg"
      ? `هل تريد البحث عن قطع لسيارتك المسجلة: ${escapeHtml(getSavedVehicleLabel(locale, vehicle))}؟`
      : `Do you want to search parts for your saved car: ${escapeHtml(getSavedVehicleLabel(locale, vehicle))}?`;

    return `
      <section class="site-assistant__vehicle-prompt">
        <p>${question}</p>
        <div class="site-assistant__vehicle-prompt-actions">
          <button type="button" class="site-assistant__vehicle-choice" data-assistant-profile-vehicle="yes">
            ${locale === "ar-eg" ? "نعم" : "Yes"}
          </button>
          <button type="button" class="site-assistant__vehicle-choice site-assistant__vehicle-choice--ghost" data-assistant-profile-vehicle="no">
            ${locale === "ar-eg" ? "لا" : "No"}
          </button>
        </div>
      </section>
    `;
  }

  function renderAssistantCards(parts = [], locale) {
    if (!parts.length) {
      return "";
    }

    return `
      <div class="site-assistant__cards">
        ${parts.map((part) => `
          <article class="site-assistant__part-card">
            <div class="site-assistant__part-media">
              <img src="${escapeHtml(part.image)}" alt="${escapeHtml(part.name)}" onerror="this.src='./pictures/autofix logo.png'">
            </div>
            <div class="site-assistant__part-body">
              <span class="site-assistant__part-type">${escapeHtml(part.type)}</span>
              <h4>${escapeHtml(part.name)}</h4>
              <p>${escapeHtml(part.brand?.name || "")}${part.vehicle?.year ? ` · ${escapeHtml(part.vehicle.name)} ${part.vehicle.year}` : ""}</p>
              <div class="site-assistant__part-row">
                <strong>${formatPrice(part.price)}</strong>
                <span>${locale === "ar-eg" ? "تقييم" : "Rating"} ${Number(part.rating || 0).toFixed(1)}</span>
              </div>
              <button class="site-assistant__part-action" type="button" data-assistant-open-part="${part.id}">
                ${locale === "ar-eg" ? "افتح القطعة" : "Open part"}
              </button>
            </div>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderVerificationCard(verification = null, locale) {
    if (!verification) {
      return "";
    }

    const status = String(verification.status || "unverified").toLowerCase();
    const part = verification.part || null;
    const isArabic = locale === "ar-eg";
    const title = isArabic
      ? status === "valid"
        ? "السيريال أصلي"
        : status === "suspicious"
          ? "السيريال محتاج مراجعة"
          : "السيريال غير مؤكد"
      : status === "valid"
        ? "Serial verified"
        : status === "suspicious"
          ? "Serial needs review"
          : "Serial not confirmed";
    const dealerName = part?.dealer?.name || verification.sellerName || "";

    return `
      <article class="site-assistant__verify-card site-assistant__verify-card--${escapeHtml(status)}">
        <div class="site-assistant__verify-head">
          <span>${escapeHtml(status.toUpperCase())}</span>
          <strong>${escapeHtml(title)}</strong>
        </div>
        ${verification.registryMessage ? `<p>${escapeHtml(verification.registryMessage)}</p>` : ""}
        <dl>
          <div>
            <dt>${isArabic ? "السيريال" : "Serial"}</dt>
            <dd>${escapeHtml(verification.serialNumber || "")}</dd>
          </div>
          ${part ? `
            <div>
              <dt>${isArabic ? "القطعة" : "Part"}</dt>
              <dd>${escapeHtml(part.name || "")}</dd>
            </div>
          ` : ""}
          ${part ? `
            <div>
              <dt>${isArabic ? "السعر" : "Price"}</dt>
              <dd>${formatPrice(part.price)}</dd>
            </div>
          ` : ""}
          ${dealerName ? `
            <div>
              <dt>${isArabic ? "التوكيل" : "Dealer"}</dt>
              <dd>${escapeHtml(dealerName)}</dd>
            </div>
          ` : ""}
        </dl>
        ${verification.recommendation ? `<p class="site-assistant__verify-note">${escapeHtml(verification.recommendation)}</p>` : ""}
      </article>
    `;
  }

  function renderDiagnosisInsights(meta = {}, locale) {
    const issues = Array.isArray(meta.data?.likelyIssues) ? meta.data.likelyIssues : [];
    const nextSteps = Array.isArray(meta.data?.nextSteps) ? meta.data.nextSteps : [];

    if (!issues.length && !nextSteps.length) {
      return "";
    }

    return `
      <div class="site-assistant__insights">
        ${issues.length ? `
          <section class="site-assistant__insight-block">
            <h4>${locale === "ar-eg" ? "أقرب الأسباب" : "Likely issues"}</h4>
            <ul>
              ${issues.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </section>
        ` : ""}
        ${nextSteps.length ? `
          <section class="site-assistant__insight-block">
            <h4>${locale === "ar-eg" ? "الخطوات المقترحة" : "Recommended next steps"}</h4>
            <ul>
              ${nextSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </section>
        ` : ""}
      </div>
    `;
  }

  function renderMessage(message, locale) {
    const isAssistant = message.role === "assistant";
    const meta = message.meta || {};
    const text = normalizeDisplayText(message.text, locale);
    const cardsMarkup = isAssistant ? renderAssistantCards(meta.data?.parts || [], locale) : "";
    const verificationMarkup = isAssistant ? renderVerificationCard(meta.data?.serialVerification || null, locale) : "";
    const bubbleMarkup = text || !isAssistant
      ? `
        <div class="site-assistant__bubble">
          ${text ? `<p>${escapeHtml(text)}</p>` : ""}
        </div>
      `
      : "";

    if (isAssistant) {
      const stackMarkup = [bubbleMarkup, verificationMarkup, cardsMarkup].filter(Boolean).join("");
      return `
        <article class="site-assistant__message site-assistant__message--assistant"><div class="site-assistant__assistant-stack">${stackMarkup}</div></article>
      `;
    }

    return `
      <article class="site-assistant__message site-assistant__message--user">${bubbleMarkup}</article>
    `;
  }

  function openPartFromAssistant(part, context) {
    if (!part?.id || !part?.slug) {
      return;
    }

    localStorage.setItem("selectedPartId", String(part.id));
    localStorage.setItem("selectedPartSlug", part.slug);

    if (part.brand?.key) {
      localStorage.setItem("selectedBrand", part.brand.key);
    }

    if (part.vehicle?.key) {
      localStorage.setItem("selectedModel", part.vehicle.key);
      localStorage.setItem("selectedModelName", part.vehicle.name || part.vehicle.key);
    }

    if (part.vehicle?.year) {
      localStorage.setItem("selectedYear", String(part.vehicle.year));
    }

    if (part.dealer?.id) {
      localStorage.setItem("selectedDealerId", String(part.dealer.id));
    }

    if (part.dealer?.slug) {
      localStorage.setItem("selectedDealerSlug", part.dealer.slug);
    }

    if (part.dealer?.name) {
      localStorage.setItem("selectedDealerName", part.dealer.name);
    }

    localStorage.setItem(CONTEXT_SCOPE_KEY, context.scope === "dealer" ? "dealer" : "marketplace");
    window.location.href = "product.html";
  }

  function createAssistantInstance({ root, closeAssistant }) {
    const initialStorageKey = getViewerStorageKey();
    const stored = getStoredState(initialStorageKey);

    const state = {
      viewerStorageKey: initialStorageKey,
      locale: normalizeLocale(stored.locale || "ar-eg"),
      mode: normalizeMode(stored.mode || "parts_search"),
      bootstrap: null,
      historyMap: stored.historyMap || {},
      vehiclePromptMemory: stored.vehiclePromptMemory || null,
      hydratedKeys: {},
      composerValue: "",
      loading: true,
      sending: false,
      error: "",
      context: getCurrentContext(),
      partsVehicleChoice: "none"
    };

    function hydrateScopedState(viewerStorageKey) {
      const scopedState = getStoredState(viewerStorageKey);
      state.viewerStorageKey = viewerStorageKey;
      state.locale = normalizeLocale(scopedState.locale || state.locale || "ar-eg");
      state.mode = normalizeMode(scopedState.mode || state.mode || "parts_search");
      state.historyMap = scopedState.historyMap || {};
      state.vehiclePromptMemory = scopedState.vehiclePromptMemory || null;
      state.hydratedKeys = {};
    }

    function syncViewerScope() {
      const nextStorageKey = getViewerStorageKey();
      if (nextStorageKey === state.viewerStorageKey) {
        return false;
      }

      hydrateScopedState(nextStorageKey);
      return true;
    }

    function persistState() {
      saveStoredState({
        locale: state.locale,
        mode: state.mode,
        historyMap: state.historyMap,
        vehiclePromptMemory: state.vehiclePromptMemory
      }, state.viewerStorageKey);
    }

    function getCurrentMessages() {
      return state.historyMap[historyKey(state.locale, state.mode)] || [];
    }

    function getSavedVehicle() {
      return state.bootstrap?.viewer?.savedVehicle || null;
    }

    function getSavedVehicleMemoryKey(vehicle) {
      return String(vehicle?.vehicleYearId || `${vehicle?.brandKey || ""}:${vehicle?.modelKey || ""}:${vehicle?.year || ""}`);
    }

    function getRecentSavedVehicleChoice(vehicle) {
      const memory = state.vehiclePromptMemory;
      if (!vehicle || !memory) {
        return null;
      }

      if (memory.vehicleKey !== getSavedVehicleMemoryKey(vehicle)) {
        return null;
      }

      const answeredAt = Number(memory.answeredAt || 0);
      if (!answeredAt || Date.now() - answeredAt > SAVED_VEHICLE_PROMPT_TTL_MS) {
        return null;
      }

      return memory.choice === "no" ? "no" : "yes";
    }

    function rememberSavedVehicleChoice(vehicle, choice) {
      if (!vehicle) {
        return;
      }

      state.vehiclePromptMemory = {
        vehicleKey: getSavedVehicleMemoryKey(vehicle),
        choice: choice === "no" ? "no" : "yes",
        answeredAt: Date.now()
      };
      persistState();
    }

    function resolvePartsVehicleChoice() {
      const savedVehicle = getSavedVehicle();
      if (state.mode !== "parts_search" || !savedVehicle) {
        return "none";
      }

      const recentChoice = getRecentSavedVehicleChoice(savedVehicle);
      return recentChoice || "pending";
    }

    function shouldPromptForSavedVehicle() {
      return state.mode === "parts_search" && Boolean(getSavedVehicle()) && state.partsVehicleChoice === "pending";
    }

    function messageMentionsDifferentVehicle(message, savedVehicle) {
      if (!savedVehicle) {
        return false;
      }

      const normalizedMessage = normalizeLooseText(message);
      if (!normalizedMessage) {
        return false;
      }

      const savedBrandKey = String(savedVehicle.brandKey || "").trim().toLowerCase();
      const savedYear = Number(savedVehicle.year || 0) || null;

      for (const [brandKey, aliases] of Object.entries(BRAND_ALIASES)) {
        if (aliases.some((alias) => hasLooseMatch(normalizedMessage, alias))) {
          return brandKey !== savedBrandKey;
        }
      }

      const yearMatch = normalizedMessage.match(/\b20\d{2}\b/);
      if (yearMatch && savedYear && Number(yearMatch[0]) !== savedYear) {
        return true;
      }

      return false;
    }

    function buildEffectiveContext(messageText = "") {
      const baseContext = getCurrentContext();
      const savedVehicle = getSavedVehicle();

      if (state.mode === "parts_search" && savedVehicle && messageMentionsDifferentVehicle(messageText, savedVehicle)) {
        return {
          ...baseContext,
          brandKey: "",
          modelKey: "",
          modelName: "",
          year: null,
          dealerId: null,
          dealerSlug: "",
          dealerName: "",
          vehicleLabel: ""
        };
      }

      if (state.mode === "parts_search" && savedVehicle && state.partsVehicleChoice !== "no") {
        return {
          ...baseContext,
          brandKey: savedVehicle.brandKey,
          modelKey: savedVehicle.modelKey,
          modelName: savedVehicle.modelName,
          vehicleName: savedVehicle.modelName,
          year: savedVehicle.year
        };
      }

      return baseContext;
    }

    function setCurrentMessages(messages) {
      state.historyMap[historyKey(state.locale, state.mode)] = messages.slice(-MAX_HISTORY_MESSAGES);
      persistState();
    }

    function getBootstrapHistory() {
      const history = Array.isArray(state.bootstrap?.history) ? state.bootstrap.history : [];
      return history.filter((entry) => {
        const localeMatches = !entry.locale || entry.locale === state.locale;
        const modeMatches = !entry.mode || entry.mode === state.mode;
        return localeMatches && modeMatches;
      });
    }

    async function hydrateServerHistory() {
      const viewer = state.bootstrap?.viewer;
      const key = historyKey(state.locale, state.mode);
      if (!viewer || state.hydratedKeys[key]) {
        return;
      }

      state.hydratedKeys[key] = true;

      try {
        const data = await window.AutoFixAuth.apiFetch(
          `/assistant/history?locale=${encodeURIComponent(state.locale)}&mode=${encodeURIComponent(state.mode)}`
        );

        const serverMessages = mapHistoryRows(data || []);
        if (serverMessages.length) {
          setCurrentMessages(serverMessages);
          render();
          return;
        }
      } catch {
        // Keep local history fallback.
      }

      const fallbackHistory = mapHistoryRows(getBootstrapHistory());
      if (fallbackHistory.length && !getCurrentMessages().length) {
        setCurrentMessages(fallbackHistory);
        render();
      }
    }

    async function loadBootstrap() {
      syncViewerScope();
      state.loading = true;
      state.error = "";
      render();

      try {
        const data = await window.AutoFixAuth.apiFetch("/assistant/bootstrap");
        state.bootstrap = data;
        state.partsVehicleChoice = resolvePartsVehicleChoice();

        if (!getCurrentMessages().length) {
          const bootstrapMessages = mapHistoryRows(getBootstrapHistory());
          setCurrentMessages(
            bootstrapMessages.length
              ? bootstrapMessages
              : [buildDefaultAssistantMessage(state.locale, state.mode)]
          );
        }

        state.loading = false;
        render();
        hydrateServerHistory();
      } catch {
        state.loading = false;
        state.error = state.locale === "ar-eg"
          ? "المساعد غير متاح حاليًا. جرّب ريفرش أو شغّل الـ stack من جديد."
          : "The assistant is unavailable right now. Refresh or restart the local stack.";
        render();
      }
    }

    async function sendMessage(rawText) {
      syncViewerScope();
      const message = String(rawText || "").trim();
      if (!message || !state.bootstrap || state.sending) {
        return;
      }

      state.partsVehicleChoice = resolvePartsVehicleChoice();
      if (shouldPromptForSavedVehicle()) {
        state.composerValue = message;
        render();
        return;
      }

      const optimisticMessages = [
        ...getCurrentMessages(),
        {
          role: "user",
          text: message,
          createdAt: new Date().toISOString()
        }
      ];

      setCurrentMessages(optimisticMessages);
      state.composerValue = "";
      state.sending = true;
      render();

      try {
        const data = await window.AutoFixAuth.apiFetch("/assistant/chat", {
          method: "POST",
          body: JSON.stringify({
            locale: state.locale,
            mode: state.mode,
            message,
            context: buildEffectiveContext(message),
            history: normalizeMessageHistory(optimisticMessages)
          })
        });

        setCurrentMessages([
          ...optimisticMessages,
          {
            role: "assistant",
            text: data.reply,
            createdAt: new Date().toISOString(),
            meta: {
              provider: data.provider,
              liveModel: data.liveModel,
              status: data.status,
              suggestedAction: data.suggestedAction,
              intent: data.intent,
              data: data.data || {}
            }
          }
        ]);
      } catch (error) {
        setCurrentMessages([
          ...optimisticMessages,
          {
            role: "assistant",
            text: state.locale === "ar-eg"
              ? `حصلت مشكلة في الرد: ${error.message || "جرّب مرة تانية."}`
              : `Something went wrong: ${error.message || "Please try again."}`
          }
        ]);
      } finally {
        state.sending = false;
        render();
      }
    }

    function switchMode(nextMode) {
      const normalized = normalizeMode(nextMode);
      if (state.mode === normalized) {
        return;
      }

      state.mode = normalized;
      state.partsVehicleChoice = normalized === "parts_search" ? resolvePartsVehicleChoice() : "none";
      state.composerValue = "";

      const existingMessages = getCurrentMessages();
      if (!existingMessages.length) {
        setCurrentMessages([buildModeChangedMessage(state.locale, state.mode)]);
      } else {
        setCurrentMessages([
          ...existingMessages,
          buildModeChangedMessage(state.locale, state.mode)
        ]);
      }

      persistState();
      render();
      hydrateServerHistory();
    }

    function render() {
      state.context = buildEffectiveContext();

      const locale = state.locale;
      const direction = getDirection(locale);
      const messages = getCurrentMessages();
      const savedVehicle = getSavedVehicle();
      const promptMarkup = shouldPromptForSavedVehicle() ? renderSavedVehiclePrompt(locale, savedVehicle) : "";

      root.setAttribute("dir", direction);
      root.innerHTML = `
        <div class="site-assistant__shell ${locale === "ar-eg" ? "is-ar" : ""}">
          ${state.loading ? `
            <div class="site-assistant__loading-card">
              <h3>${locale === "ar-eg" ? "المساعد بيجهز" : "Preparing assistant"}</h3>
              <p>${locale === "ar-eg" ? "بنجهز المحادثة الحالية." : "Preparing the current conversation."}</p>
            </div>
          ` : state.error ? `
            <div class="site-assistant__loading-card site-assistant__loading-card--error">
              <h3>${locale === "ar-eg" ? "المساعد مش جاهز" : "Assistant unavailable"}</h3>
              <p>${escapeHtml(state.error)}</p>
            </div>
          ` : `
            <div class="site-assistant__intro">
              <div class="site-assistant__topbar site-assistant__topbar--compact">
                <div class="site-assistant__toolbar-group site-assistant__toolbar-group--language">
                  <div class="site-assistant__segment">
                    ${LOCALES.map((item) => `
                      <button
                        class="site-assistant__segment-btn ${locale === item.code ? "is-active" : ""}"
                        type="button"
                        data-assistant-locale="${item.code}"
                      >
                        ${item.label}
                      </button>
                    `).join("")}
                  </div>
                </div>
              </div>
              ${promptMarkup}
            </div>
            <div class="site-assistant__messages site-assistant__messages--panel">
              ${messages.length
                ? messages.map((message) => renderMessage(message, locale)).join("")
                : `<div class="site-assistant__empty">${locale === "ar-eg" ? "ابدأ برسالة جديدة." : "Start with a new message."}</div>`}
            </div>

            <div class="site-assistant__mode-dock site-assistant__mode-dock--compact">
              <div class="site-assistant__mode-grid">
                ${MODES.map((item) => `
                  <button
                    class="site-assistant__mode-pill ${state.mode === item.key ? "is-active" : ""}"
                    type="button"
                    data-assistant-mode="${item.key}"
                  >
                    ${item.label[locale]}
                  </button>
                `).join("")}
              </div>
            </div>

            <form class="site-assistant__composer" id="siteAssistantComposer">
              <div class="site-assistant__composer-row">
                <textarea
                  class="site-assistant__textarea"
                  id="siteAssistantTextarea"
                  rows="1"
                  placeholder="${locale === "ar-eg"
                    ? state.mode === "fault_diagnosis"
                      ? "اكتب المشكلة الأساسية..."
                      : state.partsVehicleChoice !== "no" && savedVehicle
                        ? `اكتب اسم القطعة لـ ${escapeHtml(getSavedVehicleLabel(locale, savedVehicle))}...`
                      : "اكتب اسم القطعة أو العربية..."
                    : state.mode === "fault_diagnosis"
                      ? "Describe the main issue..."
                      : state.partsVehicleChoice !== "no" && savedVehicle
                        ? `Type the part name for ${escapeHtml(getSavedVehicleLabel(locale, savedVehicle))}...`
                      : "Type a part or vehicle request..."}"
                >${escapeHtml(state.composerValue)}</textarea>

                <button
                  class="site-assistant__send site-assistant__send--icon"
                  type="submit"
                  aria-label="${locale === "ar-eg" ? "إرسال" : "Send"}"
                  title="${locale === "ar-eg" ? "إرسال" : "Send"}"
                  ${state.sending ? "disabled" : ""}
                >
                  ${state.sending ? "..." : "➜"}
                </button>
              </div>
            </form>
          `}
        </div>
      `;

      const messagesScroller = root.querySelector(".site-assistant__messages");
      if (messagesScroller) {
        messagesScroller.scrollTop = messagesScroller.scrollHeight;
      }

      const textarea = root.querySelector("#siteAssistantTextarea");
      if (textarea) {
        textarea.addEventListener("input", (event) => {
          state.composerValue = event.currentTarget.value;
        });

        textarea.addEventListener("keydown", (event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage(event.currentTarget.value);
          }
        });
      }
    }

    root.addEventListener("click", (event) => {
      const localeButton = event.target.closest("[data-assistant-locale]");
      if (localeButton) {
        state.locale = normalizeLocale(localeButton.dataset.assistantLocale);
        persistState();
        if (!getCurrentMessages().length) {
          setCurrentMessages([buildDefaultAssistantMessage(state.locale, state.mode)]);
        }
        render();
        hydrateServerHistory();
        return;
      }

      const modeButton = event.target.closest("[data-assistant-mode]");
      if (modeButton) {
        switchMode(modeButton.dataset.assistantMode);
        return;
      }

      const profileVehicleButton = event.target.closest("[data-assistant-profile-vehicle]");
      if (profileVehicleButton) {
        const choice = profileVehicleButton.dataset.assistantProfileVehicle === "yes" ? "yes" : "no";
        state.partsVehicleChoice = choice;
        rememberSavedVehicleChoice(getSavedVehicle(), choice);
        setCurrentMessages([
          ...getCurrentMessages(),
          buildSavedVehicleChoiceMessage(state.locale, getSavedVehicle(), choice)
        ]);
        render();
        return;
      }

      const partButton = event.target.closest("[data-assistant-open-part]");
      if (partButton) {
        const partId = Number(partButton.dataset.assistantOpenPart || 0);
        const assistantMessage = getCurrentMessages()
          .slice()
          .reverse()
          .find((message) => message.role === "assistant" && Array.isArray(message.meta?.data?.parts));

        const part = assistantMessage?.meta?.data?.parts?.find((item) => Number(item.id) === partId);
        if (part) {
          closeAssistant();
          openPartFromAssistant(part, state.context);
        }
      }
    });

    root.addEventListener("submit", (event) => {
      if (event.target.id === "siteAssistantComposer") {
        event.preventDefault();
        const textarea = root.querySelector("#siteAssistantTextarea");
        sendMessage(textarea?.value || state.composerValue);
      }
    });

    loadBootstrap();

    return {
      refresh() {
        state.context = getCurrentContext();
        loadBootstrap();
      }
    };
  }

  window.AutoFixAssistantBoot = function bootAssistant({ root, closeAssistant }) {
    if (!root) {
      return null;
    }

    if (!root.__autofixAssistantInstance) {
      root.__autofixAssistantInstance = createAssistantInstance({ root, closeAssistant });
    }

    return root.__autofixAssistantInstance;
  };
})();
