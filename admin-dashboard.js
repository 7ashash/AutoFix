(async function () {
  const authApi = window.AutoFixAuth;
  if (!authApi?.apiFetch) {
    return;
  }

  const cachedUser = authApi.getUser();
  const freshUser = await authApi.refreshSessionUser();
  const viewer = freshUser || cachedUser;

  if (!authApi.getToken() || !viewer) {
    window.location.href = "signin.html";
    return;
  }

  if (!authApi.requireRoleAccess({ admin: true }, viewer)) {
    return;
  }

  const PERMISSION_OPTIONS = [
    { key: "inventory", label: "Inventory" },
    { key: "orders", label: "Orders" },
    { key: "verification", label: "Verification" },
    { key: "analytics", label: "Analytics" }
  ];

  const ORDER_STATUS_OPTIONS = [
    { value: "pending", label: "Pending" },
    { value: "confirmed", label: "Confirmed" },
    { value: "preparing", label: "Preparing" },
    { value: "shipped", label: "Shipped" },
    { value: "delivered", label: "Delivered" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" }
  ];

  const elements = {
    viewLinks: Array.from(document.querySelectorAll("[data-admin-view-link]")),
    views: Array.from(document.querySelectorAll("[data-admin-view]")),
    heroUsersCount: document.getElementById("heroUsersCount"),
    heroDealersCount: document.getElementById("heroDealersCount"),
    heroNetworksCount: document.getElementById("heroNetworksCount"),
    heroOrdersCount: document.getElementById("heroOrdersCount"),
    kpiUsers: document.getElementById("kpiUsers"),
    kpiDealers: document.getElementById("kpiDealers"),
    kpiProducts: document.getElementById("kpiProducts"),
    kpiOrders: document.getElementById("kpiOrders"),
    kpiNetworks: document.getElementById("kpiNetworks"),
    kpiPending: document.getElementById("kpiPending"),
    kpiLowStock: document.getElementById("kpiLowStock"),
    notificationsCount: document.getElementById("adminNotificationsCount"),
    notificationsList: document.getElementById("adminNotificationsList"),
    activityList: document.getElementById("adminActivityList"),
    requestsCount: document.getElementById("adminRequestsCount"),
    requestsList: document.getElementById("adminRequestsList"),
    usersCount: document.getElementById("adminUsersCount"),
    renderedUsersCount: document.getElementById("adminRenderedUsersCount"),
    usersBody: document.getElementById("adminUsersBody"),
    userSearch: document.getElementById("adminUserSearch"),
    selectedUserId: document.getElementById("adminSelectedUserId"),
    selectedUserSummary: document.getElementById("adminSelectedUserSummary"),
    accessForm: document.getElementById("adminAccessForm"),
    emailInput: document.getElementById("adminEmailInput"),
    roleSelect: document.getElementById("adminRoleSelect"),
    statusSelect: document.getElementById("adminStatusSelect"),
    assignmentsSection: document.getElementById("adminAssignmentsSection"),
    assignmentRows: document.getElementById("adminAssignmentRows"),
    addAssignmentBtn: document.getElementById("adminAddAssignmentBtn"),
    resetAccessBtn: document.getElementById("adminResetAccessBtn"),
    accessFeedback: document.getElementById("adminAccessFeedback"),
    dealerNetworkList: document.getElementById("adminDealerNetworkList"),
    networksCount: document.getElementById("adminNetworksCount"),
    dealerForm: document.getElementById("adminDealerForm"),
    dealerId: document.getElementById("adminDealerId"),
    dealerName: document.getElementById("adminDealerName"),
    dealerSlug: document.getElementById("adminDealerSlug"),
    dealerLocation: document.getElementById("adminDealerLocation"),
    dealerContactEmail: document.getElementById("adminDealerContactEmail"),
    dealerContactPhone: document.getElementById("adminDealerContactPhone"),
    dealerDescription: document.getElementById("adminDealerDescription"),
    dealerActive: document.getElementById("adminDealerActive"),
    dealerBrandSelector: document.getElementById("adminDealerBrandSelector"),
    dealerModelsPreview: document.getElementById("adminDealerModelsPreview"),
    dealerFeedback: document.getElementById("adminDealerFeedback"),
    dealerResetBtn: document.getElementById("adminDealerResetBtn"),
    dealerDeleteBtn: document.getElementById("adminDealerDeleteBtn"),
    workspaceGrid: document.getElementById("adminDealerWorkspaceGrid"),
    productsCount: document.getElementById("adminProductsCount"),
    productsList: document.getElementById("adminProductsList"),
    productSearch: document.getElementById("adminProductSearch"),
    productDealerFilter: document.getElementById("adminProductDealerFilter"),
    productBrandFilter: document.getElementById("adminProductBrandFilter"),
    productForm: document.getElementById("adminProductForm"),
    productId: document.getElementById("adminProductId"),
    productName: document.getElementById("adminProductName"),
    productPartNumber: document.getElementById("adminProductPartNumber"),
    productSerial: document.getElementById("adminProductSerial"),
    productManufacturer: document.getElementById("adminProductManufacturer"),
    productType: document.getElementById("adminProductType"),
    productCategory: document.getElementById("adminProductCategory"),
    productPrice: document.getElementById("adminProductPrice"),
    productStock: document.getElementById("adminProductStock"),
    productWarranty: document.getElementById("adminProductWarranty"),
    productActive: document.getElementById("adminProductActive"),
    productDescription: document.getElementById("adminProductDescription"),
    productFeedback: document.getElementById("adminProductFeedback"),
    productResetBtn: document.getElementById("adminProductResetBtn"),
    productDeleteBtn: document.getElementById("adminProductDeleteBtn"),
    ordersCount: document.getElementById("adminOrdersCount"),
    orderSearch: document.getElementById("adminOrderSearch"),
    ordersList: document.getElementById("adminOrdersList"),
    orderDetail: document.getElementById("adminOrderDetail"),
    inventoryCount: document.getElementById("adminInventoryCount"),
    inventoryList: document.getElementById("adminInventoryList"),
    inventoryAdjustForm: document.getElementById("adminInventoryAdjustForm"),
    inventoryPart: document.getElementById("adminInventoryPart"),
    inventoryDelta: document.getElementById("adminInventoryDelta"),
    inventoryReplace: document.getElementById("adminInventoryReplace"),
    inventoryNote: document.getElementById("adminInventoryNote"),
    inventoryFeedback: document.getElementById("adminInventoryFeedback"),
    inventoryResetBtn: document.getElementById("adminInventoryResetBtn")
  };

  const state = {
    dashboard: null,
    activeView: "overview",
    filters: {
      userSearch: "",
      productSearch: "",
      productDealerId: "all",
      productBrandKey: "all",
      orderSearch: ""
    },
    selectedUserId: "",
    selectedNetworkId: "",
    selectedProductId: "",
    selectedOrderId: "",
    accessDraft: createAccessDraft(),
    networkDraft: createNetworkDraft()
  };

  function createAccessDraft() {
    return {
      userId: "",
      email: "",
      role: "user",
      accessStatus: "active",
      assignments: []
    };
  }

  function createNetworkDraft() {
    return {
      id: "",
      name: "",
      slug: "",
      location: "",
      contactEmail: "",
      contactPhone: "",
      description: "",
      isActive: true,
      brandKeys: []
    };
  }

  function makeAssignment(dealerId = "") {
    const dealer = getDealerById(dealerId || state.dashboard?.dealerCoverage?.[0]?.id || "");
    return {
      key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dealerId: dealer ? String(dealer.id) : "",
      accessStatus: "active",
      permissionScope: PERMISSION_OPTIONS.map((item) => item.key),
      brandKeys: dealer ? dealer.brands.map((brand) => brand.key) : []
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    return String(value ?? "").trim();
  }

  function formatMoney(value) {
    return `${Number(value || 0).toLocaleString("en-US")} EGP`;
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatStatus(status) {
    return {
      active: "Active",
      pending_approval: "Pending approval",
      suspended: "Suspended",
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      confirmed: "Confirmed",
      preparing: "Preparing",
      shipped: "Shipped",
      delivered: "Delivered",
      completed: "Completed",
      cancelled: "Cancelled"
    }[status] || status;
  }

  function statusClass(status) {
    if (["active", "approved", "completed", "delivered"].includes(status)) return "admin-status admin-status--active";
    if (["suspended", "rejected", "cancelled"].includes(status)) return "admin-status admin-status--suspended";
    return "admin-status admin-status--pending";
  }

  function getUserById(userId) {
    return state.dashboard?.assignments?.find((item) => String(item.id) === String(userId)) || null;
  }

  function getUserByEmail(email) {
    const normalized = normalizeText(email).toLowerCase();
    return state.dashboard?.assignments?.find((item) => item.email.toLowerCase() === normalized) || null;
  }

  function getDealerById(dealerId) {
    return state.dashboard?.dealerCoverage?.find((item) => String(item.id) === String(dealerId)) || null;
  }

  function getDealerBySlug(slug) {
    return state.dashboard?.dealerCoverage?.find((item) => item.slug === slug) || null;
  }

  function getProductById(partId) {
    return state.dashboard?.products?.find((item) => String(item.id) === String(partId)) || null;
  }

  function getOrderById(orderId) {
    return state.dashboard?.orders?.find((item) => String(item.id) === String(orderId)) || null;
  }

  function getBrandCatalog() {
    return state.dashboard?.brands || [];
  }

  function getCategoryCatalog() {
    const categoryMap = new Map();
    for (const product of state.dashboard?.products || []) {
      if (product.categoryId) {
        categoryMap.set(product.categoryId, {
          id: Number(product.categoryId),
          key: product.categoryKey || "",
          name: product.categoryName || "Uncategorized"
        });
      }
    }
    return Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  function showFeedback(element, message) {
    if (element) {
      element.textContent = message;
    }
  }

  function setActiveView(viewKey) {
    state.activeView = viewKey || "overview";
    elements.viewLinks.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("data-admin-view-link") === state.activeView);
    });
    elements.views.forEach((view) => {
      view.classList.toggle("is-active", view.getAttribute("data-admin-view") === state.activeView);
    });
  }

  function handleAccessError(error) {
    if (error?.statusCode === 401) {
      authApi.clearSession();
      window.location.href = "signin.html";
      return true;
    }

    if (error?.statusCode === 403) {
      window.location.href = "index.html";
      return true;
    }

    return false;
  }

  async function request(path, options = {}) {
    try {
      return await authApi.apiFetch(path, options);
    } catch (error) {
      if (handleAccessError(error)) {
        return null;
      }
      throw error;
    }
  }

  function getFilteredUsers() {
    const search = state.filters.userSearch.toLowerCase();
    return (state.dashboard?.assignments || []).filter((user) => {
      if (!search) return true;
      return (
        user.fullName?.toLowerCase().includes(search) ||
        user.email?.toLowerCase().includes(search) ||
        user.savedVehicle?.label?.toLowerCase().includes(search)
      );
    });
  }

  function getFilteredProducts() {
    const search = state.filters.productSearch.toLowerCase();
    const dealerId = state.filters.productDealerId;
    const brandKey = state.filters.productBrandKey;

    return (state.dashboard?.products || []).filter((product) => {
      if (dealerId !== "all" && String(product.dealerId) !== String(dealerId)) return false;
      if (brandKey !== "all" && product.brandKey !== brandKey) return false;
      if (!search) return true;
      return [
        product.name,
        product.partNumber,
        product.serialNumber,
        product.categoryName,
        product.dealerName,
        product.fitmentLabel
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }

  function getFilteredOrders() {
    const search = state.filters.orderSearch.toLowerCase();
    return (state.dashboard?.orders || []).filter((order) => {
      if (!search) return true;
      return [
        order.orderNumber,
        order.customerFullName,
        order.userEmail,
        order.city,
        order.dealerNames
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }

  function ensureSelectionState() {
    const users = state.dashboard?.assignments || [];
    if (state.selectedUserId && !getUserById(state.selectedUserId)) {
      state.selectedUserId = "";
    }
    if (!state.selectedUserId && users.length) {
      state.selectedUserId = String(users[0].id);
    }

    const dealers = state.dashboard?.dealerCoverage || [];
    if (state.selectedNetworkId && !getDealerById(state.selectedNetworkId)) {
      state.selectedNetworkId = "";
    }

    const products = state.dashboard?.products || [];
    if (state.selectedProductId && !getProductById(state.selectedProductId)) {
      state.selectedProductId = "";
    }

    const orders = state.dashboard?.orders || [];
    if (state.selectedOrderId && !getOrderById(state.selectedOrderId)) {
      state.selectedOrderId = "";
    }

    if (!state.accessDraft.email && state.selectedUserId) {
      fillAccessDraft(getUserById(state.selectedUserId));
    } else if (state.accessDraft.userId && !getUserById(state.accessDraft.userId)) {
      fillAccessDraft(getUserById(state.selectedUserId));
    }

    if (state.networkDraft.id && !getDealerById(state.networkDraft.id)) {
      fillNetworkDraft(getDealerById(state.selectedNetworkId));
    }
  }

  function fillAccessDraft(user) {
    state.selectedUserId = user ? String(user.id) : "";
    if (!user) {
      state.accessDraft = createAccessDraft();
      return;
    }

    state.accessDraft = {
      userId: String(user.id),
      email: user.email,
      role: user.role,
      accessStatus: user.accountStatus || user.accessStatus || "active",
      assignments: (user.dealerAssignments || []).map((assignment) => ({
        key: `${user.id}-${assignment.dealerId}-${Math.random().toString(36).slice(2, 7)}`,
        dealerId: String(assignment.dealerId),
        accessStatus: assignment.accessStatus || "active",
        permissionScope: [...(assignment.permissionScope || [])],
        brandKeys: [...(assignment.allowedBrandKeys || [])]
      }))
    };

    if (state.accessDraft.role === "dealer" && !state.accessDraft.assignments.length) {
      state.accessDraft.assignments = [makeAssignment()];
    }
  }

  function fillNetworkDraft(dealer) {
    state.selectedNetworkId = dealer ? String(dealer.id) : "";

    if (!dealer) {
      state.networkDraft = createNetworkDraft();
      return;
    }

    state.networkDraft = {
      id: String(dealer.id),
      name: dealer.name || "",
      slug: dealer.slug || "",
      location: dealer.location || "",
      contactEmail: dealer.contactEmail || "",
      contactPhone: dealer.contactPhone || "",
      description: dealer.description || "",
      isActive: Boolean(dealer.isActive),
      brandKeys: (dealer.brands || []).map((brand) => brand.key)
    };
  }

  function fillProductDraft(product) {
    state.selectedProductId = product ? String(product.id) : "";
    if (!product) {
      elements.productForm.reset();
      elements.productId.value = "";
      elements.productActive.checked = true;
      elements.productDeleteBtn.hidden = true;
      showFeedback(elements.productFeedback, "Choose any product from the list, then review or archive it.");
      return;
    }

    elements.productId.value = String(product.id);
    elements.productName.value = product.name || "";
    elements.productPartNumber.value = product.partNumber || "";
    elements.productSerial.value = product.serialNumber || "";
    elements.productManufacturer.value = product.manufacturerName || "";
    elements.productType.value = product.partType || "original";
    elements.productCategory.value = product.categoryId ? String(product.categoryId) : "";
    elements.productPrice.value = Number(product.price || 0);
    elements.productStock.value = Number(product.stockQuantity || 0);
    elements.productWarranty.value = Number(product.warrantyMonths || 0) || "";
    elements.productActive.checked = Boolean(product.active);
    elements.productDescription.value = product.description || "";
    elements.productDeleteBtn.hidden = false;
    showFeedback(elements.productFeedback, `Editing ${product.name} for ${product.dealerName}.`);
  }

  function fillInventoryPart(partId) {
    elements.inventoryPart.value = String(partId || "");
  }

  function renderKpis() {
    const kpis = state.dashboard?.kpis || {};
    elements.heroUsersCount.textContent = String(kpis.totalAccounts || 0);
    elements.heroDealersCount.textContent = String(kpis.dealerAccounts || 0);
    elements.heroNetworksCount.textContent = String(kpis.dealerNetworks || 0);
    elements.heroOrdersCount.textContent = String(kpis.totalOrders || 0);

    elements.kpiUsers.textContent = String(kpis.totalAccounts || 0);
    elements.kpiDealers.textContent = String(kpis.dealerAccounts || 0);
    elements.kpiProducts.textContent = String(kpis.totalProducts || 0);
    elements.kpiOrders.textContent = String(kpis.totalOrders || 0);
    elements.kpiNetworks.textContent = String(kpis.dealerNetworks || 0);
    elements.kpiPending.textContent = String(kpis.pendingApprovals || 0);
    elements.kpiLowStock.textContent = String(kpis.lowStockItems || 0);
  }

  function renderNotifications() {
    const notifications = state.dashboard?.notifications || [];
    elements.notificationsCount.textContent = `${notifications.length} alerts`;

    if (!notifications.length) {
      elements.notificationsList.innerHTML = `<div class="admin-empty">No admin alerts right now. New dealer requests, low-stock warnings, and new orders will appear here.</div>`;
      return;
    }

    elements.notificationsList.innerHTML = notifications.map((item) => `
      <article class="admin-notification">
        <div class="admin-notification__top">
          <div>
            <span class="admin-chip admin-chip--soft">${escapeHtml(item.type || "alert")}</span>
            <h3>${escapeHtml(item.title || "Alert")}</h3>
          </div>
          <time class="admin-helper">${formatDateTime(item.createdAt)}</time>
        </div>
        <p>${escapeHtml(item.message || "")}</p>
      </article>
    `).join("");
  }

  function renderActivity() {
    const items = state.dashboard?.recentActivity || [];
    if (!items.length) {
      elements.activityList.innerHTML = `<div class="admin-empty">Admin actions will appear here as soon as the dashboard starts managing users, dealers, products, or orders.</div>`;
      return;
    }

    elements.activityList.innerHTML = items.map((item) => `
      <article class="admin-activity-item">
        <div class="admin-activity-item__top">
          <strong>${escapeHtml(item.message)}</strong>
          <time class="admin-helper">${formatDateTime(item.createdAt)}</time>
        </div>
      </article>
    `).join("");
  }

  function renderRequests() {
    const requests = state.dashboard?.pendingRequests || [];
    elements.requestsCount.textContent = `${requests.length} pending`;

    if (!requests.length) {
      elements.requestsList.innerHTML = `<div class="admin-empty">No pending dealer requests right now.</div>`;
      return;
    }

    elements.requestsList.innerHTML = requests.map((request) => `
      <article class="admin-request-card">
        <div class="admin-request-card__top">
          <div>
            <span class="${statusClass(request.status)}">${escapeHtml(formatStatus(request.status))}</span>
            <h3>${escapeHtml(request.requester.fullName)}</h3>
          </div>
          <time class="admin-helper">${formatDateTime(request.createdAt)}</time>
        </div>
        <p>${escapeHtml(request.note || "Dealer access request is waiting for admin review.")}</p>
        <div class="admin-meta-row">
          <span class="admin-mini-chip">${escapeHtml(request.requester.email)}</span>
          <span class="admin-mini-chip">${escapeHtml(request.dealer.name)}</span>
          ${request.requestedBrands.map((brand) => `<span class="admin-mini-chip">${escapeHtml(brand.name)}</span>`).join("")}
        </div>
        <div class="admin-request-card__actions">
          <button class="admin-action-btn" type="button" data-request-action="approve" data-request-id="${request.id}">Approve</button>
          <button class="admin-danger-btn" type="button" data-request-action="reject" data-request-id="${request.id}">Reject</button>
          <button class="admin-secondary-btn" type="button" data-request-action="load" data-request-email="${escapeHtml(request.requester.email)}">Load in studio</button>
        </div>
      </article>
    `).join("");
  }

  function renderUsers() {
    const users = getFilteredUsers();
    elements.usersCount.textContent = `${(state.dashboard?.assignments || []).length} accounts`;
    elements.renderedUsersCount.textContent = `${users.length} shown`;

    if (!users.length) {
      elements.usersBody.innerHTML = `<tr><td colspan="6"><div class="admin-empty">No users matched your search.</div></td></tr>`;
      return;
    }

    elements.usersBody.innerHTML = users.map((user) => {
      const dealerScope = user.dealerAssignments?.length
        ? user.dealerAssignments.map((assignment) => `<span class="admin-mini-chip">${escapeHtml(assignment.dealerName)}</span>`).join("")
        : `<span class="admin-mini-chip">No dealer scope</span>`;

      const vehicle = user.savedVehicle?.label
        ? escapeHtml(user.savedVehicle.label)
        : "No saved vehicle";

      const actions = [
        `<button class="admin-secondary-btn" type="button" data-user-action="load" data-user-id="${user.id}">Load</button>`,
        `<button class="${user.accountStatus === "suspended" ? "admin-primary-btn" : "admin-secondary-btn"}" type="button" data-user-action="toggle-status" data-user-id="${user.id}" data-next-status="${user.accountStatus === "suspended" ? "active" : "suspended"}">${user.accountStatus === "suspended" ? "Activate" : "Suspend"}</button>`,
        `<button class="admin-danger-btn" type="button" data-user-action="delete" data-user-id="${user.id}">Delete</button>`
      ];

      if (user.dashboardAccess?.dealer || user.dashboardAccess?.admin) {
        actions.push(`<a class="admin-link-btn" href="dealer-dashboard.html${user.dealerAssignments?.[0]?.dealerId ? `?dealerId=${encodeURIComponent(user.dealerAssignments[0].dealerId)}` : ""}">Open workspace</a>`);
      }

      return `
        <tr>
          <td>
            <strong>${escapeHtml(user.fullName)}</strong>
            <small>${escapeHtml(user.email)}</small>
          </td>
          <td>${vehicle}</td>
          <td><span class="admin-mini-chip">${escapeHtml(user.role)}</span></td>
          <td><div class="admin-inline-chips">${dealerScope}</div></td>
          <td><span class="${statusClass(user.accountStatus)}">${escapeHtml(formatStatus(user.accountStatus))}</span></td>
          <td><div class="admin-actions">${actions.join("")}</div></td>
        </tr>
      `;
    }).join("");
  }

  function renderSelectedUserSummary() {
    const draft = state.accessDraft;
    if (!draft.email) {
      elements.selectedUserSummary.innerHTML = `<div class="admin-empty">Load any registered account by email or from the users table to edit its role and dealer assignments.</div>`;
      return;
    }

    const user = getUserById(draft.userId);
    const vehicle = user?.savedVehicle?.label || "No saved vehicle";
    const scopeCount = draft.assignments.length;

    elements.selectedUserSummary.innerHTML = `
      <div class="admin-user-summary__top">
        <div>
          <span class="admin-chip admin-chip--soft">Selected account</span>
          <h3 class="admin-user-summary__title">${escapeHtml(user?.fullName || draft.email)}</h3>
        </div>
        <span class="${statusClass(draft.accessStatus)}">${escapeHtml(formatStatus(draft.accessStatus))}</span>
      </div>
      <p>${escapeHtml(draft.email)}</p>
      <div class="admin-meta-row">
        <span class="admin-mini-chip">${escapeHtml(draft.role)}</span>
        <span class="admin-mini-chip">${escapeHtml(vehicle)}</span>
        <span class="admin-mini-chip">${scopeCount} network scope(s)</span>
      </div>
    `;
  }

  function getDealerOptionsMarkup(selectedDealerId = "") {
    return (state.dashboard?.dealerCoverage || [])
      .map((dealer) => `<option value="${dealer.id}" ${String(dealer.id) === String(selectedDealerId) ? "selected" : ""}>${escapeHtml(dealer.name)}</option>`)
      .join("");
  }

  function getBrandCheckboxMarkup(dealerId, selectedKeys = [], rowKey) {
    const dealer = getDealerById(dealerId);
    if (!dealer) {
      return `<div class="admin-empty">Choose a dealer network first.</div>`;
    }

    return dealer.brands.map((brand) => `
      <label class="admin-check-pill">
        <input type="checkbox" data-assignment-brand="${rowKey}" value="${brand.key}" ${selectedKeys.includes(brand.key) ? "checked" : ""} />
        <span>${escapeHtml(brand.name)}</span>
      </label>
    `).join("");
  }

  function getPermissionMarkup(row) {
    return PERMISSION_OPTIONS.map((permission) => `
      <label class="admin-permission">
        <input type="checkbox" data-assignment-permission="${row.key}" value="${permission.key}" ${row.permissionScope.includes(permission.key) ? "checked" : ""} />
        <span>${permission.label}</span>
      </label>
    `).join("");
  }

  function renderAssignmentRows() {
    const isDealer = state.accessDraft.role === "dealer";
    elements.assignmentsSection.hidden = !isDealer;
    if (!isDealer) {
      elements.assignmentRows.innerHTML = "";
      return;
    }

    if (!state.accessDraft.assignments.length) {
      state.accessDraft.assignments = [makeAssignment()];
    }

    elements.assignmentRows.innerHTML = state.accessDraft.assignments.map((row, index) => `
      <article class="admin-assignment-card" data-assignment-row="${row.key}">
        <div class="admin-assignment-card__top">
          <div>
            <span class="admin-chip admin-chip--soft">Assignment ${index + 1}</span>
            <h3>${escapeHtml(getDealerById(row.dealerId)?.name || "Choose network")}</h3>
          </div>
          <button class="admin-danger-btn" type="button" data-assignment-action="remove" data-assignment-key="${row.key}" ${state.accessDraft.assignments.length === 1 ? "disabled" : ""}>Remove</button>
        </div>
        <div class="admin-assignment-card__body">
          <div class="admin-form__grid">
            <label class="admin-field">
              <span>Dealer network</span>
              <select class="admin-select" data-assignment-dealer="${row.key}">
                ${getDealerOptionsMarkup(row.dealerId)}
              </select>
            </label>
            <label class="admin-field">
              <span>Access status</span>
              <select class="admin-select" data-assignment-status="${row.key}">
                <option value="active" ${row.accessStatus === "active" ? "selected" : ""}>Active</option>
                <option value="pending_approval" ${row.accessStatus === "pending_approval" ? "selected" : ""}>Pending approval</option>
                <option value="suspended" ${row.accessStatus === "suspended" ? "selected" : ""}>Suspended</option>
              </select>
            </label>
          </div>
          <div>
            <span class="admin-helper">Permissions</span>
            <div class="admin-permission-grid">${getPermissionMarkup(row)}</div>
          </div>
          <div>
            <span class="admin-helper">Brand coverage inside this network</span>
            <div class="admin-check-grid">${getBrandCheckboxMarkup(row.dealerId, row.brandKeys, row.key)}</div>
          </div>
        </div>
      </article>
    `).join("");
  }

  function renderAccessStudio() {
    elements.selectedUserId.value = state.accessDraft.userId || "";
    elements.emailInput.value = state.accessDraft.email || "";
    elements.roleSelect.value = state.accessDraft.role || "user";
    elements.statusSelect.value = state.accessDraft.accessStatus || "active";
    renderSelectedUserSummary();
    renderAssignmentRows();
  }

  function renderNetworks() {
    const networks = state.dashboard?.dealerCoverage || [];
    elements.networksCount.textContent = `${networks.length} networks`;

    if (!networks.length) {
      elements.dealerNetworkList.innerHTML = `<div class="admin-empty">No dealer networks configured yet.</div>`;
      return;
    }

    elements.dealerNetworkList.innerHTML = networks.map((dealer) => {
      const models = getBrandCatalog()
        .filter((brand) => dealer.brands.some((item) => item.key === brand.key))
        .flatMap((brand) => brand.models.map((model) => model.name));

      return `
        <article class="admin-network-card">
          <div class="admin-network-card__top">
            <div>
              <span class="admin-chip admin-chip--soft">${dealer.isActive ? "active" : "archived"}</span>
              <h3>${escapeHtml(dealer.name)}</h3>
            </div>
            <span class="admin-badge">${dealer.assignedAccounts} dealer account(s)</span>
          </div>
          <p>${escapeHtml(dealer.description || "Official AutoFix dealer network.")}</p>
          <div class="admin-meta-row">
            <span class="admin-mini-chip">${escapeHtml(dealer.location || "Egypt")}</span>
            <span class="admin-mini-chip">${dealer.totalProducts} products</span>
            <span class="admin-mini-chip">${dealer.lowStockItems} low stock</span>
          </div>
          <div class="admin-chip-row">
            ${dealer.brands.map((brand) => `<span class="admin-mini-chip">${escapeHtml(brand.name)}</span>`).join("")}
          </div>
          <div class="admin-chip-row">
            ${models.slice(0, 6).map((model) => `<span class="admin-mini-chip">${escapeHtml(model)}</span>`).join("")}
            ${models.length > 6 ? `<span class="admin-mini-chip">+${models.length - 6} more models</span>` : ""}
          </div>
          <div class="admin-actions">
            <button class="admin-secondary-btn" type="button" data-network-action="edit" data-network-id="${dealer.id}">Edit</button>
            <a class="admin-link-btn" href="dealer-dashboard.html?dealerId=${encodeURIComponent(dealer.id)}">Open dashboard</a>
            <button class="admin-danger-btn" type="button" data-network-action="delete" data-network-id="${dealer.id}">${dealer.isActive ? "Delete / archive" : "Delete permanently"}</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderDealerBrandSelector() {
    const selectedKeys = state.networkDraft.brandKeys || [];
    elements.dealerBrandSelector.innerHTML = getBrandCatalog().map((brand) => `
      <label class="admin-check-pill">
        <input type="checkbox" data-dealer-brand="${brand.key}" value="${brand.key}" ${selectedKeys.includes(brand.key) ? "checked" : ""} />
        <span>${escapeHtml(brand.name)}</span>
      </label>
    `).join("");
  }

  function renderDealerModelsPreview() {
    const selectedBrands = getBrandCatalog().filter((brand) => state.networkDraft.brandKeys.includes(brand.key));

    if (!selectedBrands.length) {
      elements.dealerModelsPreview.innerHTML = `<div class="admin-empty">Pick one or more brands and the available car models will appear here.</div>`;
      return;
    }

    elements.dealerModelsPreview.innerHTML = selectedBrands.map((brand) => `
      <article class="admin-model-group">
        <h4>${escapeHtml(brand.name)}</h4>
        <div class="admin-model-list">
          ${brand.models.map((model) => `<span class="admin-mini-chip">${escapeHtml(model.name)}</span>`).join("")}
        </div>
      </article>
    `).join("");
  }

  function renderDealerForm() {
    elements.dealerId.value = state.networkDraft.id || "";
    elements.dealerName.value = state.networkDraft.name || "";
    elements.dealerSlug.value = state.networkDraft.slug || "";
    elements.dealerLocation.value = state.networkDraft.location || "";
    elements.dealerContactEmail.value = state.networkDraft.contactEmail || "";
    elements.dealerContactPhone.value = state.networkDraft.contactPhone || "";
    elements.dealerDescription.value = state.networkDraft.description || "";
    elements.dealerActive.checked = Boolean(state.networkDraft.isActive);
    elements.dealerDeleteBtn.hidden = !state.networkDraft.id;
    renderDealerBrandSelector();
    renderDealerModelsPreview();
  }

  function renderWorkspaces() {
    const dealers = state.dashboard?.dealerCoverage || [];
    if (!dealers.length) {
      elements.workspaceGrid.innerHTML = `<div class="admin-empty">Dealer workspaces will appear once at least one dealer network exists.</div>`;
      return;
    }

    elements.workspaceGrid.innerHTML = dealers.map((dealer) => `
      <article class="admin-workspace-card">
        <div class="admin-workspace-card__top">
          <div>
            <span class="admin-chip admin-chip--soft">${dealer.isActive ? "active" : "archived"}</span>
            <h3>${escapeHtml(dealer.name)}</h3>
          </div>
          <span class="admin-badge">${dealer.assignedAccounts} dealer(s)</span>
        </div>
        <p>${escapeHtml(dealer.description || "Open the full dealer workspace and manage products or orders on behalf of this dealer.")}</p>
        <div class="admin-meta-row">
          <span class="admin-mini-chip">${dealer.totalProducts} products</span>
          <span class="admin-mini-chip">${dealer.lowStockItems} low stock</span>
          ${dealer.brands.map((brand) => `<span class="admin-mini-chip">${escapeHtml(brand.name)}</span>`).join("")}
        </div>
        <div class="admin-actions">
          <a class="admin-link-btn" href="dealer-dashboard.html?dealerId=${encodeURIComponent(dealer.id)}">Open dealer dashboard</a>
          <button class="admin-secondary-btn" type="button" data-network-action="edit" data-network-id="${dealer.id}">Edit network</button>
        </div>
      </article>
    `).join("");
  }

  function renderProductFilters() {
    const dealerOptions = [`<option value="all">All dealers</option>`]
      .concat((state.dashboard?.dealerCoverage || []).map((dealer) => `<option value="${dealer.id}" ${String(dealer.id) === state.filters.productDealerId ? "selected" : ""}>${escapeHtml(dealer.name)}</option>`));
    elements.productDealerFilter.innerHTML = dealerOptions.join("");

    const brandOptions = [`<option value="all">All brands</option>`]
      .concat(getBrandCatalog().map((brand) => `<option value="${brand.key}" ${brand.key === state.filters.productBrandKey ? "selected" : ""}>${escapeHtml(brand.name)}</option>`));
    elements.productBrandFilter.innerHTML = brandOptions.join("");

    const categories = getCategoryCatalog();
    elements.productCategory.innerHTML = [`<option value="">Optional category</option>`]
      .concat(categories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`))
      .join("");
  }

  function renderProducts() {
    const products = getFilteredProducts();
    elements.productsCount.textContent = `${products.length} products`;

    if (!products.length) {
      elements.productsList.innerHTML = `<div class="admin-empty">No products matched the current filters.</div>`;
      return;
    }

    elements.productsList.innerHTML = products.map((product) => `
      <article class="admin-product-card">
        <div class="admin-product-card__top">
          <div>
            <span class="admin-chip admin-chip--soft">${escapeHtml(product.dealerName)}</span>
            <h3>${escapeHtml(product.name)}</h3>
          </div>
          <span class="${product.active ? "admin-status admin-status--active" : "admin-status admin-status--suspended"}">${product.active ? "Active" : "Archived"}</span>
        </div>
        <p>${escapeHtml(product.fitmentLabel || `${product.brandName} fitment-ready product`)}</p>
        <div class="admin-meta-row">
          <span class="admin-mini-chip">${escapeHtml(product.partNumber || "No part number")}</span>
          <span class="admin-mini-chip">${formatMoney(product.price)}</span>
          <span class="admin-mini-chip">${product.stockQuantity} in stock</span>
          <span class="admin-mini-chip">${escapeHtml(product.categoryName || "Uncategorized")}</span>
        </div>
        <div class="admin-actions">
          <button class="admin-secondary-btn" type="button" data-product-action="edit" data-product-id="${product.id}">Edit</button>
          <a class="admin-link-btn" href="dealer-dashboard.html?dealerId=${encodeURIComponent(product.dealerId)}">Open dealer</a>
          <button class="admin-danger-btn" type="button" data-product-action="delete" data-product-id="${product.id}">Delete / archive</button>
        </div>
      </article>
    `).join("");
  }

  function renderOrders() {
    const orders = getFilteredOrders();
    elements.ordersCount.textContent = `${orders.length} orders`;

    if (!orders.length) {
      elements.ordersList.innerHTML = `<div class="admin-empty">No orders matched the current search.</div>`;
      state.selectedOrderId = "";
      renderOrderDetail();
      return;
    }

    if (!state.selectedOrderId) {
      state.selectedOrderId = String(orders[0].id);
    }

    elements.ordersList.innerHTML = orders.map((order) => `
      <article class="admin-order-card">
        <div class="admin-order-card__top">
          <div>
            <span class="${statusClass(order.status)}">${escapeHtml(formatStatus(order.status))}</span>
            <h3>${escapeHtml(order.orderNumber)}</h3>
          </div>
          <button class="admin-secondary-btn" type="button" data-order-action="select" data-order-id="${order.id}">Open</button>
        </div>
        <p>${escapeHtml(order.customerFullName)} · ${escapeHtml(order.userEmail)} · ${escapeHtml(order.city)}</p>
        <div class="admin-meta-row">
          <span class="admin-mini-chip">${formatMoney(order.totalAmount)}</span>
          <span class="admin-mini-chip">${order.lineItems} line(s)</span>
          <span class="admin-mini-chip">${escapeHtml(order.dealerNames || "No dealer")}</span>
        </div>
      </article>
    `).join("");

    renderOrderDetail();
  }

  function renderOrderDetail() {
    const order = getOrderById(state.selectedOrderId);
    if (!order) {
      elements.orderDetail.innerHTML = `<div class="admin-empty">Choose an order from the list to review its details and update its status.</div>`;
      return;
    }

    elements.orderDetail.innerHTML = `
      <form id="adminOrderForm" class="admin-order-detail__panel">
        <div class="admin-order-card__top">
          <div>
            <span class="${statusClass(order.status)}">${escapeHtml(formatStatus(order.status))}</span>
            <h3>${escapeHtml(order.orderNumber)}</h3>
          </div>
          <span class="admin-badge">${formatDateTime(order.createdAt)}</span>
        </div>
        <p>${escapeHtml(order.customerFullName)} · ${escapeHtml(order.phone)} · ${escapeHtml(order.addressLine)}, ${escapeHtml(order.city)}</p>
        <div class="admin-meta-row">
          <span class="admin-mini-chip">${escapeHtml(order.fulfillmentMethod)}</span>
          <span class="admin-mini-chip">${escapeHtml(order.paymentMethod)}</span>
          <span class="admin-mini-chip">${formatMoney(order.subtotal)} subtotal</span>
          <span class="admin-mini-chip">${formatMoney(order.totalAmount)} total</span>
        </div>
        <p>${escapeHtml(order.dealerNames || "No dealer attached yet")}</p>
        <div class="admin-form__grid">
          <label class="admin-field">
            <span>Status</span>
            <select id="adminOrderStatus" class="admin-select">
              ${ORDER_STATUS_OPTIONS.map((option) => `<option value="${option.value}" ${option.value === order.status ? "selected" : ""}>${option.label}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="admin-form__footer">
          <p class="admin-helper">Update the status of the full order from here. The status will also cascade to the order items behind the scenes.</p>
          <div class="admin-actions">
            <button class="admin-primary-btn" type="submit">Save order status</button>
          </div>
        </div>
      </form>
    `;
  }

  function renderInventory() {
    const items = state.dashboard?.lowStock || [];
    elements.inventoryCount.textContent = `${items.length} low-stock items`;

    if (!items.length) {
      elements.inventoryList.innerHTML = `<div class="admin-empty">No low-stock products right now.</div>`;
    } else {
      elements.inventoryList.innerHTML = items.map((item) => `
        <article class="admin-low-stock-card">
          <div class="admin-low-stock-card__top">
            <div>
              <span class="admin-chip admin-chip--soft">${escapeHtml(item.dealerName)}</span>
              <h3>${escapeHtml(item.name)}</h3>
            </div>
            <span class="${statusClass("pending")}">${item.stockQuantity} left</span>
          </div>
          <p>${escapeHtml(item.partNumber)} · ${escapeHtml(item.brandName)}</p>
          <div class="admin-actions">
            <button class="admin-secondary-btn" type="button" data-inventory-action="load" data-part-id="${item.id}">Adjust stock</button>
          </div>
        </article>
      `).join("");
    }

    elements.inventoryPart.innerHTML = [`<option value="">Choose product</option>`]
      .concat((state.dashboard?.products || []).map((product) => `<option value="${product.id}">${escapeHtml(product.name)} · ${escapeHtml(product.dealerName)}</option>`))
      .join("");
  }

  function renderAll() {
    ensureSelectionState();
    renderKpis();
    renderNotifications();
    renderActivity();
    renderRequests();
    renderUsers();
    renderAccessStudio();
    renderNetworks();
    renderDealerForm();
    renderWorkspaces();
    renderProductFilters();
    renderProducts();
    if (state.selectedProductId) {
      fillProductDraft(getProductById(state.selectedProductId));
    } else {
      fillProductDraft(null);
    }
    renderOrders();
    renderInventory();
    if (elements.inventoryPart.value === "" && state.selectedProductId) {
      fillInventoryPart(state.selectedProductId);
    }
  }

  async function loadDashboard() {
    showFeedback(elements.accessFeedback, "Loading admin dashboard...");
    try {
      const data = await request("/admin/dashboard");
      if (!data) return;
      state.dashboard = data;
      renderAll();
      showFeedback(elements.accessFeedback, "Choose a registered email, then assign dealer networks and brand coverage.");
    } catch (error) {
      showFeedback(elements.accessFeedback, error.message || "Could not load admin dashboard.");
    }
  }

  async function saveAccess(event) {
    event.preventDefault();

    const email = normalizeText(elements.emailInput.value).toLowerCase();
    if (!email) {
      showFeedback(elements.accessFeedback, "Enter the registered email first.");
      return;
    }

    const payload = {
      email,
      role: elements.roleSelect.value,
      accessStatus: elements.statusSelect.value,
      assignments: elements.roleSelect.value === "dealer"
        ? state.accessDraft.assignments.map((assignment) => ({
            dealerId: Number(assignment.dealerId || 0),
            accessStatus: assignment.accessStatus,
            permissionScope: assignment.permissionScope,
            brandKeys: assignment.brandKeys
          }))
        : []
    };

    if (payload.role === "dealer" && !payload.assignments.length) {
      showFeedback(elements.accessFeedback, "Add at least one dealer network assignment for this dealer.");
      return;
    }

    try {
      showFeedback(elements.accessFeedback, "Saving access...");
      const endpoint = state.accessDraft.userId
        ? `/admin/users/${state.accessDraft.userId}/access`
        : "/admin/dealer-access/assign";
      const method = state.accessDraft.userId ? "PATCH" : "POST";
      const data = await request(endpoint, {
        method,
        body: JSON.stringify(payload)
      });

      if (!data) return;
      state.dashboard = data.dashboard;
      fillAccessDraft(data.user);
      renderAll();
      showFeedback(elements.accessFeedback, `Access saved for ${data.user.fullName}.`);
    } catch (error) {
      showFeedback(elements.accessFeedback, error.message || "Could not save access.");
    }
  }

  async function patchUserStatus(userId, nextStatus) {
    const user = getUserById(userId);
    if (!user) return;

    try {
      const data = await request(`/admin/users/${userId}/access`, {
        method: "PATCH",
        body: JSON.stringify({
          role: user.role,
          accessStatus: nextStatus,
          assignments: (user.dealerAssignments || []).map((assignment) => ({
            dealerId: assignment.dealerId,
            accessStatus: assignment.accessStatus || "active",
            permissionScope: assignment.permissionScope || [],
            brandKeys: assignment.allowedBrandKeys || []
          }))
        })
      });

      if (!data) return;
      state.dashboard = data.dashboard;
      renderAll();
      showFeedback(elements.accessFeedback, `Account status updated to ${formatStatus(nextStatus)}.`);
    } catch (error) {
      showFeedback(elements.accessFeedback, error.message || "Could not update account status.");
    }
  }

  async function deleteUser(userId) {
    try {
      const data = await request(`/admin/users/${userId}`, { method: "DELETE" });
      if (!data) return;
      state.dashboard = data.dashboard;
      if (String(state.selectedUserId) === String(userId)) {
        fillAccessDraft(getUserById(state.dashboard?.assignments?.[0]?.id));
      }
      renderAll();
      showFeedback(elements.accessFeedback, "Account removed or archived successfully.");
    } catch (error) {
      showFeedback(elements.accessFeedback, error.message || "Could not delete account.");
    }
  }

  async function reviewRequest(requestId, decision) {
    try {
      const data = await request(`/admin/dealer-access/requests/${requestId}/review`, {
        method: "POST",
        body: JSON.stringify({ decision })
      });
      if (!data) return;
      state.dashboard = data.dashboard;
      if (data.user) {
        fillAccessDraft(data.user);
      }
      renderAll();
      showFeedback(elements.accessFeedback, decision === "approve" ? "Dealer access request approved." : "Dealer access request rejected.");
    } catch (error) {
      showFeedback(elements.accessFeedback, error.message || "Could not review request.");
    }
  }

  async function saveDealerNetwork(event) {
    event.preventDefault();

    const payload = {
      name: normalizeText(elements.dealerName.value),
      slug: normalizeText(elements.dealerSlug.value),
      location: normalizeText(elements.dealerLocation.value),
      contactEmail: normalizeText(elements.dealerContactEmail.value),
      contactPhone: normalizeText(elements.dealerContactPhone.value),
      description: normalizeText(elements.dealerDescription.value),
      isActive: elements.dealerActive.checked,
      brandKeys: [...state.networkDraft.brandKeys]
    };

    if (!payload.name) {
      showFeedback(elements.dealerFeedback, "Dealer network name is required.");
      return;
    }

    try {
      showFeedback(elements.dealerFeedback, "Saving dealer network...");
      const endpoint = state.networkDraft.id ? `/admin/dealers/${state.networkDraft.id}` : "/admin/dealers";
      const method = state.networkDraft.id ? "PATCH" : "POST";
      const data = await request(endpoint, {
        method,
        body: JSON.stringify(payload)
      });
      if (!data) return;
      state.dashboard = data.dashboard;
      fillNetworkDraft(data.dealer);
      renderAll();
      showFeedback(elements.dealerFeedback, `Dealer network ${data.dealer.name} saved successfully.`);
    } catch (error) {
      showFeedback(elements.dealerFeedback, error.message || "Could not save dealer network.");
    }
  }

  async function deleteDealerNetwork(dealerId) {
    try {
      const data = await request(`/admin/dealers/${dealerId}`, { method: "DELETE" });
      if (!data) return;
      state.dashboard = data.dashboard;
      fillNetworkDraft(null);
      renderAll();
      showFeedback(elements.dealerFeedback, "Dealer network removed or archived successfully.");
    } catch (error) {
      showFeedback(elements.dealerFeedback, error.message || "Could not delete dealer network.");
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    const partId = Number(elements.productId.value || 0);
    if (!partId) {
      showFeedback(elements.productFeedback, "Choose a product from the left list first.");
      return;
    }

    const payload = {
      name: normalizeText(elements.productName.value),
      partNumber: normalizeText(elements.productPartNumber.value),
      serialNumber: normalizeText(elements.productSerial.value),
      manufacturerName: normalizeText(elements.productManufacturer.value),
      partType: elements.productType.value,
      categoryId: elements.productCategory.value ? Number(elements.productCategory.value) : null,
      price: Number(elements.productPrice.value || 0),
      stockQuantity: Number(elements.productStock.value || 0),
      warrantyMonths: Number(elements.productWarranty.value || 0),
      active: elements.productActive.checked,
      description: normalizeText(elements.productDescription.value)
    };

    try {
      showFeedback(elements.productFeedback, "Saving product...");
      const data = await request(`/admin/products/${partId}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      if (!data) return;
      state.dashboard = data.dashboard;
      fillProductDraft(getProductById(partId));
      renderAll();
      showFeedback(elements.productFeedback, "Product updated successfully.");
    } catch (error) {
      showFeedback(elements.productFeedback, error.message || "Could not save product.");
    }
  }

  async function deleteProduct(partId) {
    try {
      const data = await request(`/admin/products/${partId}`, { method: "DELETE" });
      if (!data) return;
      state.dashboard = data.dashboard;
      fillProductDraft(null);
      renderAll();
      showFeedback(elements.productFeedback, "Product deleted or archived successfully.");
    } catch (error) {
      showFeedback(elements.productFeedback, error.message || "Could not delete product.");
    }
  }

  async function saveOrderStatus(event) {
    event.preventDefault();
    const order = getOrderById(state.selectedOrderId);
    if (!order) return;
    const status = document.getElementById("adminOrderStatus")?.value || order.status;

    try {
      const data = await request(`/admin/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      if (!data) return;
      state.dashboard = data.dashboard;
      renderAll();
    } catch (error) {
      const panel = document.querySelector("#adminOrderDetail .admin-helper");
      if (panel) panel.textContent = error.message || "Could not update order.";
    }
  }

  async function adjustInventory(event) {
    event.preventDefault();
    const partId = Number(elements.inventoryPart.value || 0);
    if (!partId) {
      showFeedback(elements.inventoryFeedback, "Choose a product first.");
      return;
    }

    try {
      showFeedback(elements.inventoryFeedback, "Applying stock update...");
      const data = await request("/admin/inventory/adjust", {
        method: "POST",
        body: JSON.stringify({
          partId,
          quantityDelta: elements.inventoryDelta.value ? Number(elements.inventoryDelta.value) : undefined,
          replaceQuantity: elements.inventoryReplace.value ? Number(elements.inventoryReplace.value) : undefined,
          note: normalizeText(elements.inventoryNote.value)
        })
      });
      if (!data) return;
      state.dashboard = data.dashboard;
      renderAll();
      showFeedback(elements.inventoryFeedback, "Stock updated successfully.");
    } catch (error) {
      showFeedback(elements.inventoryFeedback, error.message || "Could not update stock.");
    }
  }

  function bindEvents() {
    elements.viewLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        setActiveView(link.getAttribute("data-admin-view-link"));
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    elements.userSearch.addEventListener("input", (event) => {
      state.filters.userSearch = normalizeText(event.target.value);
      renderUsers();
    });

    elements.productSearch.addEventListener("input", (event) => {
      state.filters.productSearch = normalizeText(event.target.value);
      renderProducts();
    });

    elements.productDealerFilter.addEventListener("change", (event) => {
      state.filters.productDealerId = event.target.value || "all";
      renderProducts();
    });

    elements.productBrandFilter.addEventListener("change", (event) => {
      state.filters.productBrandKey = event.target.value || "all";
      renderProducts();
    });

    elements.orderSearch.addEventListener("input", (event) => {
      state.filters.orderSearch = normalizeText(event.target.value);
      renderOrders();
    });

    elements.roleSelect.addEventListener("change", () => {
      state.accessDraft.role = elements.roleSelect.value;
      if (state.accessDraft.role === "dealer" && !state.accessDraft.assignments.length) {
        state.accessDraft.assignments = [makeAssignment()];
      }
      renderAccessStudio();
    });

    elements.statusSelect.addEventListener("change", () => {
      state.accessDraft.accessStatus = elements.statusSelect.value;
    });

    elements.emailInput.addEventListener("change", () => {
      const user = getUserByEmail(elements.emailInput.value);
      if (user) {
        fillAccessDraft(user);
        renderAccessStudio();
        showFeedback(elements.accessFeedback, "Registered account loaded into the access studio.");
      }
    });

    elements.addAssignmentBtn.addEventListener("click", () => {
      state.accessDraft.assignments.push(makeAssignment());
      renderAssignmentRows();
    });

    elements.resetAccessBtn.addEventListener("click", () => {
      fillAccessDraft(getUserById(state.selectedUserId));
      renderAccessStudio();
      showFeedback(elements.accessFeedback, "Access studio reset.");
    });

    elements.accessForm.addEventListener("submit", saveAccess);

    elements.dealerBrandSelector.addEventListener("change", (event) => {
      const input = event.target.closest("[data-dealer-brand]");
      if (!input) return;
      const brandKey = input.getAttribute("data-dealer-brand");
      const next = new Set(state.networkDraft.brandKeys);
      if (input.checked) next.add(brandKey);
      else next.delete(brandKey);
      state.networkDraft.brandKeys = Array.from(next);
      renderDealerBrandSelector();
      renderDealerModelsPreview();
    });

    elements.dealerResetBtn.addEventListener("click", () => {
      fillNetworkDraft(null);
      renderDealerForm();
      showFeedback(elements.dealerFeedback, "Dealer network editor reset.");
    });

    elements.dealerDeleteBtn.addEventListener("click", () => {
      if (state.networkDraft.id) {
        deleteDealerNetwork(state.networkDraft.id);
      }
    });

    elements.dealerForm.addEventListener("submit", saveDealerNetwork);

    elements.productResetBtn.addEventListener("click", () => {
      fillProductDraft(null);
    });

    elements.productDeleteBtn.addEventListener("click", () => {
      const partId = Number(elements.productId.value || 0);
      if (partId) {
        deleteProduct(partId);
      }
    });

    elements.productForm.addEventListener("submit", saveProduct);

    elements.inventoryResetBtn.addEventListener("click", () => {
      elements.inventoryAdjustForm.reset();
      showFeedback(elements.inventoryFeedback, "Stock adjustment form reset.");
    });

    elements.inventoryAdjustForm.addEventListener("submit", adjustInventory);

    document.addEventListener("change", (event) => {
      const dealerSelect = event.target.closest("[data-assignment-dealer]");
      const statusSelect = event.target.closest("[data-assignment-status]");
      const brandCheckbox = event.target.closest("[data-assignment-brand]");
      const permissionCheckbox = event.target.closest("[data-assignment-permission]");

      if (dealerSelect) {
        const row = state.accessDraft.assignments.find((item) => item.key === dealerSelect.getAttribute("data-assignment-dealer"));
        if (!row) return;
        row.dealerId = dealerSelect.value;
        const dealer = getDealerById(row.dealerId);
        row.brandKeys = dealer ? dealer.brands.map((brand) => brand.key) : [];
        renderAssignmentRows();
      }

      if (statusSelect) {
        const row = state.accessDraft.assignments.find((item) => item.key === statusSelect.getAttribute("data-assignment-status"));
        if (!row) return;
        row.accessStatus = statusSelect.value;
      }

      if (brandCheckbox) {
        const row = state.accessDraft.assignments.find((item) => item.key === brandCheckbox.getAttribute("data-assignment-brand"));
        if (!row) return;
        const next = new Set(row.brandKeys);
        if (brandCheckbox.checked) next.add(brandCheckbox.value);
        else next.delete(brandCheckbox.value);
        row.brandKeys = Array.from(next);
      }

      if (permissionCheckbox) {
        const row = state.accessDraft.assignments.find((item) => item.key === permissionCheckbox.getAttribute("data-assignment-permission"));
        if (!row) return;
        const next = new Set(row.permissionScope);
        if (permissionCheckbox.checked) next.add(permissionCheckbox.value);
        else next.delete(permissionCheckbox.value);
        row.permissionScope = Array.from(next);
      }
    });

    document.addEventListener("click", async (event) => {
      const requestAction = event.target.closest("[data-request-action]");
      const userAction = event.target.closest("[data-user-action]");
      const assignmentAction = event.target.closest("[data-assignment-action]");
      const networkAction = event.target.closest("[data-network-action]");
      const productAction = event.target.closest("[data-product-action]");
      const orderAction = event.target.closest("[data-order-action]");
      const inventoryAction = event.target.closest("[data-inventory-action]");

      if (requestAction) {
        const action = requestAction.getAttribute("data-request-action");
        if (action === "load") {
          const email = requestAction.getAttribute("data-request-email");
          const user = getUserByEmail(email);
          if (user) {
            setActiveView("users");
            fillAccessDraft(user);
            renderAccessStudio();
            showFeedback(elements.accessFeedback, "Request loaded into the access studio.");
          }
        } else {
          await reviewRequest(requestAction.getAttribute("data-request-id"), action);
        }
      }

      if (userAction) {
        const action = userAction.getAttribute("data-user-action");
        const userId = userAction.getAttribute("data-user-id");
        const user = getUserById(userId);
        if (!user) return;

        if (action === "load") {
          setActiveView("users");
          fillAccessDraft(user);
          renderAccessStudio();
          showFeedback(elements.accessFeedback, "User loaded into the access studio.");
        } else if (action === "toggle-status") {
          await patchUserStatus(userId, userAction.getAttribute("data-next-status"));
        } else if (action === "delete") {
          await deleteUser(userId);
        }
      }

      if (assignmentAction) {
        const action = assignmentAction.getAttribute("data-assignment-action");
        const key = assignmentAction.getAttribute("data-assignment-key");
        if (action === "remove") {
          state.accessDraft.assignments = state.accessDraft.assignments.filter((item) => item.key !== key);
          renderAssignmentRows();
        }
      }

      if (networkAction) {
        const action = networkAction.getAttribute("data-network-action");
        const dealer = getDealerById(networkAction.getAttribute("data-network-id"));
        if (!dealer) return;
        if (action === "edit") {
          setActiveView("networks");
          fillNetworkDraft(dealer);
          renderDealerForm();
          showFeedback(elements.dealerFeedback, `Editing ${dealer.name}.`);
        } else if (action === "delete") {
          await deleteDealerNetwork(dealer.id);
        }
      }

      if (productAction) {
        const action = productAction.getAttribute("data-product-action");
        const product = getProductById(productAction.getAttribute("data-product-id"));
        if (!product) return;
        if (action === "edit") {
          setActiveView("products");
          fillProductDraft(product);
        } else if (action === "delete") {
          await deleteProduct(product.id);
        }
      }

      if (orderAction) {
        const action = orderAction.getAttribute("data-order-action");
        if (action === "select") {
          setActiveView("orders");
          state.selectedOrderId = orderAction.getAttribute("data-order-id");
          renderOrderDetail();
        }
      }

      if (inventoryAction) {
        const action = inventoryAction.getAttribute("data-inventory-action");
        if (action === "load") {
          setActiveView("inventory");
          fillInventoryPart(inventoryAction.getAttribute("data-part-id"));
        }
      }
    });

    document.addEventListener("submit", (event) => {
      if (event.target?.id === "adminOrderForm") {
        saveOrderStatus(event);
      }
    });
  }

  bindEvents();
  setActiveView(state.activeView);
  await loadDashboard();
})();
