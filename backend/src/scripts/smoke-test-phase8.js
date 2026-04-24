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
    modelName: model.name,
    vehicleYearId: Number(year.id || year.vehicleYearId),
    yearValue: Number(year.value || year.year || year.yearValue)
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const dealerLogin = await login("dealer@autofix.com", "Dealer@123");
  const dealerToken = dealerLogin.token;

  const initialDashboard = await request("/dealers/dashboard/me", { token: dealerToken });
  assert(initialDashboard?.activeDealer, "Dealer dashboard did not return active dealer");
  assert(initialDashboard?.permissions?.inventory, "Dealer dashboard permissions are missing inventory access");

  const activeDealer = initialDashboard.activeDealer;
  const brand = pickFirst(activeDealer.brands);
  assert(brand?.key, "Active dealer has no scoped brand");

  const vehicleSeed = await resolveVehicleSeed(brand.key);
  const timestamp = Date.now();
  const categoryKey = initialDashboard.categories?.[0]?.key || null;

  const tempCustomerEmail = `phase8.customer.${timestamp}@autofix.local`;
  const tempStaffEmail = `phase8.staff.${timestamp}@autofix.local`;
  const tempPassword = "Phase8@123";

  const customerRegistration = await registerUser({
    username: `phase8customer${timestamp}`,
    email: tempCustomerEmail,
    password: tempPassword,
    fullName: "Phase Eight Customer",
    phone: "01000000008",
    brandKey: brand.key,
    modelKey: vehicleSeed.modelKey,
    vehicleYearId: vehicleSeed.vehicleYearId
  });

  await registerUser({
    username: `phase8staff${timestamp}`,
    email: tempStaffEmail,
    password: tempPassword,
    fullName: "Phase Eight Staff",
    phone: "01000000018",
    brandKey: brand.key,
    modelKey: vehicleSeed.modelKey,
    vehicleYearId: vehicleSeed.vehicleYearId
  });

  const createProductPayload = await request("/dealers/inventory", {
    method: "POST",
    token: dealerToken,
    body: {
      name: `Phase 8 Brake Pads ${timestamp}`,
      description: "Dealer dashboard smoke product",
      imageUrls: ["./pictures/Break Pads.jpg"],
      price: 987,
      brandKey: brand.key,
      categoryKey,
      manufacturerName: "AutoFix Test Manufacturer",
      partNumber: `P8-${timestamp}`,
      partType: "original",
      warrantyMonths: 12,
      technicalSpecs: "material: ceramic\nsource: smoke test",
      fitments: [
        {
          modelKey: vehicleSeed.modelKey,
          year: vehicleSeed.yearValue
        }
      ],
      serialNumber: `SN-P8-${timestamp}`,
      initialStock: 14
    }
  });

  const createdPartId = Number(createProductPayload?.createdPartId || 0);
  assert(createdPartId, "Dealer product creation did not return createdPartId");

  const updateProductPayload = await request(`/dealers/inventory/${createdPartId}`, {
    method: "PATCH",
    token: dealerToken,
    body: {
      name: `Phase 8 Brake Pads ${timestamp} Updated`,
      description: "Dealer dashboard smoke product updated",
      imageUrls: ["./pictures/Break Pads.jpg"],
      price: 1111,
      brandKey: brand.key,
      categoryKey,
      manufacturerName: "AutoFix Test Manufacturer",
      partNumber: `P8-${timestamp}`,
      partType: "original",
      warrantyMonths: 18,
      technicalSpecs: "material: ceramic\nsource: smoke test updated",
      fitments: [
        {
          modelKey: vehicleSeed.modelKey,
          year: vehicleSeed.yearValue
        }
      ],
      serialNumber: `SN-P8-${timestamp}-U`,
      active: true
    }
  });

  const updatedPart = (updateProductPayload.inventory || []).find((item) => Number(item.id) === createdPartId);
  assert(updatedPart?.price === 1111, "Dealer product update did not persist");

  await request(`/dealers/inventory/${createdPartId}/stock`, {
    method: "POST",
    token: dealerToken,
    body: {
      movementType: "restock",
      quantityDelta: 3,
      unitCost: 700,
      note: "Phase 8 manual restock"
    }
  });

  const importPayload = await request("/dealers/inventory/import", {
    method: "POST",
    token: dealerToken,
    body: {
      mode: "delta",
      rows: [
        {
          partNumber: `P8-${timestamp}`,
          quantity: 2,
          unitCost: 650,
          note: "Phase 8 bulk import"
        }
      ]
    }
  });
  assert(Number(importPayload?.importSummary?.updated || 0) >= 1, "Inventory import did not update any rows");

  const customerToken = customerRegistration.token;
  await request("/cart/items", {
    method: "POST",
    token: customerToken,
    body: {
      partId: createdPartId,
      modelKey: vehicleSeed.modelKey,
      year: vehicleSeed.yearValue,
      quantity: 1
    }
  });

  const checkoutPayload = await request("/orders/checkout", {
    method: "POST",
    token: customerToken,
    body: {
      fullName: "Phase Eight Customer",
      phone: "01000000008",
      address: "Nasr City, Block 8",
      city: "Cairo",
      fulfillmentMethod: "delivery",
      paymentMethod: "cash"
    }
  });
  assert(checkoutPayload?.order?.id, "Checkout did not create an order");

  let dashboard = await request("/dealers/dashboard/me", { token: dealerToken });
  const order = (dashboard.orders || []).find((item) => item.items.some((line) => Number(line.part.id) === createdPartId));
  assert(order, "Dealer dashboard did not receive the new routed order");
  const orderLine = order.items.find((line) => Number(line.part.id) === createdPartId);
  assert(orderLine?.orderItemId, "Dealer order line is missing");

  const customer = (dashboard.customers || []).find((item) => item.email === tempCustomerEmail);
  assert(customer?.id, "Dealer customer aggregation did not include the new customer");

  dashboard = await request(`/dealers/orders/${orderLine.orderItemId}`, {
    method: "PATCH",
    token: dealerToken,
    body: {
      status: "shipped",
      quantity: 1,
      shippingCarrier: "AutoFix Express",
      trackingNumber: `TRACK-${timestamp}`,
      statusNote: "Phase 8 smoke shipment"
    }
  });
  const shippedOrder = (dashboard.orders || []).find((item) => item.id === order.id);
  const shippedLine = shippedOrder?.items.find((line) => Number(line.orderItemId) === Number(orderLine.orderItemId));
  assert(shippedLine?.status === "shipped", "Dealer order update did not persist shipped status");

  dashboard = await request("/dealers/offers", {
    method: "POST",
    token: dealerToken,
    body: {
      title: `Phase 8 Offer ${timestamp}`,
      scopeType: "part",
      partId: createdPartId,
      discountType: "percentage",
      discountValue: 10,
      startsAt: "2026-04-23T08:00",
      endsAt: "2026-04-30T23:00",
      description: "Smoke offer",
      isActive: true
    }
  });
  const offer = (dashboard.offers || []).find((item) => item.title === `Phase 8 Offer ${timestamp}`);
  assert(offer?.id, "Offer creation did not persist");

  dashboard = await request(`/dealers/offers/${offer.id}`, {
    method: "PATCH",
    token: dealerToken,
    body: {
      title: `Phase 8 Offer ${timestamp} Updated`,
      description: "Smoke offer updated",
      discountType: "fixed",
      discountValue: 50,
      startsAt: "2026-04-23T08:00",
      endsAt: "2026-04-30T23:00",
      isActive: false
    }
  });
  const updatedOffer = (dashboard.offers || []).find((item) => Number(item.id) === Number(offer.id));
  assert(updatedOffer && updatedOffer.isActive === false, "Offer update did not persist");

  dashboard = await request("/dealers/coupons", {
    method: "POST",
    token: dealerToken,
    body: {
      code: `P8${String(timestamp).slice(-6)}`,
      title: `Phase 8 Coupon ${timestamp}`,
      discountType: "percentage",
      discountValue: 7,
      minimumOrderValue: 200,
      usageLimit: 5,
      startsAt: "2026-04-23T08:00",
      endsAt: "2026-04-30T23:00",
      description: "Smoke coupon",
      targetEmails: [tempCustomerEmail],
      isActive: true
    }
  });
  const coupon = (dashboard.coupons || []).find((item) => item.title === `Phase 8 Coupon ${timestamp}`);
  assert(coupon?.id, "Coupon creation did not persist");

  dashboard = await request(`/dealers/coupons/${coupon.id}`, {
    method: "PATCH",
    token: dealerToken,
    body: {
      title: `Phase 8 Coupon ${timestamp} Updated`,
      description: "Smoke coupon updated",
      discountType: "fixed",
      discountValue: 20,
      minimumOrderValue: 150,
      usageLimit: 10,
      startsAt: "2026-04-23T08:00",
      endsAt: "2026-04-30T23:00",
      targetEmails: [tempCustomerEmail],
      isActive: false
    }
  });
  const updatedCoupon = (dashboard.coupons || []).find((item) => Number(item.id) === Number(coupon.id));
  assert(updatedCoupon && updatedCoupon.isActive === false, "Coupon update did not persist");

  dashboard = await request("/dealers/customers/notify", {
    method: "POST",
    token: dealerToken,
    body: {
      title: "Phase 8 customer update",
      message: "Your routed order has a new dealer update.",
      customerIds: [customer.id]
    }
  });
  assert((dashboard.notifications || []).some((item) => item.title === "Phase 8 customer update"), "Customer notification was not created");

  const unreadNotification = (dashboard.notifications || []).find((item) => !item.isRead);
  if (unreadNotification) {
    dashboard = await request(`/dealers/notifications/${unreadNotification.id}/read`, {
      method: "PATCH",
      token: dealerToken,
      body: { isRead: true }
    });
  }

  dashboard = await request("/dealers/shipping", {
    method: "POST",
    token: dealerToken,
    body: {
      carrierName: "Phase 8 Carrier",
      regionName: `Phase8Region-${timestamp}`,
      baseFee: 40,
      feePerItem: 12,
      estimatedDaysMin: 2,
      estimatedDaysMax: 4,
      isActive: true
    }
  });
  const shippingMethod = (dashboard.shippingMethods || []).find((item) => item.regionName === `Phase8Region-${timestamp}`);
  assert(shippingMethod?.id, "Shipping method creation did not persist");

  const estimate = await request(`/dealers/shipping/estimate?regionName=${encodeURIComponent(`Phase8Region-${timestamp}`)}&itemCount=2`, {
    token: dealerToken
  });
  assert(Number(estimate?.estimatedFee || 0) > 0, "Shipping estimate did not return a fee");

  dashboard = await request("/dealers/staff", {
    method: "POST",
    token: dealerToken,
    body: {
      email: tempStaffEmail,
      brandKeys: [brand.key],
      accessStatus: "active",
      permissions: {
        inventory: true,
        orders: true,
        verification: false,
        analytics: true
      }
    }
  });
  const staffMember = (dashboard.staff || []).find((item) => item.email === tempStaffEmail);
  assert(staffMember?.userId, "Dealer staff grant did not persist");

  dashboard = await request(`/dealers/staff/${staffMember.userId}`, {
    method: "PATCH",
    token: dealerToken,
    body: {
      brandKeys: [brand.key],
      accessStatus: "suspended",
      permissions: {
        inventory: true,
        orders: false,
        verification: false,
        analytics: true
      }
    }
  });
  const updatedStaff = (dashboard.staff || []).find((item) => Number(item.userId) === Number(staffMember.userId));
  assert(updatedStaff?.accessStatus === "suspended", "Dealer staff update did not persist");

  dashboard = await request("/dealers/profile", {
    method: "PATCH",
    token: dealerToken,
    body: {
      name: activeDealer.name,
      location: activeDealer.location || "Cairo",
      contactEmail: activeDealer.contactEmail || "dealer@autofix.com",
      contactPhone: activeDealer.contactPhone || "01000000000",
      description: `Phase 8 profile refresh ${timestamp}`
    }
  });
  assert(String(dashboard.activeDealer?.description || "").includes(`Phase 8 profile refresh ${timestamp}`), "Dealer profile update did not persist");

  dashboard = await request("/dealers/support", {
    method: "POST",
    token: dealerToken,
    body: {
      subject: `Phase 8 support ${timestamp}`,
      priority: "normal",
      message: "Smoke test support ticket"
    }
  });
  const ticket = (dashboard.supportTickets || []).find((item) => item.subject === `Phase 8 support ${timestamp}`);
  assert(ticket?.id, "Support ticket creation did not persist");

  dashboard = await request(`/dealers/support/${ticket.id}`, {
    method: "PATCH",
    token: dealerToken,
    body: {
      status: "in_progress",
      adminReply: "Smoke test follow-up"
    }
  });
  const updatedTicket = (dashboard.supportTickets || []).find((item) => Number(item.id) === Number(ticket.id));
  assert(updatedTicket?.status === "in_progress", "Support ticket update did not persist");

  dashboard = await request(`/dealers/inventory/${createdPartId}`, {
    method: "DELETE",
    token: dealerToken,
    body: {
      mode: "archive",
      archiveReason: "Phase 8 smoke archive"
    }
  });
  const archivedPart = (dashboard.inventory || []).find((item) => Number(item.id) === createdPartId);
  assert(archivedPart && archivedPart.active === false, "Product archive did not persist");

  dashboard = await request(`/dealers/inventory/${createdPartId}`, {
    method: "PATCH",
    token: dealerToken,
    body: {
      name: archivedPart.name,
      description: archivedPart.description,
      imageUrls: archivedPart.imageUrls,
      price: archivedPart.price,
      brandKey: archivedPart.brand.key,
      categoryKey: archivedPart.category?.key || null,
      manufacturerName: archivedPart.manufacturerName,
      partNumber: archivedPart.partNumber,
      partType: archivedPart.partType,
      warrantyMonths: archivedPart.warrantyMonths,
      technicalSpecs: archivedPart.technicalSpecs,
      fitments: archivedPart.fitments.map((fitment) => ({
        modelKey: fitment.modelKey,
        year: fitment.year
      })),
      serialNumber: archivedPart.serialNumber,
      active: true,
      archiveReason: ""
    }
  });
  const restoredPart = (dashboard.inventory || []).find((item) => Number(item.id) === createdPartId);
  assert(restoredPart && restoredPart.active === true, "Product restore did not persist");

  const helpArticles = await request("/dealers/help", { token: dealerToken });
  assert(Array.isArray(helpArticles) && helpArticles.length > 0, "Dealer help center did not return articles");

  const feedback = await request("/dealers/feedback", { token: dealerToken });

  console.log("Phase 8 smoke test passed.");
  console.log(JSON.stringify({
    dealer: activeDealer.name,
    scopedBrand: brand.name,
    createdPartId,
    createdOrderNumber: checkoutPayload.order.orderNumber,
    customerId: customer.id,
    offerId: offer.id,
    couponId: coupon.id,
    shippingMethodId: shippingMethod.id,
    staffUserId: staffMember.userId,
    supportTicketId: ticket.id,
    feedbackCount: Array.isArray(feedback) ? feedback.length : 0
  }, null, 2));
}

main().catch((error) => {
  console.error("Phase 8 smoke test failed.");
  console.error(error.message);
  process.exit(1);
});
