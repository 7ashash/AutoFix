const SHIPPING_FEE = 15;
let selectedPayment = "";
let selectedFulfillment = "delivery";
let activeCart = null;

function formatPrice(value) {
  return `${Number(value || 0)} EGP`;
}

function getSummaryValues() {
  const subtotal = Number(activeCart?.summary?.subtotal || 0);
  const shipping = subtotal > 0 && selectedFulfillment === "delivery" ? SHIPPING_FEE : 0;
  const total = Number((subtotal + shipping).toFixed(2));

  return { subtotal, shipping, total };
}

function updateCheckoutSummary() {
  const fulfillmentElement = document.getElementById("checkoutFulfillment");
  const subtotalElement = document.getElementById("checkoutSubtotal");
  const shippingElement = document.getElementById("checkoutShipping");
  const totalElement = document.getElementById("checkoutTotal");
  const confirmButton = document.querySelector(".confirm-btn");
  const summaryNote = document.querySelector(".checkout-summary__note");
  const { subtotal, shipping, total } = getSummaryValues();
  const itemCount = Number(activeCart?.summary?.itemCount || 0);

  if (fulfillmentElement) fulfillmentElement.textContent = selectedFulfillment === "delivery" ? "Delivery" : "Pickup";
  if (subtotalElement) subtotalElement.textContent = formatPrice(subtotal);
  if (shippingElement) shippingElement.textContent = formatPrice(shipping);
  if (totalElement) totalElement.textContent = formatPrice(total);

  if (summaryNote) {
    summaryNote.textContent = itemCount
      ? "This checkout is connected to your live AutoFix cart and will create a real routed order."
      : "Add compatible parts to your cart first, then return to checkout.";
  }

  if (confirmButton) {
    const isEmpty = itemCount === 0;
    confirmButton.disabled = isEmpty;
    confirmButton.textContent = isEmpty ? "Cart Is Empty" : "Confirm Order";
  }
}

function prefillUser(user) {
  const fullNameInput = document.getElementById("fullName");
  const phoneInput = document.getElementById("phone");
  const addressInput = document.getElementById("address");
  const cityInput = document.getElementById("city");

  if (fullNameInput) fullNameInput.value = user?.fullName || "";
  if (phoneInput) phoneInput.value = user?.phone || "";
  if (addressInput) addressInput.value = user?.addressLine || "";
  if (cityInput) cityInput.value = user?.city || "";
}

async function initCheckout() {
  const guestCart = window.AutoFixCommerce.buildGuestCartState();

  if (!window.AutoFixCommerce.isAuthenticated()) {
    if (guestCart.items.length) {
      window.AutoFixToast.warning("Please sign in first so AutoFix can attach this order to your account and route it to the correct dealer.");
      window.location.href = "signin.html?redirect=checkout.html";
      return;
    }

    activeCart = guestCart;
    updateCheckoutSummary();
    return;
  }

  try {
    const user = await window.AutoFixAuth.refreshSessionUser();
    prefillUser(user);

    const syncResult = await window.AutoFixCommerce.syncGuestCartToServer();
    if (syncResult.failed?.length) {
      window.AutoFixToast.warning("Some old preview items were skipped. Re-add them from a fitment-ready product page before checkout.");
    }

    activeCart = syncResult.cart;
    updateCheckoutSummary();
  } catch (error) {
    window.AutoFixToast.error(error.message || "Unable to prepare checkout right now.");
  }
}

function selectFulfillment(method, e) {
  selectedFulfillment = String(method || "delivery").trim().toLowerCase();

  const options = document.querySelectorAll(".fulfillment-methods .option");
  options.forEach((opt) => opt.classList.remove("active", "option--selected"));

  if (e?.currentTarget) {
    e.currentTarget.classList.add("active", "option--selected");
  }

  updateCheckoutSummary();
}

function selectPayment(method, e) {
  selectedPayment = String(method || "").trim().toLowerCase();

  const options = document.querySelectorAll(".payment-methods .option");
  options.forEach((opt) => opt.classList.remove("active", "option--selected"));

  if (e?.currentTarget) {
    e.currentTarget.classList.add("active", "option--selected");
  }
}

async function confirmOrder() {
  const fullName = document.getElementById("fullName")?.value.trim() || "";
  const phone = document.getElementById("phone")?.value.trim() || "";
  const addressLine = document.getElementById("address")?.value.trim() || "";
  const city = document.getElementById("city")?.value.trim() || "";

  if (!window.AutoFixCommerce.isAuthenticated()) {
    window.location.href = "signin.html?redirect=checkout.html";
    return;
  }

  if (!fullName || !phone || !addressLine || !city) {
    window.AutoFixToast.warning("Please fill all fields");
    return;
  }

  if (!selectedPayment) {
    window.AutoFixToast.warning("Please select payment method");
    return;
  }

  if (!activeCart?.items?.length) {
    window.AutoFixToast.warning("Your cart is empty");
    return;
  }

  try {
    const order = await window.AutoFixCommerce.createOrder({
      fullName,
      phone,
      addressLine,
      city,
      fulfillmentMethod: selectedFulfillment,
      paymentMethod: selectedPayment
    });

    const currentUser = window.AutoFixAuth.getUser();
    if (currentUser) {
      window.AutoFixAuth.saveSession(window.AutoFixAuth.getToken(), {
        ...currentUser,
        fullName,
        phone,
        addressLine,
        city
      });
    }

    window.location.href = `order.html?order=${encodeURIComponent(order.id)}`;
  } catch (error) {
    window.AutoFixToast.error(error.message || "Unable to confirm this order right now.");
  }
}

window.selectFulfillment = selectFulfillment;
window.selectPayment = selectPayment;
window.confirmOrder = confirmOrder;

document.addEventListener("DOMContentLoaded", initCheckout);
