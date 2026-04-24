(function () {
  const authApi = window.AutoFixAuth;
  const GUEST_CART_KEY = "cart";
  const CART_COUNT_KEY = "autofixCartCount";
  const LAST_ORDER_KEY = "autofixLastOrderId";

  function ensureApi() {
    if (!authApi?.apiFetch) {
      throw new Error("AutoFixAuth apiFetch is not available");
    }
  }

  function isAuthenticated() {
    return Boolean(authApi?.getToken?.() && authApi?.getUser?.());
  }

  function dispatchCartUpdate(totalCount) {
    const normalizedCount = Number(totalCount || 0);
    localStorage.setItem(CART_COUNT_KEY, String(normalizedCount));
    window.dispatchEvent(
      new CustomEvent("autofix-cart-updated", {
        detail: { count: normalizedCount }
      })
    );
  }

  function getCachedCartCount() {
    const raw = Number(localStorage.getItem(CART_COUNT_KEY) || 0);
    return Number.isFinite(raw) ? raw : 0;
  }

  function sanitizeGuestItem(item, index = 0) {
    const quantity = Math.max(1, Math.min(20, Number(item?.quantity || 1)));
    const price = Number(item?.price || 0);
    const partId = item?.partId ? Number(item.partId) : item?.id ? Number(item.id) : null;
    const partSlug = String(item?.partSlug || item?.slug || "").trim();
    const modelKey = String(item?.modelKey || "").trim().toLowerCase();
    const year = item?.year ? Number(item.year) : null;
    const type = String(item?.type || "AutoFix Part").trim();

    return {
      guestIndex: index,
      quantity,
      lineTotal: Number((quantity * price).toFixed(2)),
      syncEligible: Boolean(partId || partSlug),
      part: {
        id: partId,
        slug: partSlug || null,
        name: item?.name || "AutoFix Part",
        image: item?.image || "./pictures/autofix logo.png",
        type,
        price,
        rating: Number(item?.rating || 0),
        stockQuantity: null,
        partNumber: item?.partNumber || "",
        serialNumber: item?.serialNumber || ""
      },
      dealer: {
        id: item?.dealerId ? Number(item.dealerId) : null,
        name: item?.dealerName || "AutoFix catalog",
        slug: item?.dealerSlug || ""
      },
      brand: {
        id: item?.brandId ? Number(item.brandId) : null,
        key: item?.brandKey || "",
        name: item?.brandName || ""
      },
      vehicle: modelKey && year
        ? {
          key: modelKey,
          name: item?.vehicleName || item?.vehicle || modelKey,
          year
        }
        : null
    };
  }

  function readGuestCartItems() {
    try {
      const raw = JSON.parse(localStorage.getItem(GUEST_CART_KEY) || "[]");
      if (!Array.isArray(raw)) {
        return [];
      }

      return raw;
    } catch {
      return [];
    }
  }

  function writeGuestCartItems(items) {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
    const totalCount = items.reduce((sum, item) => sum + Math.max(1, Number(item?.quantity || 1)), 0);
    dispatchCartUpdate(totalCount);
  }

  function buildGuestCartState() {
    const rawItems = readGuestCartItems();
    const items = rawItems.map((item, index) => sanitizeGuestItem(item, index));
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));

    dispatchCartUpdate(itemCount);

    return {
      mode: "guest",
      cartId: null,
      items,
      summary: {
        uniqueItems: items.length,
        itemCount,
        subtotal,
        estimatedShipping: items.length ? 15 : 0,
        estimatedTotal: subtotal + (items.length ? 15 : 0)
      }
    };
  }

  function flattenCountFromServerCart(cartData) {
    return Number(cartData?.summary?.itemCount || 0);
  }

  async function fetchServerCart() {
    ensureApi();
    const data = await authApi.apiFetch("/cart");
    dispatchCartUpdate(flattenCountFromServerCart(data));
    return {
      mode: "server",
      ...data
    };
  }

  async function syncGuestCartToServer() {
    if (!isAuthenticated()) {
      return {
        cart: buildGuestCartState(),
        synced: 0,
        failed: []
      };
    }

    const guestItems = readGuestCartItems();
    if (!guestItems.length) {
      return {
        cart: await fetchServerCart(),
        synced: 0,
        failed: []
      };
    }

    const failed = [];
    let synced = 0;

    for (const item of guestItems) {
      const payload = sanitizeGuestItem(item);
      if (!payload.syncEligible) {
        failed.push(payload);
        continue;
      }

      try {
        await authApi.apiFetch("/cart/items", {
          method: "POST",
          body: JSON.stringify({
            partId: payload.part.id,
            partSlug: payload.part.slug,
            quantity: payload.quantity,
            modelKey: payload.vehicle?.key || "",
            year: payload.vehicle?.year || ""
          })
        });
        synced += 1;
      } catch {
        failed.push(payload);
      }
    }

    localStorage.removeItem(GUEST_CART_KEY);
    const cart = await fetchServerCart();
    return { cart, synced, failed };
  }

  async function fetchCart() {
    if (isAuthenticated()) {
      return fetchServerCart();
    }

    return buildGuestCartState();
  }

  async function addToCart(item) {
    const payload = {
      partId: item?.partId ? Number(item.partId) : item?.id ? Number(item.id) : null,
      partSlug: String(item?.partSlug || item?.slug || "").trim(),
      quantity: Math.max(1, Math.min(20, Number(item?.quantity || 1))),
      modelKey: String(item?.modelKey || "").trim().toLowerCase(),
      year: item?.year ? Number(item.year) : null,
      name: item?.name || "AutoFix Part",
      image: item?.image || "./pictures/autofix logo.png",
      price: Number(item?.price || 0),
      type: item?.type || "AutoFix Part",
      rating: Number(item?.rating || 0),
      dealerId: item?.dealerId ? Number(item.dealerId) : null,
      dealerSlug: item?.dealerSlug || "",
      dealerName: item?.dealerName || "AutoFix catalog",
      brandId: item?.brandId ? Number(item.brandId) : null,
      brandKey: item?.brandKey || "",
      brandName: item?.brandName || "",
      vehicleName: item?.vehicleName || item?.vehicle || ""
    };

    if (!payload.partId && !payload.partSlug) {
      throw new Error("This item is not ready for live checkout yet");
    }

    if (isAuthenticated()) {
      const data = await authApi.apiFetch("/cart/items", {
        method: "POST",
        body: JSON.stringify({
          partId: payload.partId,
          partSlug: payload.partSlug,
          quantity: payload.quantity,
          modelKey: payload.modelKey,
          year: payload.year
        })
      });

      dispatchCartUpdate(flattenCountFromServerCart(data));
      return {
        mode: "server",
        cart: {
          mode: "server",
          ...data
        }
      };
    }

    const guestItems = readGuestCartItems();
    const existingIndex = guestItems.findIndex((entry) => {
      const existingPartId = entry?.partId ? Number(entry.partId) : entry?.id ? Number(entry.id) : null;
      const existingSlug = String(entry?.partSlug || entry?.slug || "").trim();
      const existingModelKey = String(entry?.modelKey || "").trim().toLowerCase();
      const existingYear = entry?.year ? Number(entry.year) : null;

      return existingPartId === payload.partId
        && existingSlug === payload.partSlug
        && existingModelKey === payload.modelKey
        && existingYear === payload.year;
    });

    if (existingIndex >= 0) {
      const existing = guestItems[existingIndex];
      guestItems[existingIndex] = {
        ...existing,
        quantity: Math.max(1, Math.min(20, Number(existing.quantity || 1) + payload.quantity))
      };
    } else {
      guestItems.push(payload);
    }

    writeGuestCartItems(guestItems);
    return {
      mode: "guest",
      cart: buildGuestCartState()
    };
  }

  async function updateCartItem(ref, quantity) {
    const normalizedQuantity = Math.max(1, Math.min(20, Number(quantity || 1)));

    if (isAuthenticated()) {
      const data = await authApi.apiFetch(`/cart/items/${encodeURIComponent(ref)}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: normalizedQuantity })
      });

      dispatchCartUpdate(flattenCountFromServerCart(data));
      return {
        mode: "server",
        cart: {
          mode: "server",
          ...data
        }
      };
    }

    const index = Number(ref);
    const guestItems = readGuestCartItems();
    if (!guestItems[index]) {
      throw new Error("Cart item was not found");
    }

    guestItems[index] = {
      ...guestItems[index],
      quantity: normalizedQuantity
    };

    writeGuestCartItems(guestItems);
    return {
      mode: "guest",
      cart: buildGuestCartState()
    };
  }

  async function removeCartItem(ref) {
    if (isAuthenticated()) {
      const data = await authApi.apiFetch(`/cart/items/${encodeURIComponent(ref)}`, {
        method: "DELETE"
      });

      dispatchCartUpdate(flattenCountFromServerCart(data));
      return {
        mode: "server",
        cart: {
          mode: "server",
          ...data
        }
      };
    }

    const index = Number(ref);
    const guestItems = readGuestCartItems();
    guestItems.splice(index, 1);
    writeGuestCartItems(guestItems);
    return {
      mode: "guest",
      cart: buildGuestCartState()
    };
  }

  async function clearCart() {
    if (isAuthenticated()) {
      const data = await authApi.apiFetch("/cart", {
        method: "DELETE"
      });

      dispatchCartUpdate(flattenCountFromServerCart(data));
      return {
        mode: "server",
        cart: {
          mode: "server",
          ...data
        }
      };
    }

    localStorage.removeItem(GUEST_CART_KEY);
    dispatchCartUpdate(0);
    return {
      mode: "guest",
      cart: buildGuestCartState()
    };
  }

  async function createOrder(payload) {
    ensureApi();
    const data = await authApi.apiFetch("/orders/checkout", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (data?.order?.id) {
      localStorage.setItem(LAST_ORDER_KEY, String(data.order.id));
    }

    dispatchCartUpdate(0);
    return data.order;
  }

  async function fetchOrders() {
    ensureApi();
    const data = await authApi.apiFetch("/orders");
    return data.orders || [];
  }

  async function fetchOrder(orderId) {
    ensureApi();
    const data = await authApi.apiFetch(`/orders/${encodeURIComponent(orderId)}`);
    return data.order;
  }

  async function fetchLatestOrder() {
    ensureApi();
    const data = await authApi.apiFetch("/orders/latest");
    return data.order;
  }

  function getLastOrderId() {
    const raw = Number(localStorage.getItem(LAST_ORDER_KEY) || 0);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }

  function setLastOrderId(orderId) {
    if (orderId) {
      localStorage.setItem(LAST_ORDER_KEY, String(orderId));
    }
  }

  window.AutoFixCommerce = {
    isAuthenticated,
    getCachedCartCount,
    fetchCart,
    fetchServerCart,
    buildGuestCartState,
    syncGuestCartToServer,
    addToCart,
    updateCartItem,
    removeCartItem,
    clearCart,
    createOrder,
    fetchOrders,
    fetchOrder,
    fetchLatestOrder,
    getLastOrderId,
    setLastOrderId,
    dispatchCartUpdate
  };
})();
