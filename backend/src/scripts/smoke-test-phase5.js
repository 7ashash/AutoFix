const API_BASE = process.env.AUTOFIX_API_BASE || "http://localhost:4000/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    throw new Error(`${path} failed: ${payload?.error?.message || response.statusText}`);
  }

  return payload.data;
}

async function main() {
  const login = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "user@autofix.com",
      password: "User@123"
    })
  });

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${login.token}`
  };

  const compatible = await request("/parts/compatible?brandKey=mg&modelKey=mg-zs&year=2025", {
    headers: authHeaders
  });

  const firstPart = compatible.parts?.[0];
  if (!firstPart?.id) {
    throw new Error("No compatible part found for smoke test");
  }

  await request("/cart", {
    method: "DELETE",
    headers: authHeaders
  });

  const cartAfterAdd = await request("/cart/items", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      partId: firstPart.id,
      partSlug: firstPart.slug,
      quantity: 1,
      modelKey: "mg-zs",
      year: 2025
    })
  });

  const checkout = await request("/orders/checkout", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      fullName: "AutoFix Smoke Test",
      phone: "01000000000",
      addressLine: "Graduation Street 15",
      city: "Cairo",
      fulfillmentMethod: "delivery",
      paymentMethod: "cash"
    })
  });

  const latest = await request("/orders/latest", {
    headers: authHeaders
  });

  const orders = await request("/orders", {
    headers: authHeaders
  });

  console.log("Phase 5 smoke test passed.");
  console.log(JSON.stringify({
    addedPart: firstPart.slug,
    cartItemCount: cartAfterAdd.summary?.itemCount,
    orderNumber: checkout.order?.orderNumber,
    latestOrderId: latest.order?.id,
    ordersCount: orders.orders?.length || 0
  }, null, 2));
}

main().catch((error) => {
  console.error("Phase 5 smoke test failed.");
  console.error(error.message);
  process.exit(1);
});
