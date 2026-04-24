(function () {
  const authApi = window.AutoFixAuth;
  const catalogApi = window.AutoFixCatalogApi;

  if (!authApi?.apiFetch || !catalogApi) {
    return;
  }

  const ORDER_STATUS_OPTIONS = [
    { value: "new", label: "New" },
    { value: "pending", label: "Pending" },
    { value: "preparing", label: "Preparing" },
    { value: "shipped", label: "Shipped" },
    { value: "delivered", label: "Delivered" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" }
  ];

  const MOVEMENT_TYPE_LABELS = {
    manual_adjustment: "Manual adjustment",
    import: "Import",
    sale: "Sale",
    restock: "Restock",
    correction: "Correction"
  };

  const SUPPORT_STATUS_OPTIONS = [
    { value: "open", label: "Open" },
    { value: "in_progress", label: "In progress" },
    { value: "resolved", label: "Resolved" }
  ];

  const state = {
    dashboard: null,
    activeTab: "overview",
    inventorySearch: "",
    inventoryBrandKey: "",
    inventoryModelKey: "",
    inventoryYear: "",
    selectedOrderKey: "",
    selectedDealerId: "",
    selectedProductId: null,
    selectedOfferId: null,
    selectedCouponId: null,
    selectedShippingId: null,
    selectedStaffUserId: null,
    productDraftBrand: "",
    modelCache: new Map(),
    yearCache: new Map()
  };

  const initialPreviewDealerId = String(new URLSearchParams(window.location.search).get("dealerId") || "").trim();

  const elements = {
    heroTitle: document.getElementById("dealerHeroTitle"),
    heroDescription: document.getElementById("dealerHeroDescription"),
    heroPills: document.getElementById("dealerHeroPills"),
    refreshBtn: document.getElementById("dealerRefreshBtn"),
    scopeHeading: document.getElementById("dealerScopeHeading"),
    scopeDescription: document.getElementById("dealerScopeDescription"),
    switchField: document.getElementById("dealerSwitchField"),
    switchSelect: document.getElementById("dealerSwitch"),
    resetProductBtn: document.getElementById("dealerResetProductBtn"),
    tabbar: document.getElementById("dealerTabbar"),
    kpis: document.getElementById("dealerKpis"),
    sectionNodes: Array.from(document.querySelectorAll(".dealer-section")),
    productsSection: document.getElementById("products"),
    productsMain: document.querySelector(".dealer-products-main"),
    editorRail: document.getElementById("dealerProductEditorRail"),
    editorPanel: document.getElementById("dealerProductEditorPanel"),
    editorCard: document.querySelector(".dealer-product-editor-card"),
    overviewNotifications: document.getElementById("dealerOverviewNotifications"),
    inventoryMovements: document.getElementById("dealerInventoryMovements"),
    analyticsHighlights: document.getElementById("dealerAnalyticsHighlights"),
    lowStockList: document.getElementById("dealerLowStockList"),
    inventorySearch: document.getElementById("dealerInventorySearch"),
    inventoryBrandFilter: document.getElementById("dealerInventoryBrandFilter"),
    inventoryModelFilter: document.getElementById("dealerInventoryModelFilter"),
    inventoryYearFilter: document.getElementById("dealerInventoryYearFilter"),
    inventoryCount: document.getElementById("dealerInventoryCount"),
    inventoryList: document.getElementById("dealerInventoryList"),
    productFormTitle: document.getElementById("dealerProductFormTitle"),
    productForm: document.getElementById("dealerProductForm"),
    productId: document.getElementById("dealerProductId"),
    productName: document.getElementById("dealerProductName"),
    productPartNumber: document.getElementById("dealerProductPartNumber"),
    productBrand: document.getElementById("dealerProductBrand"),
    productCategory: document.getElementById("dealerProductCategory"),
    productType: document.getElementById("dealerProductType"),
    productPrice: document.getElementById("dealerProductPrice"),
    productStock: document.getElementById("dealerProductStock"),
    productManufacturer: document.getElementById("dealerProductManufacturer"),
    productWarranty: document.getElementById("dealerProductWarranty"),
    productSerial: document.getElementById("dealerProductSerial"),
    productDescription: document.getElementById("dealerProductDescription"),
    productImages: document.getElementById("dealerProductImages"),
    productSpecs: document.getElementById("dealerProductSpecs"),
    fitmentRows: document.getElementById("dealerFitmentRows"),
    addFitmentBtn: document.getElementById("dealerAddFitmentBtn"),
    productResetBtn: document.getElementById("dealerProductResetBtn"),
    productArchiveBtn: document.getElementById("dealerProductArchiveBtn"),
    productDeleteBtn: document.getElementById("dealerProductDeleteBtn"),
    stockForm: document.getElementById("dealerStockForm"),
    stockPart: document.getElementById("dealerStockPart"),
    stockType: document.getElementById("dealerStockType"),
    stockDelta: document.getElementById("dealerStockDelta"),
    stockReplace: document.getElementById("dealerStockReplace"),
    stockUnitCost: document.getElementById("dealerStockUnitCost"),
    stockNote: document.getElementById("dealerStockNote"),
    importForm: document.getElementById("dealerImportForm"),
    importMode: document.getElementById("dealerImportMode"),
    importRows: document.getElementById("dealerImportRows"),
    ordersBoard: document.getElementById("dealerOrdersBoard"),
    shippingSummary: document.getElementById("dealerShippingSummary"),
    offerForm: document.getElementById("dealerOfferForm"),
    offerId: document.getElementById("dealerOfferId"),
    offerTitle: document.getElementById("dealerOfferTitle"),
    offerScopeType: document.getElementById("dealerOfferScopeType"),
    offerPart: document.getElementById("dealerOfferPart"),
    offerCategory: document.getElementById("dealerOfferCategory"),
    offerDiscountType: document.getElementById("dealerOfferDiscountType"),
    offerDiscountValue: document.getElementById("dealerOfferDiscountValue"),
    offerStartsAt: document.getElementById("dealerOfferStartsAt"),
    offerEndsAt: document.getElementById("dealerOfferEndsAt"),
    offerDescription: document.getElementById("dealerOfferDescription"),
    offerActive: document.getElementById("dealerOfferActive"),
    offerResetBtn: document.getElementById("dealerOfferResetBtn"),
    offersList: document.getElementById("dealerOffersList"),
    couponForm: document.getElementById("dealerCouponForm"),
    couponId: document.getElementById("dealerCouponId"),
    couponCode: document.getElementById("dealerCouponCode"),
    couponTitle: document.getElementById("dealerCouponTitle"),
    couponDiscountType: document.getElementById("dealerCouponDiscountType"),
    couponDiscountValue: document.getElementById("dealerCouponDiscountValue"),
    couponMinimumOrderValue: document.getElementById("dealerCouponMinimumOrderValue"),
    couponUsageLimit: document.getElementById("dealerCouponUsageLimit"),
    couponStartsAt: document.getElementById("dealerCouponStartsAt"),
    couponEndsAt: document.getElementById("dealerCouponEndsAt"),
    couponDescription: document.getElementById("dealerCouponDescription"),
    couponTargets: document.getElementById("dealerCouponTargets"),
    couponActive: document.getElementById("dealerCouponActive"),
    couponResetBtn: document.getElementById("dealerCouponResetBtn"),
    couponsList: document.getElementById("dealerCouponsList"),
    customersList: document.getElementById("dealerCustomersList"),
    customerNotifyForm: document.getElementById("dealerCustomerNotifyForm"),
    customerNotifyTitle: document.getElementById("dealerCustomerNotifyTitle"),
    customerNotifyMessage: document.getElementById("dealerCustomerNotifyMessage"),
    customerTargets: document.getElementById("dealerCustomerTargets"),
    notificationsList: document.getElementById("dealerNotificationsList"),
    feedbackList: document.getElementById("dealerFeedbackList"),
    shippingForm: document.getElementById("dealerShippingForm"),
    shippingId: document.getElementById("dealerShippingId"),
    shippingCarrierName: document.getElementById("dealerShippingCarrierName"),
    shippingRegionName: document.getElementById("dealerShippingRegionName"),
    shippingBaseFee: document.getElementById("dealerShippingBaseFee"),
    shippingFeePerItem: document.getElementById("dealerShippingFeePerItem"),
    shippingMinDays: document.getElementById("dealerShippingMinDays"),
    shippingMaxDays: document.getElementById("dealerShippingMaxDays"),
    shippingActive: document.getElementById("dealerShippingActive"),
    shippingResetBtn: document.getElementById("dealerShippingResetBtn"),
    shippingMethodsList: document.getElementById("dealerShippingMethodsList"),
    staffForm: document.getElementById("dealerStaffForm"),
    staffUserId: document.getElementById("dealerStaffUserId"),
    staffEmail: document.getElementById("dealerStaffEmail"),
    staffBrands: document.getElementById("dealerStaffBrands"),
    staffPermissionInventory: document.getElementById("dealerStaffPermissionInventory"),
    staffPermissionOrders: document.getElementById("dealerStaffPermissionOrders"),
    staffPermissionVerification: document.getElementById("dealerStaffPermissionVerification"),
    staffPermissionAnalytics: document.getElementById("dealerStaffPermissionAnalytics"),
    staffStatus: document.getElementById("dealerStaffStatus"),
    staffResetBtn: document.getElementById("dealerStaffResetBtn"),
    staffList: document.getElementById("dealerStaffList"),
    profileForm: document.getElementById("dealerProfileForm"),
    profileName: document.getElementById("dealerProfileName"),
    profileLocation: document.getElementById("dealerProfileLocation"),
    profileEmail: document.getElementById("dealerProfileEmail"),
    profilePhone: document.getElementById("dealerProfilePhone"),
    profileDescription: document.getElementById("dealerProfileDescription"),
    supportForm: document.getElementById("dealerSupportForm"),
    supportSubject: document.getElementById("dealerSupportSubject"),
    supportPriority: document.getElementById("dealerSupportPriority"),
    supportMessage: document.getElementById("dealerSupportMessage"),
    supportTickets: document.getElementById("dealerSupportTickets"),
    helpArticles: document.getElementById("dealerHelpArticles")
  };

  const toastRoot = document.createElement("div");
  toastRoot.className = "dealer-toast-root";
  document.body.appendChild(toastRoot);

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatMoney(value) {
    return `${Number(value || 0).toLocaleString("en-US")} EGP`;
  }

  function formatDateTime(value) {
    if (!value) {
      return "—";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "—";
    }
    return date.toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function formatShortDate(value) {
    if (!value) {
      return "—";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "—";
    }
    return date.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function formatPercent(value) {
    return `${Number(value || 0).toLocaleString("en-US")} %`;
  }

  function formatPermissionLabel(value) {
    const labels = {
      inventory: "Inventory",
      orders: "Orders",
      verification: "Verification",
      analytics: "Analytics"
    };
    return labels[value] || value;
  }

  function showToast(message, type = "success") {
    if (window.AutoFixToast?.show) {
      window.AutoFixToast.show(message, { type });
      return;
    }

    const node = document.createElement("div");
    node.className = `dealer-toast dealer-toast--${type}`;
    node.textContent = message;
    toastRoot.appendChild(node);
    requestAnimationFrame(() => node.classList.add("is-visible"));
    window.setTimeout(() => {
      node.classList.remove("is-visible");
      window.setTimeout(() => node.remove(), 240);
    }, 2800);
  }

  function buildScopedPath(path) {
    const dealerId = state.dashboard?.dealerViewMode === "admin-preview"
      ? String(state.selectedDealerId || state.dashboard?.selectedDealerId || "")
      : "";

    if (!dealerId) {
      return path;
    }

    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}dealerId=${encodeURIComponent(dealerId)}`;
  }

  function buildScopedBody(body = {}) {
    const dealerId = state.dashboard?.dealerViewMode === "admin-preview"
      ? String(state.selectedDealerId || state.dashboard?.selectedDealerId || "")
      : "";

    if (!dealerId) {
      return body;
    }

    return {
      ...body,
      dealerId
    };
  }

  async function request(path, options = {}) {
    const method = options.method || "GET";
    const body = options.body !== undefined ? JSON.stringify(buildScopedBody(options.body)) : undefined;
    return authApi.apiFetch(buildScopedPath(path), {
      method,
      body
    });
  }

  function extractDashboard(payload) {
    return payload?.dashboard || payload;
  }

  function getBrands() {
    return state.dashboard?.activeDealer?.brands || [];
  }

  function getCategories() {
    return state.dashboard?.categories || [];
  }

  function getInventory() {
    return state.dashboard?.inventory || [];
  }

  function getOrders() {
    return state.dashboard?.orders || [];
  }

  function getOffers() {
    return state.dashboard?.offers || [];
  }

  function getCoupons() {
    return state.dashboard?.coupons || [];
  }

  function getCustomers() {
    return state.dashboard?.customers || [];
  }

  function getNotifications() {
    return state.dashboard?.notifications || [];
  }

  function getShippingMethods() {
    return state.dashboard?.shippingMethods || [];
  }

  function getSupportTickets() {
    return state.dashboard?.supportTickets || [];
  }

  function getHelpArticles() {
    return state.dashboard?.helpArticles || [];
  }

  function getFeedback() {
    return state.dashboard?.feedback || [];
  }

  function getStaff() {
    return state.dashboard?.staff || [];
  }

  function getPermissions() {
    return state.dashboard?.permissions || {};
  }

  function buildInventoryVehicleIndex() {
    const brands = new Map();
    const modelsByBrand = new Map();
    const yearsByBrandModel = new Map();

    getInventory().forEach((item) => {
      const brandKey = String(item.brand?.key || "").trim().toLowerCase();
      const brandName = item.brand?.name || brandKey;
      const fitments = Array.isArray(item.fitments) ? item.fitments : [];

      if (!brandKey || !fitments.length) {
        return;
      }

      if (!brands.has(brandKey)) {
        brands.set(brandKey, { value: brandKey, label: brandName });
      }

      fitments.forEach((fitment) => {
        const modelKey = String(fitment.modelKey || "").trim().toLowerCase();
        const modelName = fitment.modelName || modelKey;
        const yearValue = String(fitment.year || fitment.yearLabel || "").trim();
        if (!modelKey || !yearValue) {
          return;
        }

        if (!modelsByBrand.has(brandKey)) {
          modelsByBrand.set(brandKey, new Map());
        }

        if (!modelsByBrand.get(brandKey).has(modelKey)) {
          modelsByBrand.get(brandKey).set(modelKey, {
            value: modelKey,
            label: modelName
          });
        }

        const pairKey = `${brandKey}::${modelKey}`;
        if (!yearsByBrandModel.has(pairKey)) {
          yearsByBrandModel.set(pairKey, new Map());
        }

        if (!yearsByBrandModel.get(pairKey).has(yearValue)) {
          yearsByBrandModel.get(pairKey).set(yearValue, {
            value: yearValue,
            label: fitment.yearLabel || yearValue
          });
        }
      });
    });

    return {
      brands: Array.from(brands.values()).sort((left, right) => left.label.localeCompare(right.label)),
      modelsByBrand: new Map(
        Array.from(modelsByBrand.entries()).map(([brandKey, models]) => [
          brandKey,
          Array.from(models.values()).sort((left, right) => left.label.localeCompare(right.label))
        ])
      ),
      yearsByBrandModel: new Map(
        Array.from(yearsByBrandModel.entries()).map(([pairKey, years]) => [
          pairKey,
          Array.from(years.values()).sort((left, right) => Number(right.value) - Number(left.value))
        ])
      )
    };
  }

  function syncInventoryVehicleFilters(index) {
    const availableBrandKeys = new Set(index.brands.map((item) => item.value));
    if (state.inventoryBrandKey && !availableBrandKeys.has(state.inventoryBrandKey)) {
      state.inventoryBrandKey = "";
      state.inventoryModelKey = "";
      state.inventoryYear = "";
    }

    const availableModels = state.inventoryBrandKey
      ? index.modelsByBrand.get(state.inventoryBrandKey) || []
      : [];
    const availableModelKeys = new Set(availableModels.map((item) => item.value));
    if (state.inventoryModelKey && !availableModelKeys.has(state.inventoryModelKey)) {
      state.inventoryModelKey = "";
      state.inventoryYear = "";
    }

    const yearKey = `${state.inventoryBrandKey}::${state.inventoryModelKey}`;
    const availableYears = state.inventoryBrandKey && state.inventoryModelKey
      ? index.yearsByBrandModel.get(yearKey) || []
      : [];
    const availableYearValues = new Set(availableYears.map((item) => String(item.value)));
    if (state.inventoryYear && !availableYearValues.has(String(state.inventoryYear))) {
      state.inventoryYear = "";
    }

    populateSelect(elements.inventoryBrandFilter, index.brands, "All brands");
    elements.inventoryBrandFilter.value = state.inventoryBrandKey || "";

    populateSelect(elements.inventoryModelFilter, availableModels, "All models");
    elements.inventoryModelFilter.value = state.inventoryModelKey || "";
    elements.inventoryModelFilter.disabled = !state.inventoryBrandKey;

    populateSelect(elements.inventoryYearFilter, availableYears, "All years");
    elements.inventoryYearFilter.value = state.inventoryYear || "";
    elements.inventoryYearFilter.disabled = !(state.inventoryBrandKey && state.inventoryModelKey);
  }

  function matchesInventoryVehicle(item) {
    if (!state.inventoryBrandKey && !state.inventoryModelKey && !state.inventoryYear) {
      return true;
    }

    const fitments = Array.isArray(item.fitments) ? item.fitments : [];
    return fitments.some((fitment) => {
      const brandKey = String(item.brand?.key || "").trim().toLowerCase();
      const modelKey = String(fitment.modelKey || "").trim().toLowerCase();
      const yearValue = String(fitment.year || fitment.yearLabel || "");
      return (!state.inventoryBrandKey || brandKey === state.inventoryBrandKey)
        && (!state.inventoryModelKey || modelKey === state.inventoryModelKey)
        && (!state.inventoryYear || yearValue === String(state.inventoryYear));
    });
  }

  function summarizeInventoryFitment(item) {
    const fitments = Array.isArray(item.fitments) ? item.fitments : [];
    if (!fitments.length) {
      return item.fitmentSummary || "Fitment details available in product editor.";
    }

    const visibleFitments = fitments.filter((fitment) => {
      const brandKey = String(item.brand?.key || "").trim().toLowerCase();
      const modelKey = String(fitment.modelKey || "").trim().toLowerCase();
      const yearValue = String(fitment.year || fitment.yearLabel || "");
      return (!state.inventoryBrandKey || brandKey === state.inventoryBrandKey)
        && (!state.inventoryModelKey || modelKey === state.inventoryModelKey)
        && (!state.inventoryYear || yearValue === String(state.inventoryYear));
    });

    const list = visibleFitments.length ? visibleFitments : fitments;
    const [primary] = list;
    if (!primary) {
      return item.fitmentSummary || "Fitment details available in product editor.";
    }

    const baseLabel = `${primary.modelName || "Vehicle"} ${primary.yearLabel || primary.year || ""}`.trim();
    return list.length > 1
      ? `${baseLabel} +${list.length - 1} more fitments`
      : baseLabel;
  }

  function renderInventorySummary(filteredCount) {
    const parts = [];
    if (state.inventoryBrandKey) {
      parts.push(elements.inventoryBrandFilter?.selectedOptions?.[0]?.textContent || state.inventoryBrandKey);
    }
    if (state.inventoryModelKey) {
      parts.push(elements.inventoryModelFilter?.selectedOptions?.[0]?.textContent || state.inventoryModelKey);
    }
    if (state.inventoryYear) {
      parts.push(String(state.inventoryYear));
    }
    const scopeLabel = parts.length ? parts.join(" • ") : "All scoped vehicles";
    return `${filteredCount} product${filteredCount === 1 ? "" : "s"} for ${scopeLabel}`;
  }

  function getOrderKey(order) {
    return String(order?.id ?? order?.orderId ?? order?.orderNumber ?? "");
  }

  function hasPermission(key) {
    return Boolean(getPermissions()?.[key] || state.dashboard?.viewer?.dashboardAccess?.admin);
  }

  function renderEmpty(message) {
    return `<div class="dealer-empty">${escapeHtml(message)}</div>`;
  }

  function syncProductEditorPosition() {
    if (!elements.editorPanel || !elements.editorRail) {
      return;
    }

    if (window.innerWidth <= 860 || state.activeTab !== "products" || !elements.productsMain) {
      elements.editorRail.style.removeProperty("--dealer-editor-rail-height");
      elements.editorPanel.style.removeProperty("--dealer-editor-panel-height");
      return;
    }

    const mainHeight = Math.max(
      Math.round(elements.productsMain.getBoundingClientRect().height || 0),
      Math.round(window.innerHeight - 142)
    );

    elements.editorRail.style.setProperty("--dealer-editor-rail-height", `${mainHeight}px`);
    elements.editorPanel.style.setProperty("--dealer-editor-panel-height", `${mainHeight}px`);
  }

  function queueProductEditorPositionSync() {
    window.requestAnimationFrame(() => {
      syncProductEditorPosition();
    });
  }

  function setActiveTab(tabKey) {
    const visibleTabs = Array.from(elements.tabbar.querySelectorAll(".dealer-tab:not([hidden])")).map((button) => button.dataset.target);
    state.activeTab = visibleTabs.includes(tabKey) ? tabKey : (visibleTabs[0] || "overview");

    elements.tabbar.querySelectorAll(".dealer-tab").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.target === state.activeTab);
    });

    elements.sectionNodes.forEach((section) => {
      section.hidden = section.id !== state.activeTab;
    });

    queueProductEditorPositionSync();
  }

  function applyTabVisibility() {
    const permissionMap = {
      overview: true,
      products: hasPermission("inventory"),
      orders: hasPermission("orders"),
      promotions: hasPermission("discounts"),
      customers: hasPermission("customers") || hasPermission("notifications"),
      operations: hasPermission("profile") || hasPermission("support") || hasPermission("shipping") || hasPermission("staff")
    };

    elements.tabbar.querySelectorAll(".dealer-tab").forEach((button) => {
      button.hidden = !permissionMap[button.dataset.target];
    });

    setActiveTab(state.activeTab);
  }

  function renderHero() {
    const dealer = state.dashboard?.activeDealer;
    const overview = state.dashboard?.overview?.metrics || {};
    if (!dealer) {
      return;
    }

    elements.heroTitle.textContent = `${dealer.name} operational dashboard`;
    elements.heroDescription.textContent = `Manage scoped inventory, orders, offers, customer activity, shipping, staff access, and support workflows for ${dealer.name}.`;
    elements.heroPills.innerHTML = [
      `<span class="dealer-pill">${escapeHtml(dealer.location || "Egypt")}</span>`,
      `<span class="dealer-pill">${dealer.brands.length} covered brands</span>`,
      `<span class="dealer-pill">${overview.activeListings || 0} active listings</span>`,
      `<span class="dealer-pill">${overview.openOrders || 0} open orders</span>`
    ].join("");
  }

  function renderScope() {
    const dealer = state.dashboard?.activeDealer;
    const accessibleDealers = state.dashboard?.accessibleDealers || [];
    if (!dealer) {
      return;
    }

    elements.scopeHeading.textContent = state.dashboard?.dealerViewMode === "admin-preview"
      ? `Admin preview for ${dealer.name}`
      : `${dealer.name} scope is live`;

    const permissionLabels = Object.entries(getPermissions())
      .filter(([, enabled]) => enabled)
      .map(([key]) => formatPermissionLabel(key));

    elements.scopeDescription.textContent = `This dashboard is filtered to ${dealer.name} and ${dealer.brands.map((brand) => brand.name).join(", ")}. Active permissions: ${permissionLabels.join(", ") || "No permissions"}.`;

    if (state.dashboard?.dealerViewMode === "admin-preview" && accessibleDealers.length > 1) {
      elements.switchField.hidden = false;
      elements.switchSelect.innerHTML = accessibleDealers.map((item) => `
        <option value="${item.id}" ${String(item.id) === String(state.selectedDealerId || state.dashboard.selectedDealerId) ? "selected" : ""}>
          ${escapeHtml(item.name)} (${item.brands.map((brand) => brand.name).join(", ")})
        </option>
      `).join("");
    } else {
      elements.switchField.hidden = true;
      elements.switchSelect.innerHTML = "";
    }
  }

  function renderKpis() {
    const metrics = state.dashboard?.overview?.metrics;
    if (!metrics) {
      elements.kpis.innerHTML = "";
      return;
    }

    const cards = [
      {
        label: "Revenue",
        value: formatMoney(metrics.revenue),
        note: `${metrics.customersCount} customers served`
      },
      {
        label: "Listings",
        value: `${metrics.activeListings}`,
        note: `${metrics.archivedListings} archived · ${metrics.lowStockItems} low stock`
      },
      {
        label: "Orders",
        value: `${metrics.openOrders}`,
        note: `${metrics.shippedOrders} shipped · ${metrics.deliveredOrders} delivered`
      },
      {
        label: "Inventory units",
        value: `${metrics.stockUnits}`,
        note: `${metrics.incomingStock} incoming · ${metrics.soldUnits} sold`
      },
      {
        label: "Signals",
        value: `${metrics.unreadNotifications}`,
        note: `${metrics.unresolvedFeedback} feedback · ${metrics.openTickets} support`
      }
    ];

    elements.kpis.innerHTML = cards.map((card) => `
      <article class="dealer-kpi">
        <div class="dealer-kpi__label">${escapeHtml(card.label)}</div>
        <div class="dealer-kpi__value">${escapeHtml(card.value)}</div>
        <div class="dealer-kpi__note">${escapeHtml(card.note)}</div>
      </article>
    `).join("");
  }

  function renderOverview() {
    const notifications = getNotifications();
    const movements = state.dashboard?.inventoryMovements || [];
    const analytics = state.dashboard?.analytics || {};
    const lowStock = analytics.stockAlerts || [];

    elements.overviewNotifications.innerHTML = notifications.length
      ? notifications.slice(0, 6).map((item) => `
        <article class="dealer-notification">
          <div class="dealer-notification__top">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="dealer-badge ${item.isRead ? "" : "dealer-badge--warning"}">${item.isRead ? "Read" : "Unread"}</span>
          </div>
          <p>${escapeHtml(item.message)}</p>
          <div class="dealer-meta-list">
            <span class="dealer-meta-pill">${escapeHtml(item.notificationType)}</span>
            <span class="dealer-meta-pill">${escapeHtml(formatDateTime(item.createdAt))}</span>
            ${item.user ? `<span class="dealer-meta-pill">${escapeHtml(item.user.fullName)}</span>` : ""}
          </div>
        </article>
      `).join("")
      : renderEmpty("No notifications yet.");

    elements.inventoryMovements.innerHTML = movements.length
      ? movements.slice(0, 8).map((item) => `
        <article class="dealer-record">
          <div class="dealer-record__top">
            <strong>${escapeHtml(item.part.name)}</strong>
            <span class="dealer-badge ${item.quantityDelta < 0 ? "dealer-badge--danger" : "dealer-badge--success"}">
              ${item.quantityDelta > 0 ? "+" : ""}${item.quantityDelta}
            </span>
          </div>
          <p>${escapeHtml(MOVEMENT_TYPE_LABELS[item.movementType] || item.movementType)} · ${escapeHtml(item.note || "No note")}</p>
          <div class="dealer-meta-list">
            <span class="dealer-meta-pill">Stock ${item.part.stockQuantity}</span>
            ${item.actor ? `<span class="dealer-meta-pill">${escapeHtml(item.actor.fullName)}</span>` : ""}
            <span class="dealer-meta-pill">${escapeHtml(formatDateTime(item.createdAt))}</span>
          </div>
        </article>
      `).join("")
      : renderEmpty("Inventory movement history will appear here.");

    const topProducts = (analytics.topProducts || []).slice(0, 4);
    const categoryBreakdown = (analytics.categoryBreakdown || []).slice(0, 4);
    const orderPatterns = (analytics.orderPatterns || []).slice(0, 4);

    elements.analyticsHighlights.innerHTML = `
      <article class="dealer-stat-card">
        <strong>Top selling products</strong>
        ${topProducts.length ? `
          <div class="dealer-stack">
            ${topProducts.map((item) => `
              <div class="dealer-note">
                <strong>${escapeHtml(item.name)}</strong>
                <p>${item.unitsSold} units · ${formatMoney(item.revenue)}</p>
              </div>
            `).join("")}
          </div>
        ` : `<p class="dealer-muted">No sales trend yet.</p>`}
      </article>
      <article class="dealer-stat-card">
        <strong>Category breakdown</strong>
        ${categoryBreakdown.length ? `
          <div class="dealer-stack">
            ${categoryBreakdown.map((item) => `
              <div class="dealer-note">
                <strong>${escapeHtml(item.categoryName)}</strong>
                <p>${item.listingCount} listings · ${item.stockUnits} units in stock</p>
              </div>
            `).join("")}
          </div>
        ` : `<p class="dealer-muted">No category data yet.</p>`}
      </article>
      <article class="dealer-stat-card">
        <strong>Peak order windows</strong>
        ${orderPatterns.length ? `
          <div class="dealer-stack">
            ${orderPatterns.map((item) => `
              <div class="dealer-note">
                <strong>${String(item.hour).padStart(2, "0")}:00</strong>
                <p>${item.orders} orders captured</p>
              </div>
            `).join("")}
          </div>
        ` : `<p class="dealer-muted">Order time patterns will show after more orders arrive.</p>`}
      </article>
    `;

    elements.lowStockList.innerHTML = lowStock.length
      ? lowStock.map((item) => `
        <article class="dealer-record">
          <div class="dealer-record__top">
            <strong>${escapeHtml(item.name)}</strong>
            <span class="dealer-badge dealer-badge--warning">${item.stockQuantity} left</span>
          </div>
          <p>${escapeHtml(item.fitmentSummary || "Fitment details available in product editor.")}</p>
          <div class="dealer-meta-list">
            <span class="dealer-meta-pill">${escapeHtml(item.partNumber)}</span>
            <span class="dealer-meta-pill">${escapeHtml(item.brand.name)}</span>
            <button class="dealer-link-btn" type="button" data-action="edit-product" data-product-id="${item.id}">
              Edit product
            </button>
          </div>
        </article>
      `).join("")
      : renderEmpty("No low stock alerts right now.");
  }

  function renderInventory() {
    const vehicleIndex = buildInventoryVehicleIndex();
    syncInventoryVehicleFilters(vehicleIndex);

    const term = state.inventorySearch.trim().toLowerCase();
    const inventory = getInventory().filter((item) => {
      if (!matchesInventoryVehicle(item)) {
        return false;
      }
      if (!term) {
        return true;
      }
      const haystack = [
        item.name,
        item.partNumber,
        item.brand?.name,
        item.category?.name,
        item.manufacturerName,
        item.fitmentSummary,
        ...((item.fitments || []).map((fitment) => `${fitment.modelName || ""} ${fitment.year || ""}`))
      ].join(" ").toLowerCase();
      return haystack.includes(term);
    });

    if (elements.inventoryCount) {
      elements.inventoryCount.textContent = renderInventorySummary(inventory.length);
    }

    if (!inventory.length) {
      const hasVehicleFilter = Boolean(state.inventoryBrandKey || state.inventoryModelKey || state.inventoryYear);
      elements.inventoryList.innerHTML = renderEmpty(
        term
          ? "No products match this search."
          : hasVehicleFilter
            ? "No saved products match the selected vehicle."
            : "No products have been created in this dealer scope yet."
      );
      return;
    }

    elements.inventoryList.innerHTML = inventory.map((item) => `
      <article class="dealer-product-card">
        <div class="dealer-product-card__top">
          <img src="${escapeHtml(item.primaryImage)}" alt="${escapeHtml(item.name)}" />
          <div class="dealer-product-card__meta">
            <div class="dealer-record__top">
              <div>
                <strong>${escapeHtml(item.name)}</strong>
                <p>${escapeHtml(summarizeInventoryFitment(item))}</p>
              </div>
              <span class="dealer-badge ${item.lowStock ? "dealer-badge--warning" : "dealer-badge--success"}">
                ${item.stockQuantity} in stock
              </span>
            </div>
            <div class="dealer-meta-list">
              <span class="dealer-meta-pill">${escapeHtml(item.partNumber)}</span>
              <span class="dealer-meta-pill">${formatMoney(item.price)}</span>
              <span class="dealer-meta-pill">${escapeHtml(item.partType)}</span>
              ${item.category ? `<span class="dealer-meta-pill">${escapeHtml(item.category.name)}</span>` : ""}
              ${!item.active ? `<span class="dealer-badge dealer-badge--danger">Archived</span>` : ""}
            </div>
            ${item.manufacturerName ? `<p class="dealer-muted">${escapeHtml(item.manufacturerName)}</p>` : ""}
          </div>
        </div>
        <div class="dealer-product-card__actions">
          <button class="dealer-btn dealer-btn--ghost" type="button" data-action="edit-product" data-product-id="${item.id}">Edit</button>
          <button class="dealer-btn dealer-btn--ghost" type="button" data-action="restock-product" data-product-id="${item.id}">Adjust stock</button>
          <button class="dealer-btn dealer-btn--danger" type="button" data-action="archive-product" data-product-id="${item.id}">
            ${item.active ? "Archive" : "Restore"}
          </button>
          <button class="dealer-btn dealer-btn--outline" type="button" data-action="delete-product" data-product-id="${item.id}">Delete</button>
        </div>
      </article>
    `).join("");
  }

  function renderOrders() {
    const orders = getOrders();
    const validOrderKeys = new Set(orders.map((order) => getOrderKey(order)));
    if (state.selectedOrderKey && !validOrderKeys.has(state.selectedOrderKey)) {
      state.selectedOrderKey = "";
    }
    if (!orders.length) {
      elements.ordersBoard.innerHTML = renderEmpty("No routed orders have reached this dealer yet.");
    } else {
      elements.ordersBoard.innerHTML = orders.map((order, index) => {
        const orderKey = getOrderKey(order);
        const isExpanded = state.selectedOrderKey === orderKey;
        return `
        <article class="dealer-order ${isExpanded ? "is-expanded" : ""}">
          <div class="dealer-order__top">
            <div>
              <strong>${escapeHtml(`Order #${index + 1}`)}</strong>
              <p>${escapeHtml(order.customer.fullName)} · ${escapeHtml(order.customer.city || "No city")} · ${escapeHtml(order.customer.addressLine || "No address")}</p>
            </div>
            <div class="dealer-inline-actions">
              <span class="dealer-badge">${escapeHtml(order.status)}</span>
              <span class="dealer-meta-pill">${escapeHtml(order.fulfillmentMethod || "Delivery")}</span>
              <span class="dealer-meta-pill">${escapeHtml(order.paymentMethod || "Cash")}</span>
              <button class="dealer-btn dealer-btn--ghost" type="button" data-action="${isExpanded ? "collapse-order" : "select-order"}" data-order-key="${escapeHtml(orderKey)}">
                ${isExpanded ? "Hide details" : "Open order"}
              </button>
            </div>
          </div>
          <div class="dealer-meta-list">
            <span class="dealer-meta-pill">${escapeHtml(order.orderNumber)}</span>
            <span class="dealer-meta-pill">${formatMoney(order.totalAmount)}</span>
            <span class="dealer-meta-pill">Subtotal ${formatMoney(order.subtotal)}</span>
            <span class="dealer-meta-pill">Shipping ${formatMoney(order.shippingFee)}</span>
            ${order.couponCode ? `<span class="dealer-meta-pill">Coupon ${escapeHtml(order.couponCode)}</span>` : ""}
            <span class="dealer-meta-pill">${escapeHtml(formatDateTime(order.createdAt))}</span>
          </div>
          ${isExpanded ? order.items.map((item) => `
            <div class="dealer-order-item" data-order-item-id="${item.orderItemId}">
              <div class="dealer-order-item__grid">
                <div>
                  <strong>${escapeHtml(item.part.name)}</strong>
                  <p>${escapeHtml(item.part.partNumber)} · ${item.vehicle ? `${escapeHtml(item.vehicle.modelName)} ${item.vehicle.year}` : "No fitment details"}</p>
                </div>
                <label class="dealer-field">
                  <span>Status</span>
                  <select class="dealer-select dealer-order-status">
                    ${ORDER_STATUS_OPTIONS.map((option) => `
                      <option value="${option.value}" ${item.status === option.value ? "selected" : ""}>${option.label}</option>
                    `).join("")}
                  </select>
                </label>
                <label class="dealer-field">
                  <span>Quantity</span>
                  <input class="dealer-input dealer-order-quantity" type="number" min="1" step="1" value="${item.quantity}" />
                </label>
                <label class="dealer-field">
                  <span>Line total</span>
                  <input class="dealer-input" type="text" value="${formatMoney(item.lineTotal)}" disabled />
                </label>
              </div>
              <div class="dealer-form__grid">
                <label class="dealer-field">
                  <span>Shipping carrier</span>
                  <input class="dealer-input dealer-order-carrier" type="text" value="${escapeHtml(item.shippingCarrier || "")}" />
                </label>
                <label class="dealer-field">
                  <span>Tracking number</span>
                  <input class="dealer-input dealer-order-tracking" type="text" value="${escapeHtml(item.trackingNumber || "")}" />
                </label>
              </div>
              <label class="dealer-field">
                <span>Status note</span>
                <input class="dealer-input dealer-order-note" type="text" value="${escapeHtml(item.statusNote || "")}" />
              </label>
              <div class="dealer-order-item__actions">
                <button class="dealer-btn dealer-btn--primary" type="button" data-action="update-order-item" data-order-item-id="${item.orderItemId}">Save line</button>
                <span class="dealer-meta-pill">${escapeHtml(item.status)}</span>
                ${item.shippedAt ? `<span class="dealer-meta-pill">Shipped ${escapeHtml(formatDateTime(item.shippedAt))}</span>` : ""}
                ${item.deliveredAt ? `<span class="dealer-meta-pill">Delivered ${escapeHtml(formatDateTime(item.deliveredAt))}</span>` : ""}
              </div>
            </div>
          `).join("") : ""}
        </article>
      `;
      }).join("");
    }

    const methods = getShippingMethods().filter((item) => item.isActive);
    elements.shippingSummary.innerHTML = methods.length
      ? methods.map((item) => `
        <article class="dealer-shipping">
          <div class="dealer-shipping__top">
            <strong>${escapeHtml(item.carrierName)}</strong>
            <span class="dealer-badge dealer-badge--success">${escapeHtml(item.regionName)}</span>
          </div>
          <p>${formatMoney(item.baseFee)} base + ${formatMoney(item.feePerItem)} per item</p>
          <div class="dealer-meta-list">
            <span class="dealer-meta-pill">${item.estimatedDaysMin || "?"}-${item.estimatedDaysMax || "?"} days</span>
          </div>
        </article>
      `).join("")
      : renderEmpty("No shipping methods are active yet.");
  }

  function renderPromotions() {
    const offers = getOffers();
    const coupons = getCoupons();

    elements.offersList.innerHTML = offers.length
      ? offers.map((item) => `
        <article class="dealer-record">
          <div class="dealer-record__top">
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.description || "No description")}</p>
            </div>
            <span class="dealer-badge ${item.isActive ? "dealer-badge--success" : "dealer-badge--danger"}">
              ${item.isActive ? "Active" : "Paused"}
            </span>
          </div>
          <div class="dealer-meta-list">
            <span class="dealer-meta-pill">${escapeHtml(item.scopeType)}</span>
            <span class="dealer-meta-pill">${item.discountType === "percentage" ? formatPercent(item.discountValue) : formatMoney(item.discountValue)}</span>
            ${item.part ? `<span class="dealer-meta-pill">${escapeHtml(item.part.name)}</span>` : ""}
            ${item.category ? `<span class="dealer-meta-pill">${escapeHtml(item.category.name)}</span>` : ""}
            <span class="dealer-meta-pill">${escapeHtml(formatShortDate(item.startsAt))} → ${escapeHtml(formatShortDate(item.endsAt))}</span>
          </div>
          <div class="dealer-inline-actions">
            <button class="dealer-btn dealer-btn--ghost" type="button" data-action="edit-offer" data-offer-id="${item.id}">Edit</button>
            <button class="dealer-btn dealer-btn--outline" type="button" data-action="toggle-offer" data-offer-id="${item.id}">
              ${item.isActive ? "Pause" : "Activate"}
            </button>
          </div>
        </article>
      `).join("")
      : renderEmpty("No offers configured yet.");

    elements.couponsList.innerHTML = coupons.length
      ? coupons.map((item) => `
        <article class="dealer-record">
          <div class="dealer-record__top">
            <div>
              <strong>${escapeHtml(item.code)}</strong>
              <p>${escapeHtml(item.title)} · ${escapeHtml(item.description || "No description")}</p>
            </div>
            <span class="dealer-badge ${item.isActive ? "dealer-badge--success" : "dealer-badge--danger"}">
              ${item.isActive ? "Active" : "Paused"}
            </span>
          </div>
          <div class="dealer-meta-list">
            <span class="dealer-meta-pill">${item.discountType === "percentage" ? formatPercent(item.discountValue) : formatMoney(item.discountValue)}</span>
            <span class="dealer-meta-pill">Minimum ${formatMoney(item.minimumOrderValue)}</span>
            <span class="dealer-meta-pill">${item.timesUsed}/${item.usageLimit || "∞"} used</span>
            <span class="dealer-meta-pill">${item.targets.length} targets</span>
          </div>
          <div class="dealer-inline-actions">
            <button class="dealer-btn dealer-btn--ghost" type="button" data-action="edit-coupon" data-coupon-id="${item.id}">Edit</button>
            <button class="dealer-btn dealer-btn--outline" type="button" data-action="toggle-coupon" data-coupon-id="${item.id}">
              ${item.isActive ? "Pause" : "Activate"}
            </button>
          </div>
        </article>
      `).join("")
      : renderEmpty("No coupons configured yet.");
  }

  function renderCustomers() {
    const customers = getCustomers();
    const notifications = getNotifications();
    const feedback = getFeedback();

    elements.customersList.innerHTML = customers.length
      ? customers.map((item) => `
        <article class="dealer-customer">
          <div class="dealer-customer__top">
            <div>
              <strong>${escapeHtml(item.fullName)}</strong>
              <p>${escapeHtml(item.email)} · ${escapeHtml(item.phone || "No phone")} · ${escapeHtml(item.city || "No city")}</p>
            </div>
            <span class="dealer-badge">${formatMoney(item.totalSpent)}</span>
          </div>
          <div class="dealer-meta-list">
            <span class="dealer-meta-pill">${item.orderCount} orders</span>
            <span class="dealer-meta-pill">Last order ${escapeHtml(formatShortDate(item.lastOrderAt))}</span>
            ${item.couponCodes.length ? `<span class="dealer-meta-pill">${escapeHtml(item.couponCodes.join(", "))}</span>` : ""}
          </div>
          <p>${escapeHtml(item.addressLine || "No saved address")}</p>
        </article>
      `).join("")
      : renderEmpty("Customer profiles will show up once routed orders arrive.");

    elements.notificationsList.innerHTML = notifications.length
      ? notifications.map((item) => `
        <article class="dealer-notification">
          <div class="dealer-notification__top">
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.message)}</p>
            </div>
            <span class="dealer-badge ${item.isRead ? "" : "dealer-badge--warning"}">${item.isRead ? "Read" : "Unread"}</span>
          </div>
          <div class="dealer-inline-actions">
            <button class="dealer-btn dealer-btn--ghost" type="button" data-action="toggle-notification-read" data-notification-id="${item.id}" data-next-read="${item.isRead ? "false" : "true"}">
              ${item.isRead ? "Mark unread" : "Mark read"}
            </button>
            <span class="dealer-meta-pill">${escapeHtml(formatDateTime(item.createdAt))}</span>
          </div>
        </article>
      `).join("")
      : renderEmpty("No dealer notifications yet.");

    elements.feedbackList.innerHTML = feedback.length
      ? feedback.map((item) => `
        <article class="dealer-feedback">
          <div class="dealer-feedback__top">
            <div>
              <strong>${escapeHtml(item.user?.fullName || "Guest customer")}</strong>
              <p>${escapeHtml(item.message)}</p>
            </div>
            <span class="dealer-badge ${item.isResolved ? "dealer-badge--success" : "dealer-badge--warning"}">
              ${item.isResolved ? "Resolved" : "Open"}
            </span>
          </div>
          <div class="dealer-meta-list">
            <span class="dealer-meta-pill">${escapeHtml(item.complaintType)}</span>
            ${item.rating !== null ? `<span class="dealer-meta-pill">Rating ${item.rating}/5</span>` : ""}
            ${item.orderNumber ? `<span class="dealer-meta-pill">${escapeHtml(item.orderNumber)}</span>` : ""}
            ${item.partName ? `<span class="dealer-meta-pill">${escapeHtml(item.partName)}</span>` : ""}
          </div>
          <div class="dealer-inline-actions">
            <button class="dealer-btn dealer-btn--ghost" type="button" data-action="toggle-feedback" data-feedback-id="${item.id}" data-next-resolved="${item.isResolved ? "false" : "true"}">
              ${item.isResolved ? "Reopen" : "Resolve"}
            </button>
          </div>
        </article>
      `).join("")
      : renderEmpty("No customer ratings or complaints yet.");
  }

  function renderOperations() {
    const shippingMethods = getShippingMethods();
    const staff = getStaff();
    const supportTickets = getSupportTickets();
    const helpArticles = getHelpArticles();
    const dealer = state.dashboard?.activeDealer;

    elements.shippingMethodsList.innerHTML = shippingMethods.length
      ? shippingMethods.map((item) => `
        <article class="dealer-shipping">
          <div class="dealer-shipping__top">
            <div>
              <strong>${escapeHtml(item.carrierName)}</strong>
              <p>${escapeHtml(item.regionName)} · ${formatMoney(item.baseFee)} base + ${formatMoney(item.feePerItem)} per item</p>
            </div>
            <span class="dealer-badge ${item.isActive ? "dealer-badge--success" : "dealer-badge--danger"}">${item.isActive ? "Active" : "Paused"}</span>
          </div>
          <div class="dealer-inline-actions">
            <button class="dealer-btn dealer-btn--ghost" type="button" data-action="edit-shipping" data-shipping-id="${item.id}">Edit</button>
            <button class="dealer-btn dealer-btn--outline" type="button" data-action="toggle-shipping" data-shipping-id="${item.id}">
              ${item.isActive ? "Pause" : "Activate"}
            </button>
          </div>
        </article>
      `).join("")
      : renderEmpty("No shipping methods configured yet.");

    elements.staffList.innerHTML = staff.length
      ? staff.map((item) => `
        <article class="dealer-staff">
          <div class="dealer-staff__top">
            <div>
              <strong>${escapeHtml(item.fullName || item.username || item.email)}</strong>
              <p>${escapeHtml(item.email)} · ${escapeHtml(item.phone || "No phone")}</p>
            </div>
            <span class="dealer-badge">${escapeHtml(item.accessStatus)}</span>
          </div>
          <div class="dealer-meta-list">
            ${item.brands.map((brand) => `<span class="dealer-meta-pill">${escapeHtml(brand.name)}</span>`).join("")}
            ${item.permissions.map((permission) => `<span class="dealer-meta-pill">${escapeHtml(formatPermissionLabel(permission))}</span>`).join("")}
          </div>
          <div class="dealer-inline-actions">
            <button class="dealer-btn dealer-btn--ghost" type="button" data-action="edit-staff" data-user-id="${item.userId}">Edit access</button>
          </div>
        </article>
      `).join("")
      : renderEmpty("No team members added yet.");

    if (dealer) {
      elements.profileName.value = dealer.name || "";
      elements.profileLocation.value = dealer.location || "";
      elements.profileEmail.value = dealer.contactEmail || "";
      elements.profilePhone.value = dealer.contactPhone || "";
      elements.profileDescription.value = dealer.description || "";
    }

    elements.supportTickets.innerHTML = supportTickets.length
      ? supportTickets.map((item) => `
        <article class="dealer-support" data-ticket-id="${item.id}">
          <div class="dealer-support__top">
            <div>
              <strong>${escapeHtml(item.subject)}</strong>
              <p>${escapeHtml(item.message)}</p>
            </div>
            <span class="dealer-badge ${item.status === "resolved" ? "dealer-badge--success" : "dealer-badge--warning"}">${escapeHtml(item.status)}</span>
          </div>
          <div class="dealer-meta-list">
            <span class="dealer-meta-pill">${escapeHtml(item.priority)}</span>
            <span class="dealer-meta-pill">${escapeHtml(item.createdBy.fullName)}</span>
            <span class="dealer-meta-pill">${escapeHtml(formatDateTime(item.createdAt))}</span>
          </div>
          ${item.adminReply ? `<p><strong>Support reply:</strong> ${escapeHtml(item.adminReply)}</p>` : ""}
          <div class="dealer-form__grid">
            <label class="dealer-field">
              <span>Status</span>
              <select class="dealer-select dealer-support-status">
                ${SUPPORT_STATUS_OPTIONS.map((option) => `
                  <option value="${option.value}" ${item.status === option.value ? "selected" : ""}>${option.label}</option>
                `).join("")}
              </select>
            </label>
            <label class="dealer-field">
              <span>Follow-up note</span>
              <input class="dealer-input dealer-support-reply" type="text" placeholder="Optional reply" />
            </label>
          </div>
          <div class="dealer-inline-actions">
            <button class="dealer-btn dealer-btn--ghost" type="button" data-action="update-ticket" data-ticket-id="${item.id}">Update ticket</button>
          </div>
        </article>
      `).join("")
      : renderEmpty("No support tickets yet.");

    elements.helpArticles.innerHTML = helpArticles.length
      ? helpArticles.map((item) => `
        <article class="dealer-help-article">
          <span class="dealer-card__eyebrow">${escapeHtml(item.category)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.summary)}</p>
          <div class="dealer-note">${escapeHtml(item.content)}</div>
        </article>
      `).join("")
      : renderEmpty("Help center articles will appear here.");
  }

  function populateSelect(select, options, placeholder = "Select option") {
    select.innerHTML = [
      `<option value="">${escapeHtml(placeholder)}</option>`,
      ...options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
    ].join("");
  }

  function populateCheckboxList(root, options, selectedValues = []) {
    root.innerHTML = options.length
      ? options.map((option) => `
        <label>
          <input type="checkbox" value="${escapeHtml(option.value)}" ${selectedValues.includes(option.value) ? "checked" : ""} />
          <span>${escapeHtml(option.label)}</span>
        </label>
      `).join("")
      : `<div class="dealer-empty">No options available.</div>`;
  }

  function getCheckedValues(root) {
    return Array.from(root.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
  }

  function populateFormOptions() {
    const brands = getBrands();
    const categories = getCategories();
    const inventory = getInventory();
    const customers = getCustomers();

    populateSelect(elements.productBrand, brands.map((item) => ({ value: item.key, label: item.name })), "Choose brand");
    populateSelect(elements.productCategory, categories.map((item) => ({ value: item.key, label: `${item.name} (${item.listingCount})` })), "Optional category");
    populateSelect(elements.stockPart, inventory.map((item) => ({ value: String(item.id), label: `${item.name} · ${item.partNumber}` })), "Choose product");
    populateSelect(elements.offerPart, inventory.filter((item) => item.active).map((item) => ({ value: String(item.id), label: `${item.name} · ${item.partNumber}` })), "Choose product");
    populateSelect(elements.offerCategory, categories.map((item) => ({ value: item.key, label: item.name })), "Choose category");
    populateCheckboxList(elements.customerTargets, customers.map((item) => ({
      value: String(item.id),
      label: `${item.fullName} (${item.orderCount} orders · ${formatMoney(item.totalSpent)})`
    })));
    populateCheckboxList(elements.staffBrands, brands.map((item) => ({ value: item.key, label: item.name })));

    if (state.selectedProductId) {
      elements.stockPart.value = String(state.selectedProductId);
    }
  }

  async function getModelsForBrand(brandKey) {
    const normalized = String(brandKey || "").trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    if (state.modelCache.has(normalized)) {
      return state.modelCache.get(normalized);
    }

    const payload = await catalogApi.fetchBrandModels(normalized);
    const models = Array.isArray(payload?.models)
      ? payload.models
      : Array.isArray(payload)
        ? payload
        : [];
    state.modelCache.set(normalized, models);
    return models;
  }

  async function getYearsForModel(modelKey) {
    const normalized = String(modelKey || "").trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    if (state.yearCache.has(normalized)) {
      return state.yearCache.get(normalized);
    }

    const payload = await catalogApi.fetchModelYears(normalized);
    const years = Array.isArray(payload?.years)
      ? payload.years
      : Array.isArray(payload)
        ? payload
        : [];
    state.yearCache.set(normalized, years);
    return years;
  }

  async function hydrateFitmentRow(row, options = {}) {
    const brandKey = elements.productBrand.value || state.productDraftBrand;
    const modelSelect = row.querySelector('[data-role="model"]');
    const yearSelect = row.querySelector('[data-role="year"]');
    if (!brandKey) {
      modelSelect.innerHTML = `<option value="">Choose brand first</option>`;
      yearSelect.innerHTML = `<option value="">Choose model first</option>`;
      return;
    }

    const models = await getModelsForBrand(brandKey);
    modelSelect.innerHTML = [
      `<option value="">Choose model</option>`,
      ...models.map((item) => `<option value="${escapeHtml(item.key || item.modelKey)}">${escapeHtml(item.name)}</option>`)
    ].join("");

    if (options.modelKey) {
      modelSelect.value = options.modelKey;
    }

    const modelKey = modelSelect.value || options.modelKey || "";
    if (!modelKey) {
      yearSelect.innerHTML = `<option value="">Choose model first</option>`;
      return;
    }

    const years = await getYearsForModel(modelKey);
    yearSelect.innerHTML = [
      `<option value="">Choose year</option>`,
      ...years.map((item) => `<option value="${escapeHtml(String(item.value || item.year || item.yearValue))}">${escapeHtml(item.label || String(item.value || item.year || item.yearValue))}</option>`)
    ].join("");

    if (options.year) {
      yearSelect.value = String(options.year);
    }
  }

  async function addFitmentRow(initial = {}) {
    const row = document.createElement("div");
    row.className = "dealer-fitment-row";
    row.innerHTML = `
      <label class="dealer-field">
        <span>Model</span>
        <select class="dealer-select" data-role="model"></select>
      </label>
      <label class="dealer-field">
        <span>Year</span>
        <select class="dealer-select" data-role="year"></select>
      </label>
      <button class="dealer-btn dealer-btn--outline" type="button" data-action="remove-fitment">Remove</button>
    `;
    elements.fitmentRows.appendChild(row);
    await hydrateFitmentRow(row, initial);
  }

  async function resetFitments(defaultBrandKey = "") {
    state.productDraftBrand = defaultBrandKey;
    elements.fitmentRows.innerHTML = "";
    await addFitmentRow();
  }

  function gatherFitments() {
    return Array.from(elements.fitmentRows.querySelectorAll(".dealer-fitment-row"))
      .map((row) => ({
        modelKey: row.querySelector('[data-role="model"]').value,
        year: Number(row.querySelector('[data-role="year"]').value)
      }))
      .filter((item) => item.modelKey && item.year);
  }

  function parseCsvRows() {
    return elements.importRows.value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [partNumber, quantity, unitCost, ...noteParts] = line.split(",");
        return {
          partNumber: (partNumber || "").trim(),
          quantity: Number(quantity || 0),
          unitCost: unitCost !== undefined && unitCost !== "" ? Number(unitCost) : null,
          note: noteParts.join(",").trim()
        };
      });
  }

  function fillProductForm(partId) {
    const item = getInventory().find((entry) => Number(entry.id) === Number(partId));
    if (!item) {
      return;
    }

    state.selectedProductId = item.id;
    elements.productFormTitle.textContent = `Edit ${item.name}`;
    elements.productId.value = String(item.id);
    elements.productName.value = item.name || "";
    elements.productPartNumber.value = item.partNumber || "";
    elements.productBrand.value = item.brand?.key || "";
    elements.productCategory.value = item.category?.key || "";
    elements.productType.value = item.partType || "original";
    elements.productPrice.value = String(item.price || 0);
    elements.productStock.value = String(item.stockQuantity || 0);
    elements.productManufacturer.value = item.manufacturerName || "";
    elements.productWarranty.value = item.warrantyMonths ?? "";
    elements.productSerial.value = item.serialNumber || "";
    elements.productDescription.value = item.description || "";
    elements.productImages.value = (item.imageUrls || []).join("\n");
    elements.productSpecs.value = Object.entries(item.technicalSpecs || {})
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

    state.productDraftBrand = item.brand?.key || "";
    elements.fitmentRows.innerHTML = "";
    Promise.resolve().then(async () => {
      if (item.fitments?.length) {
        for (const fitment of item.fitments) {
          await addFitmentRow({
            modelKey: fitment.modelKey,
            year: fitment.year
          });
        }
      } else {
        await addFitmentRow();
      }
    });

    elements.productArchiveBtn.hidden = false;
    elements.productArchiveBtn.textContent = item.active ? "Archive product" : "Restore product";
    elements.productDeleteBtn.hidden = false;
    elements.stockPart.value = String(item.id);
    state.selectedProductId = item.id;

    elements.productForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetProductForm() {
    state.selectedProductId = null;
    elements.productForm.reset();
    elements.productId.value = "";
    elements.productFormTitle.textContent = "Create new product";
    elements.productArchiveBtn.hidden = true;
    elements.productDeleteBtn.hidden = true;
    state.productDraftBrand = elements.productBrand.value || getBrands()[0]?.key || "";
    elements.productBrand.value = state.productDraftBrand || "";
    resetFitments(state.productDraftBrand).catch((error) => {
      console.error(error);
      showToast(error.message || "Could not reset fitments", "error");
    });
  }

  function fillOfferForm(offerId) {
    const item = getOffers().find((entry) => Number(entry.id) === Number(offerId));
    if (!item) {
      return;
    }

    state.selectedOfferId = item.id;
    elements.offerId.value = String(item.id);
    elements.offerTitle.value = item.title || "";
    elements.offerScopeType.value = item.scopeType || "part";
    elements.offerPart.value = item.part ? String(item.part.id) : "";
    elements.offerCategory.value = item.category?.key || "";
    elements.offerDiscountType.value = item.discountType || "percentage";
    elements.offerDiscountValue.value = String(item.discountValue || 0);
    elements.offerStartsAt.value = item.startsAt ? String(item.startsAt).slice(0, 16) : "";
    elements.offerEndsAt.value = item.endsAt ? String(item.endsAt).slice(0, 16) : "";
    elements.offerDescription.value = item.description || "";
    elements.offerActive.checked = Boolean(item.isActive);
    toggleOfferScopeFields();
    elements.offerForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetOfferForm() {
    state.selectedOfferId = null;
    elements.offerForm.reset();
    elements.offerId.value = "";
    elements.offerScopeType.value = "part";
    elements.offerDiscountType.value = "percentage";
    elements.offerActive.checked = true;
    toggleOfferScopeFields();
  }

  function fillCouponForm(couponId) {
    const item = getCoupons().find((entry) => Number(entry.id) === Number(couponId));
    if (!item) {
      return;
    }

    state.selectedCouponId = item.id;
    elements.couponId.value = String(item.id);
    elements.couponCode.value = item.code || "";
    elements.couponTitle.value = item.title || "";
    elements.couponDiscountType.value = item.discountType || "percentage";
    elements.couponDiscountValue.value = String(item.discountValue || 0);
    elements.couponMinimumOrderValue.value = String(item.minimumOrderValue || 0);
    elements.couponUsageLimit.value = item.usageLimit ?? "";
    elements.couponStartsAt.value = item.startsAt ? String(item.startsAt).slice(0, 16) : "";
    elements.couponEndsAt.value = item.endsAt ? String(item.endsAt).slice(0, 16) : "";
    elements.couponDescription.value = item.description || "";
    elements.couponTargets.value = item.targets.map((target) => target.email).join("\n");
    elements.couponActive.checked = Boolean(item.isActive);
    elements.couponForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetCouponForm() {
    state.selectedCouponId = null;
    elements.couponForm.reset();
    elements.couponId.value = "";
    elements.couponDiscountType.value = "percentage";
    elements.couponActive.checked = true;
  }

  function fillShippingForm(shippingId) {
    const item = getShippingMethods().find((entry) => Number(entry.id) === Number(shippingId));
    if (!item) {
      return;
    }

    state.selectedShippingId = item.id;
    elements.shippingId.value = String(item.id);
    elements.shippingCarrierName.value = item.carrierName || "";
    elements.shippingRegionName.value = item.regionName || "";
    elements.shippingBaseFee.value = String(item.baseFee || 0);
    elements.shippingFeePerItem.value = String(item.feePerItem || 0);
    elements.shippingMinDays.value = item.estimatedDaysMin ?? "";
    elements.shippingMaxDays.value = item.estimatedDaysMax ?? "";
    elements.shippingActive.checked = Boolean(item.isActive);
    elements.shippingForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetShippingForm() {
    state.selectedShippingId = null;
    elements.shippingForm.reset();
    elements.shippingId.value = "";
    elements.shippingActive.checked = true;
  }

  function fillStaffForm(userId) {
    const item = getStaff().find((entry) => Number(entry.userId) === Number(userId));
    if (!item) {
      return;
    }

    state.selectedStaffUserId = item.userId;
    elements.staffUserId.value = String(item.userId);
    elements.staffEmail.value = item.email || "";
    populateCheckboxList(elements.staffBrands, getBrands().map((brand) => ({ value: brand.key, label: brand.name })), item.brands.map((brand) => brand.key));
    elements.staffPermissionInventory.checked = item.permissions.includes("inventory");
    elements.staffPermissionOrders.checked = item.permissions.includes("orders");
    elements.staffPermissionVerification.checked = item.permissions.includes("verification");
    elements.staffPermissionAnalytics.checked = item.permissions.includes("analytics");
    elements.staffStatus.value = item.accessStatus || "active";
    elements.staffForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetStaffForm() {
    state.selectedStaffUserId = null;
    elements.staffForm.reset();
    elements.staffUserId.value = "";
    populateCheckboxList(elements.staffBrands, getBrands().map((brand) => ({ value: brand.key, label: brand.name })));
    elements.staffPermissionInventory.checked = true;
    elements.staffPermissionOrders.checked = true;
    elements.staffPermissionVerification.checked = true;
    elements.staffPermissionAnalytics.checked = true;
    elements.staffStatus.value = "active";
  }

  function toggleOfferScopeFields() {
    const isPartScope = elements.offerScopeType.value === "part";
    elements.offerPart.closest(".dealer-field").hidden = !isPartScope;
    elements.offerCategory.closest(".dealer-field").hidden = isPartScope;
  }

  function readOrderLineForm(node) {
    return {
      status: node.querySelector(".dealer-order-status")?.value || "",
      quantity: Number(node.querySelector(".dealer-order-quantity")?.value || 1),
      shippingCarrier: node.querySelector(".dealer-order-carrier")?.value || "",
      trackingNumber: node.querySelector(".dealer-order-tracking")?.value || "",
      statusNote: node.querySelector(".dealer-order-note")?.value || ""
    };
  }

  async function refreshDashboard(payload, successMessage) {
    state.dashboard = extractDashboard(payload);
    state.selectedDealerId = String(state.dashboard?.selectedDealerId || state.selectedDealerId || "");
    renderAll();
    queueProductEditorPositionSync();
    if (successMessage) {
      showToast(successMessage, "success");
    }
  }

  async function loadDashboard(options = {}) {
    if (options.dealerId !== undefined) {
      state.selectedDealerId = String(options.dealerId || "");
    }

    try {
      const initialPath = state.selectedDealerId
        ? `/dealers/dashboard/me?dealerId=${encodeURIComponent(state.selectedDealerId)}`
        : "/dealers/dashboard/me";
      const payload = await authApi.apiFetch(initialPath);
      state.dashboard = extractDashboard(payload);
      state.selectedDealerId = String(state.dashboard?.selectedDealerId || state.selectedDealerId || "");
      renderAll();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not load dealer dashboard", "error");
    }
  }

  async function submitProductForm(event) {
    event.preventDefault();
    const body = {
      name: elements.productName.value.trim(),
      description: elements.productDescription.value.trim(),
      imageUrls: elements.productImages.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
      price: Number(elements.productPrice.value || 0),
      brandKey: elements.productBrand.value,
      categoryKey: elements.productCategory.value,
      manufacturerName: elements.productManufacturer.value.trim(),
      partNumber: elements.productPartNumber.value.trim(),
      partType: elements.productType.value,
      warrantyMonths: elements.productWarranty.value ? Number(elements.productWarranty.value) : null,
      technicalSpecs: elements.productSpecs.value.trim(),
      fitments: gatherFitments(),
      serialNumber: elements.productSerial.value.trim().toUpperCase(),
      initialStock: Number(elements.productStock.value || 0)
    };

    const currentId = Number(elements.productId.value || 0);
    const endpoint = currentId ? `/dealers/inventory/${currentId}` : "/dealers/inventory";
    const method = currentId ? "PATCH" : "POST";

    try {
      const payload = await request(endpoint, { method, body });
      await refreshDashboard(payload, currentId ? "Product updated." : "Product created.");
      if (currentId) {
        fillProductForm(currentId);
      } else {
        resetProductForm();
      }
    } catch (error) {
      showToast(error.message || "Could not save product", "error");
    }
  }

  async function submitStockForm(event) {
    event.preventDefault();
    const partId = Number(elements.stockPart.value || 0);
    if (!partId) {
      showToast("Choose a product first.", "error");
      return;
    }

    const body = {
      movementType: elements.stockType.value,
      quantityDelta: elements.stockDelta.value ? Number(elements.stockDelta.value) : undefined,
      newQuantity: elements.stockReplace.value ? Number(elements.stockReplace.value) : undefined,
      unitCost: elements.stockUnitCost.value ? Number(elements.stockUnitCost.value) : undefined,
      note: elements.stockNote.value.trim()
    };

    try {
      const payload = await request(`/dealers/inventory/${partId}/stock`, { method: "POST", body });
      await refreshDashboard(payload, "Stock updated.");
      elements.stockForm.reset();
      elements.stockPart.value = String(partId);
    } catch (error) {
      showToast(error.message || "Could not update stock", "error");
    }
  }

  async function submitImportForm(event) {
    event.preventDefault();
    const rows = parseCsvRows();
    if (!rows.length) {
      showToast("Paste at least one import row.", "error");
      return;
    }

    try {
      const payload = await request("/dealers/inventory/import", {
        method: "POST",
        body: {
          mode: elements.importMode.value,
          rows
        }
      });
      const importSummary = payload.importSummary || {};
      await refreshDashboard(payload, `Import done: ${importSummary.updated || 0} rows updated.`);
    } catch (error) {
      showToast(error.message || "Could not import stock rows", "error");
    }
  }

  async function submitOfferForm(event) {
    event.preventDefault();
    const offerId = Number(elements.offerId.value || 0);
    const endpoint = offerId ? `/dealers/offers/${offerId}` : "/dealers/offers";
    const method = offerId ? "PATCH" : "POST";

    try {
      const payload = await request(endpoint, {
        method,
        body: {
          title: elements.offerTitle.value.trim(),
          scopeType: elements.offerScopeType.value,
          partId: elements.offerPart.value ? Number(elements.offerPart.value) : null,
          categoryKey: elements.offerCategory.value || null,
          discountType: elements.offerDiscountType.value,
          discountValue: Number(elements.offerDiscountValue.value || 0),
          startsAt: elements.offerStartsAt.value || null,
          endsAt: elements.offerEndsAt.value || null,
          description: elements.offerDescription.value.trim(),
          isActive: elements.offerActive.checked
        }
      });
      await refreshDashboard(payload, offerId ? "Offer updated." : "Offer created.");
      resetOfferForm();
    } catch (error) {
      showToast(error.message || "Could not save offer", "error");
    }
  }

  async function submitCouponForm(event) {
    event.preventDefault();
    const couponId = Number(elements.couponId.value || 0);
    const endpoint = couponId ? `/dealers/coupons/${couponId}` : "/dealers/coupons";
    const method = couponId ? "PATCH" : "POST";

    try {
      const payload = await request(endpoint, {
        method,
        body: {
          code: elements.couponCode.value.trim().toUpperCase(),
          title: elements.couponTitle.value.trim(),
          discountType: elements.couponDiscountType.value,
          discountValue: Number(elements.couponDiscountValue.value || 0),
          minimumOrderValue: Number(elements.couponMinimumOrderValue.value || 0),
          usageLimit: elements.couponUsageLimit.value ? Number(elements.couponUsageLimit.value) : null,
          startsAt: elements.couponStartsAt.value || null,
          endsAt: elements.couponEndsAt.value || null,
          description: elements.couponDescription.value.trim(),
          targetEmails: elements.couponTargets.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
          isActive: elements.couponActive.checked
        }
      });
      await refreshDashboard(payload, couponId ? "Coupon updated." : "Coupon created.");
      resetCouponForm();
    } catch (error) {
      showToast(error.message || "Could not save coupon", "error");
    }
  }

  async function submitCustomerNotifyForm(event) {
    event.preventDefault();
    const customerIds = getCheckedValues(elements.customerTargets).map((value) => Number(value));
    if (!customerIds.length) {
      showToast("Choose at least one customer.", "error");
      return;
    }

    try {
      const payload = await request("/dealers/customers/notify", {
        method: "POST",
        body: {
          title: elements.customerNotifyTitle.value.trim(),
          message: elements.customerNotifyMessage.value.trim(),
          customerIds
        }
      });
      await refreshDashboard(payload, "Customer notification sent.");
      elements.customerNotifyForm.reset();
      populateCheckboxList(elements.customerTargets, getCustomers().map((item) => ({
        value: String(item.id),
        label: `${item.fullName} (${item.orderCount} orders · ${formatMoney(item.totalSpent)})`
      })));
    } catch (error) {
      showToast(error.message || "Could not send notification", "error");
    }
  }

  async function submitShippingForm(event) {
    event.preventDefault();
    const shippingId = Number(elements.shippingId.value || 0);
    const endpoint = shippingId ? `/dealers/shipping/${shippingId}` : "/dealers/shipping";
    const method = shippingId ? "PATCH" : "POST";

    try {
      const payload = await request(endpoint, {
        method,
        body: {
          carrierName: elements.shippingCarrierName.value.trim(),
          regionName: elements.shippingRegionName.value.trim(),
          baseFee: Number(elements.shippingBaseFee.value || 0),
          feePerItem: Number(elements.shippingFeePerItem.value || 0),
          estimatedDaysMin: elements.shippingMinDays.value ? Number(elements.shippingMinDays.value) : null,
          estimatedDaysMax: elements.shippingMaxDays.value ? Number(elements.shippingMaxDays.value) : null,
          isActive: elements.shippingActive.checked
        }
      });
      await refreshDashboard(payload, shippingId ? "Shipping method updated." : "Shipping method created.");
      resetShippingForm();
    } catch (error) {
      showToast(error.message || "Could not save shipping method", "error");
    }
  }

  async function submitStaffForm(event) {
    event.preventDefault();
    const userId = Number(elements.staffUserId.value || 0);
    const endpoint = userId ? `/dealers/staff/${userId}` : "/dealers/staff";
    const method = userId ? "PATCH" : "POST";

    try {
      const payload = await request(endpoint, {
        method,
        body: {
          email: elements.staffEmail.value.trim(),
          brandKeys: getCheckedValues(elements.staffBrands),
          accessStatus: elements.staffStatus.value,
          permissions: {
            inventory: elements.staffPermissionInventory.checked,
            orders: elements.staffPermissionOrders.checked,
            verification: elements.staffPermissionVerification.checked,
            analytics: elements.staffPermissionAnalytics.checked
          }
        }
      });
      await refreshDashboard(payload, userId ? "Staff access updated." : "Staff access granted.");
      resetStaffForm();
    } catch (error) {
      showToast(error.message || "Could not save staff access", "error");
    }
  }

  async function submitProfileForm(event) {
    event.preventDefault();

    try {
      const payload = await request("/dealers/profile", {
        method: "PATCH",
        body: {
          name: elements.profileName.value.trim(),
          location: elements.profileLocation.value.trim(),
          contactEmail: elements.profileEmail.value.trim(),
          contactPhone: elements.profilePhone.value.trim(),
          description: elements.profileDescription.value.trim()
        }
      });
      await refreshDashboard(payload, "Dealer profile updated.");
    } catch (error) {
      showToast(error.message || "Could not update dealer profile", "error");
    }
  }

  async function submitSupportForm(event) {
    event.preventDefault();

    try {
      const payload = await request("/dealers/support", {
        method: "POST",
        body: {
          subject: elements.supportSubject.value.trim(),
          priority: elements.supportPriority.value,
          message: elements.supportMessage.value.trim()
        }
      });
      await refreshDashboard(payload, "Support ticket submitted.");
      elements.supportForm.reset();
      elements.supportPriority.value = "normal";
    } catch (error) {
      showToast(error.message || "Could not submit support ticket", "error");
    }
  }

  async function toggleNotification(notificationId, isRead) {
    try {
      const payload = await request(`/dealers/notifications/${notificationId}/read`, {
        method: "PATCH",
        body: { isRead }
      });
      await refreshDashboard(payload, isRead ? "Notification marked as read." : "Notification marked as unread.");
    } catch (error) {
      showToast(error.message || "Could not update notification", "error");
    }
  }

  async function toggleFeedback(feedbackId, isResolved) {
    try {
      const payload = await request(`/dealers/feedback/${feedbackId}`, {
        method: "PATCH",
        body: { isResolved }
      });
      await refreshDashboard(payload, isResolved ? "Feedback resolved." : "Feedback reopened.");
    } catch (error) {
      showToast(error.message || "Could not update feedback", "error");
    }
  }

  async function updateSupportTicket(ticketId, ticketNode) {
    const status = ticketNode.querySelector(".dealer-support-status")?.value || "";
    const adminReply = ticketNode.querySelector(".dealer-support-reply")?.value || "";
    try {
      const payload = await request(`/dealers/support/${ticketId}`, {
        method: "PATCH",
        body: {
          status,
          adminReply
        }
      });
      await refreshDashboard(payload, "Support ticket updated.");
    } catch (error) {
      showToast(error.message || "Could not update support ticket", "error");
    }
  }

  async function updateOrderLine(orderItemId, node) {
    try {
      const payload = await request(`/dealers/orders/${orderItemId}`, {
        method: "PATCH",
        body: readOrderLineForm(node)
      });
      await refreshDashboard(payload, "Order line updated.");
    } catch (error) {
      showToast(error.message || "Could not update order line", "error");
    }
  }

  async function archiveOrRestoreProduct(partId) {
    const item = getInventory().find((entry) => Number(entry.id) === Number(partId));
    if (!item) {
      return;
    }

    if (!item.active) {
      try {
        const payload = await request(`/dealers/inventory/${partId}`, {
          method: "PATCH",
          body: {
            active: true,
            archiveReason: ""
          }
        });
        await refreshDashboard(payload, "Product restored.");
      } catch (error) {
        showToast(error.message || "Could not restore product", "error");
      }
      return;
    }

    const archiveReason = await window.AutoFixDialog.prompt(
      "Add the reason you are archiving this product. The reason will stay in the dealer audit trail.",
      "Archived by dealer dashboard",
      {
        title: "Archive product",
        confirmText: "Archive product",
        cancelText: "Keep active"
      }
    );
    if (archiveReason === null) {
      return;
    }

    try {
      const payload = await request(`/dealers/inventory/${partId}`, {
        method: "DELETE",
        body: {
          mode: "archive",
          archiveReason
        }
      });
      await refreshDashboard(payload, "Product archived.");
      resetProductForm();
    } catch (error) {
      showToast(error.message || "Could not archive product", "error");
    }
  }

  async function hardDeleteProduct(partId) {
    const shouldDelete = await window.AutoFixDialog.confirm(
      "Delete this product? If it has linked orders, AutoFix will archive it instead to protect order history.",
      {
        title: "Delete product",
        confirmText: "Delete product",
        cancelText: "Cancel",
        type: "error"
      }
    );
    if (!shouldDelete) {
      return;
    }

    try {
      const payload = await request(`/dealers/inventory/${partId}?mode=delete`, {
        method: "DELETE"
      });
      await refreshDashboard(payload, "Product delete request processed.");
      resetProductForm();
    } catch (error) {
      showToast(error.message || "Could not delete product", "error");
    }
  }

  async function toggleOffer(offerId) {
    const item = getOffers().find((entry) => Number(entry.id) === Number(offerId));
    if (!item) {
      return;
    }

    try {
      const payload = await request(`/dealers/offers/${offerId}`, {
        method: "PATCH",
        body: {
          title: item.title,
          description: item.description,
          discountType: item.discountType,
          discountValue: item.discountValue,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          isActive: !item.isActive
        }
      });
      await refreshDashboard(payload, item.isActive ? "Offer paused." : "Offer activated.");
    } catch (error) {
      showToast(error.message || "Could not update offer", "error");
    }
  }

  async function toggleCoupon(couponId) {
    const item = getCoupons().find((entry) => Number(entry.id) === Number(couponId));
    if (!item) {
      return;
    }

    try {
      const payload = await request(`/dealers/coupons/${couponId}`, {
        method: "PATCH",
        body: {
          title: item.title,
          description: item.description,
          discountType: item.discountType,
          discountValue: item.discountValue,
          minimumOrderValue: item.minimumOrderValue,
          usageLimit: item.usageLimit,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          targetEmails: item.targets.map((target) => target.email),
          isActive: !item.isActive
        }
      });
      await refreshDashboard(payload, item.isActive ? "Coupon paused." : "Coupon activated.");
    } catch (error) {
      showToast(error.message || "Could not update coupon", "error");
    }
  }

  async function toggleShipping(shippingId) {
    const item = getShippingMethods().find((entry) => Number(entry.id) === Number(shippingId));
    if (!item) {
      return;
    }

    try {
      const payload = await request(`/dealers/shipping/${shippingId}`, {
        method: "PATCH",
        body: {
          carrierName: item.carrierName,
          regionName: item.regionName,
          baseFee: item.baseFee,
          feePerItem: item.feePerItem,
          estimatedDaysMin: item.estimatedDaysMin,
          estimatedDaysMax: item.estimatedDaysMax,
          isActive: !item.isActive
        }
      });
      await refreshDashboard(payload, item.isActive ? "Shipping method paused." : "Shipping method activated.");
    } catch (error) {
      showToast(error.message || "Could not update shipping method", "error");
    }
  }

  function renderAll() {
    renderHero();
    renderScope();
    applyTabVisibility();
    renderKpis();
    populateFormOptions();
    renderOverview();
    renderInventory();
    renderOrders();
    renderPromotions();
    renderCustomers();
    renderOperations();

    if (!elements.productId.value) {
      resetProductForm();
    }
  }

  function bindEvents() {
    window.addEventListener("resize", queueProductEditorPositionSync);
    elements.refreshBtn?.addEventListener("click", () => loadDashboard());
    elements.resetProductBtn?.addEventListener("click", resetProductForm);
    elements.productResetBtn?.addEventListener("click", resetProductForm);
    elements.offerResetBtn?.addEventListener("click", resetOfferForm);
    elements.couponResetBtn?.addEventListener("click", resetCouponForm);
    elements.shippingResetBtn?.addEventListener("click", resetShippingForm);
    elements.staffResetBtn?.addEventListener("click", resetStaffForm);

    elements.tabbar?.addEventListener("click", (event) => {
      const button = event.target.closest(".dealer-tab");
      if (!button) {
        return;
      }
      setActiveTab(button.dataset.target);
    });

    elements.switchSelect?.addEventListener("change", async (event) => {
      await loadDashboard({ dealerId: event.target.value });
    });

    elements.inventorySearch?.addEventListener("input", (event) => {
      state.inventorySearch = event.target.value || "";
      renderInventory();
    });

    elements.inventoryBrandFilter?.addEventListener("change", (event) => {
      state.inventoryBrandKey = String(event.target.value || "").trim().toLowerCase();
      state.inventoryModelKey = "";
      state.inventoryYear = "";
      renderInventory();
    });

    elements.inventoryModelFilter?.addEventListener("change", (event) => {
      state.inventoryModelKey = String(event.target.value || "").trim().toLowerCase();
      state.inventoryYear = "";
      renderInventory();
    });

    elements.inventoryYearFilter?.addEventListener("change", (event) => {
      state.inventoryYear = String(event.target.value || "").trim();
      renderInventory();
    });

    elements.productBrand?.addEventListener("change", async (event) => {
      state.productDraftBrand = event.target.value;
      const rows = Array.from(elements.fitmentRows.querySelectorAll(".dealer-fitment-row"));
      if (!rows.length) {
        await resetFitments(state.productDraftBrand);
        return;
      }
      for (const row of rows) {
        await hydrateFitmentRow(row);
      }
    });

    elements.addFitmentBtn?.addEventListener("click", () => {
      addFitmentRow().catch((error) => {
        console.error(error);
        showToast(error.message || "Could not add fitment row", "error");
      });
    });

    elements.offerScopeType?.addEventListener("change", toggleOfferScopeFields);

    elements.fitmentRows?.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action='remove-fitment']");
      if (!action) {
        return;
      }
      action.closest(".dealer-fitment-row")?.remove();
      if (!elements.fitmentRows.querySelector(".dealer-fitment-row")) {
        addFitmentRow().catch((error) => {
          console.error(error);
          showToast(error.message || "Could not restore fitment row", "error");
        });
      }
    });

    elements.fitmentRows?.addEventListener("change", async (event) => {
      const select = event.target.closest('[data-role="model"]');
      if (!select) {
        return;
      }
      const row = select.closest(".dealer-fitment-row");
      await hydrateFitmentRow(row, { modelKey: select.value });
    });

    elements.productForm?.addEventListener("submit", submitProductForm);
    elements.stockForm?.addEventListener("submit", submitStockForm);
    elements.importForm?.addEventListener("submit", submitImportForm);
    elements.offerForm?.addEventListener("submit", submitOfferForm);
    elements.couponForm?.addEventListener("submit", submitCouponForm);
    elements.customerNotifyForm?.addEventListener("submit", submitCustomerNotifyForm);
    elements.shippingForm?.addEventListener("submit", submitShippingForm);
    elements.staffForm?.addEventListener("submit", submitStaffForm);
    elements.profileForm?.addEventListener("submit", submitProfileForm);
    elements.supportForm?.addEventListener("submit", submitSupportForm);

    elements.productArchiveBtn?.addEventListener("click", () => {
      const partId = Number(elements.productId.value || 0);
      if (partId) {
        archiveOrRestoreProduct(partId);
      }
    });

    elements.productDeleteBtn?.addEventListener("click", () => {
      const partId = Number(elements.productId.value || 0);
      if (partId) {
        hardDeleteProduct(partId);
      }
    });

    document.addEventListener("click", (event) => {
      const actionNode = event.target.closest("[data-action]");
      if (!actionNode) {
        return;
      }

      const { action } = actionNode.dataset;
      if (action === "edit-product") {
        fillProductForm(actionNode.dataset.productId);
      } else if (action === "select-order") {
        state.selectedOrderKey = String(actionNode.dataset.orderKey || "");
        renderOrders();
      } else if (action === "collapse-order") {
        state.selectedOrderKey = "";
        renderOrders();
      } else if (action === "restock-product") {
        const partId = actionNode.dataset.productId;
        elements.stockPart.value = String(partId);
        elements.stockForm.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (action === "archive-product") {
        archiveOrRestoreProduct(actionNode.dataset.productId);
      } else if (action === "delete-product") {
        hardDeleteProduct(actionNode.dataset.productId);
      } else if (action === "update-order-item") {
        const node = actionNode.closest(".dealer-order-item");
        updateOrderLine(actionNode.dataset.orderItemId, node);
      } else if (action === "edit-offer") {
        fillOfferForm(actionNode.dataset.offerId);
      } else if (action === "toggle-offer") {
        toggleOffer(actionNode.dataset.offerId);
      } else if (action === "edit-coupon") {
        fillCouponForm(actionNode.dataset.couponId);
      } else if (action === "toggle-coupon") {
        toggleCoupon(actionNode.dataset.couponId);
      } else if (action === "toggle-notification-read") {
        toggleNotification(actionNode.dataset.notificationId, actionNode.dataset.nextRead === "true");
      } else if (action === "toggle-feedback") {
        toggleFeedback(actionNode.dataset.feedbackId, actionNode.dataset.nextResolved === "true");
      } else if (action === "edit-shipping") {
        fillShippingForm(actionNode.dataset.shippingId);
      } else if (action === "toggle-shipping") {
        toggleShipping(actionNode.dataset.shippingId);
      } else if (action === "edit-staff") {
        fillStaffForm(actionNode.dataset.userId);
      } else if (action === "update-ticket") {
        const node = actionNode.closest(".dealer-support");
        updateSupportTicket(actionNode.dataset.ticketId, node);
      }
    });
  }

  async function init() {
    try {
      const refreshedUser = await authApi.refreshSessionUser();
      if (!authApi.requireRoleAccess({ dealer: true }, refreshedUser)) {
        return;
      }

      if (initialPreviewDealerId && refreshedUser?.dashboardAccess?.admin) {
        state.selectedDealerId = initialPreviewDealerId;
      }

      bindEvents();
      toggleOfferScopeFields();
      await loadDashboard({ dealerId: state.selectedDealerId || undefined });
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not initialize dealer dashboard", "error");
    }
  }

  init();
})();
