const API_BASE = process.env.AUTOFIX_API_BASE || "http://localhost:4000/api";

async function request(path, options = {}) {
  const headers = {
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(`${path} failed: ${payload?.error?.message || response.statusText}`);
  }

  return payload.data;
}

async function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: { email, password }
  });
}

async function registerUser(payload) {
  return request("/auth/register", {
    method: "POST",
    body: payload
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function pickFirst(arrayLike) {
  return Array.isArray(arrayLike) && arrayLike.length ? arrayLike[0] : null;
}

async function resolveVehicleSeed(brandKey) {
  const modelsPayload = await request(`/vehicles/brands/${encodeURIComponent(brandKey)}/models`);
  const models = Array.isArray(modelsPayload?.models) ? modelsPayload.models : (Array.isArray(modelsPayload) ? modelsPayload : []);
  const model = pickFirst(models);
  if (!model) {
    throw new Error(`No models found for brand ${brandKey}`);
  }

  const modelKey = model.key || model.modelKey;
  const yearsPayload = await request(`/vehicles/models/${encodeURIComponent(modelKey)}/years`);
  const years = Array.isArray(yearsPayload?.years) ? yearsPayload.years : (Array.isArray(yearsPayload) ? yearsPayload : []);
  const year = pickFirst(years);
  if (!year) {
    throw new Error(`No years found for model ${modelKey}`);
  }

  return {
    modelKey,
    vehicleYearId: Number(year.id || year.vehicleYearId),
    yearValue: Number(year.value || year.year || year.yearValue)
  };
}

function toAssignmentPayload(dealerAssignments = [], accessStatusOverride = null) {
  return (dealerAssignments || []).map((assignment) => ({
    dealerId: Number(assignment.dealerId),
    accessStatus: accessStatusOverride || assignment.accessStatus || "active",
    permissionScope: Array.isArray(assignment.permissionScope) ? assignment.permissionScope : [],
    brandKeys: Array.isArray(assignment.allowedBrandKeys) ? assignment.allowedBrandKeys : []
  }));
}

async function createCheckoutOrder({ email, username, fullName, phone, brandKey, modelKey, vehicleYearId, yearValue }) {
  const customerPassword = "Phase9@123";
  const registration = await registerUser({
    username,
    email,
    password: customerPassword,
    fullName,
    phone,
    brandKey,
    modelKey,
    vehicleYearId
  });

  const compatiblePartsPayload = await request(
    `/parts/compatible?brandKey=${encodeURIComponent(brandKey)}&modelKey=${encodeURIComponent(modelKey)}&year=${encodeURIComponent(yearValue)}`
  );
  const parts = Array.isArray(compatiblePartsPayload?.parts)
    ? compatiblePartsPayload.parts
    : (Array.isArray(compatiblePartsPayload) ? compatiblePartsPayload : []);
  const part = pickFirst(parts);
  if (!part?.id) {
    throw new Error(`No compatible parts found for ${brandKey} ${modelKey} ${yearValue}`);
  }

  await request("/cart/items", {
    method: "POST",
    token: registration.token,
    body: {
      partId: Number(part.id),
      modelKey,
      year: yearValue,
      quantity: 1
    }
  });

  const checkout = await request("/orders/checkout", {
    method: "POST",
    token: registration.token,
    body: {
      fullName,
      phone,
      address: "Phase 9 Smoke Street",
      city: "Cairo",
      fulfillmentMethod: "delivery",
      paymentMethod: "cash"
    }
  });

  assert(checkout?.order?.id, "Checkout did not create a smoke order for Phase 9");
  return checkout.order;
}

async function main() {
  const timestamp = Date.now();
  const adminLogin = await login("admin@autofix.com", "Admin@123");
  const adminToken = adminLogin.token;

  let dashboard = await request("/admin/dashboard", { token: adminToken });
  assert(dashboard?.kpis, "Admin dashboard did not return KPI data");
  assert(Array.isArray(dashboard?.assignments), "Admin dashboard did not return user assignments");
  assert(Array.isArray(dashboard?.dealerCoverage) && dashboard.dealerCoverage.length > 0, "Admin dashboard did not return dealer coverage");
  assert(Array.isArray(dashboard?.products) && dashboard.products.length > 0, "Admin dashboard did not return products");
  assert(Array.isArray(dashboard?.brands) && dashboard.brands.length > 0, "Admin dashboard did not return brands catalog");

  const primaryDealer = pickFirst(dashboard.dealerCoverage);
  const firstBrand = pickFirst(dashboard.brands);
  const secondBrand = dashboard.brands.find((brand) => brand.key !== firstBrand?.key) || firstBrand;
  assert(primaryDealer?.id, "No existing dealer network found");
  assert(firstBrand?.key, "No brand found for admin smoke test");

  const createdDealerPayload = await request("/admin/dealers", {
    method: "POST",
    token: adminToken,
    body: {
      name: `Phase 9 Dealer ${timestamp}`,
      slug: `phase-9-${timestamp}`,
      location: "Cairo",
      contactEmail: `phase9.dealer.${timestamp}@autofix.local`,
      contactPhone: "01000000999",
      description: "Phase 9 admin smoke dealer network",
      isActive: true,
      brandKeys: [firstBrand.key]
    }
  });

  const createdDealer = createdDealerPayload?.dealer;
  assert(createdDealer?.id, "Admin dealer network creation did not persist");

  const updatedDealerPayload = await request(`/admin/dealers/${createdDealer.id}`, {
    method: "PATCH",
    token: adminToken,
    body: {
      name: `Phase 9 Dealer ${timestamp} Updated`,
      slug: `phase-9-${timestamp}-updated`,
      location: "Giza",
      contactEmail: `phase9.dealer.updated.${timestamp}@autofix.local`,
      contactPhone: "01000000888",
      description: "Phase 9 admin smoke dealer network updated",
      isActive: true,
      brandKeys: [firstBrand.key, secondBrand.key]
    }
  });

  const updatedDealer = updatedDealerPayload?.dealer;
  assert(updatedDealer?.name?.includes("Updated"), "Admin dealer network update did not persist");

  const tempDealerEmail = `phase9.dealer.user.${timestamp}@autofix.local`;
  const dealerVehicleSeed = await resolveVehicleSeed(firstBrand.key);
  await registerUser({
    username: `phase9dealer${timestamp}`,
    email: tempDealerEmail,
    password: "Phase9@123",
    fullName: "Phase Nine Dealer User",
    phone: "01000000909",
    brandKey: firstBrand.key,
    modelKey: dealerVehicleSeed.modelKey,
    vehicleYearId: dealerVehicleSeed.vehicleYearId
  });

  const accessPayload = await request("/admin/dealer-access/assign", {
    method: "POST",
    token: adminToken,
    body: {
      email: tempDealerEmail,
      role: "dealer",
      accessStatus: "active",
      assignments: [
        {
          dealerId: Number(primaryDealer.id),
          accessStatus: "active",
          permissionScope: ["inventory", "orders", "verification", "analytics"],
          brandKeys: (primaryDealer.brands || []).map((brand) => brand.key)
        },
        {
          dealerId: Number(updatedDealer.id),
          accessStatus: "active",
          permissionScope: ["inventory", "orders"],
          brandKeys: (updatedDealer.brands || []).map((brand) => brand.key)
        }
      ]
    }
  });

  const dealerUser = accessPayload?.user;
  assert(dealerUser?.role === "dealer", "Registered user was not converted into a dealer");
  assert((dealerUser?.dealerAssignments || []).length >= 2, "Dealer user did not receive multi-network access");

  const persistedAssignments = toAssignmentPayload(dealerUser.dealerAssignments);

  const suspendedPayload = await request(`/admin/users/${dealerUser.id}/access`, {
    method: "PATCH",
    token: adminToken,
    body: {
      role: "dealer",
      accessStatus: "suspended",
      assignments: persistedAssignments
    }
  });

  const suspendedUser = suspendedPayload?.user;
  assert(suspendedUser?.accountStatus === "suspended", "Admin could not suspend a dealer account");

  const reactivatedPayload = await request(`/admin/users/${dealerUser.id}/access`, {
    method: "PATCH",
    token: adminToken,
    body: {
      role: "dealer",
      accessStatus: "active",
      assignments: persistedAssignments
    }
  });

  const reactivatedUser = reactivatedPayload?.user;
  assert(reactivatedUser?.accountStatus === "active", "Admin could not reactivate the dealer account");

  const previewBundle = await request(`/dealers/dashboard/me?dealerId=${updatedDealer.id}`, {
    token: adminToken
  });
  assert(previewBundle?.dealerViewMode === "admin-preview", "Admin dealer preview did not open in admin-preview mode");
  assert(String(previewBundle?.activeDealer?.id) === String(updatedDealer.id), "Admin preview did not load the requested dealer");

  const product = pickFirst(dashboard.products);
  assert(product?.id, "No product found for admin product smoke test");

  const updatedPrice = Number(product.price || 0) + 25;
  const updatedStock = Number(product.stockQuantity || 0) + 1;
  const productUpdatePayload = await request(`/admin/products/${product.id}`, {
    method: "PATCH",
    token: adminToken,
    body: {
      name: product.name,
      partNumber: product.partNumber,
      serialNumber: product.serialNumber,
      manufacturerName: product.manufacturerName,
      partType: product.partType,
      categoryId: product.categoryId ? Number(product.categoryId) : null,
      price: updatedPrice,
      stockQuantity: updatedStock,
      warrantyMonths: product.warrantyMonths || 0,
      active: Boolean(product.active),
      description: product.description || ""
    }
  });

  dashboard = productUpdatePayload?.dashboard;
  const updatedProduct = (dashboard?.products || []).find((item) => Number(item.id) === Number(product.id));
  assert(Number(updatedProduct?.price || 0) === updatedPrice, "Admin product update did not persist");

  const inventoryAdjustPayload = await request("/admin/inventory/adjust", {
    method: "POST",
    token: adminToken,
    body: {
      partId: Number(product.id),
      quantityDelta: 3,
      note: "Phase 9 admin inventory adjustment"
    }
  });

  dashboard = inventoryAdjustPayload?.dashboard;
  const adjustedProduct = (dashboard?.products || []).find((item) => Number(item.id) === Number(product.id));
  assert(Number(adjustedProduct?.stockQuantity || 0) === updatedStock + 3, "Admin inventory adjustment did not persist");

  const customerVehicleSeed = await resolveVehicleSeed(firstBrand.key);
  const order = await createCheckoutOrder({
    email: `phase9.customer.${timestamp}@autofix.local`,
    username: `phase9customer${timestamp}`,
    fullName: "Phase Nine Customer",
    phone: "01000000777",
    brandKey: firstBrand.key,
    modelKey: customerVehicleSeed.modelKey,
    vehicleYearId: customerVehicleSeed.vehicleYearId,
    yearValue: customerVehicleSeed.yearValue
  });

  const orderUpdatePayload = await request(`/admin/orders/${order.id}`, {
    method: "PATCH",
    token: adminToken,
    body: {
      status: "confirmed"
    }
  });

  dashboard = orderUpdatePayload?.dashboard;
  const updatedOrder = (dashboard?.orders || []).find((item) => Number(item.id) === Number(order.id));
  assert(updatedOrder?.status === "confirmed", "Admin order status update did not persist");

  const userDeletePayload = await request(`/admin/users/${reactivatedUser.id}`, {
    method: "DELETE",
    token: adminToken
  });

  dashboard = userDeletePayload?.dashboard;
  const archivedUser = (dashboard?.assignments || []).find((item) => Number(item.id) === Number(reactivatedUser.id));
  assert(archivedUser?.accountStatus === "suspended", "Admin account archive/delete flow did not persist");

  const dealerDeletePayload = await request(`/admin/dealers/${updatedDealer.id}`, {
    method: "DELETE",
    token: adminToken
  });

  dashboard = dealerDeletePayload?.dashboard;
  const deletedDealerStillActive = (dashboard?.dealerCoverage || []).find((item) => Number(item.id) === Number(updatedDealer.id) && item.isActive);
  assert(!deletedDealerStillActive, "Admin dealer network delete/archive flow did not persist");

  const usersPayload = await request("/admin/users", { token: adminToken });
  const dealersPayload = await request("/admin/dealers", { token: adminToken });
  const productsPayload = await request("/admin/products", { token: adminToken });
  const ordersPayload = await request("/admin/orders", { token: adminToken });
  const inventoryPayload = await request("/admin/inventory", { token: adminToken });

  assert(Array.isArray(usersPayload) && usersPayload.length > 0, "Admin users endpoint returned no records");
  assert(Array.isArray(dealersPayload) && dealersPayload.length > 0, "Admin dealers endpoint returned no records");
  assert(Array.isArray(productsPayload) && productsPayload.length > 0, "Admin products endpoint returned no records");
  assert(Array.isArray(ordersPayload) && ordersPayload.length > 0, "Admin orders endpoint returned no records");
  assert(Array.isArray(inventoryPayload), "Admin inventory endpoint did not return a list");

  console.log("Phase 9 smoke test passed.");
  console.log(JSON.stringify({
    adminEmail: "admin@autofix.com",
    createdDealerId: createdDealer.id,
    previewDealerId: updatedDealer.id,
    convertedDealerUserId: dealerUser.id,
    updatedProductId: product.id,
    updatedOrderNumber: updatedOrder.orderNumber,
    lowStockItems: inventoryPayload.length
  }, null, 2));
}

main().catch((error) => {
  console.error("Phase 9 smoke test failed.");
  console.error(error.message);
  process.exit(1);
});
