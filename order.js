const heroTitle = document.getElementById("orderHeroTitle");
const heroSubtitle = document.getElementById("orderHeroSubtitle");
const orderNumberPill = document.getElementById("orderNumberPill");
const orderMethodPill = document.getElementById("orderMethodPill");
const orderContent = document.getElementById("orderContent");
const customerInfo = document.getElementById("customerInfo");
const orderItems = document.getElementById("orderItems");
const orderSummary = document.getElementById("orderSummary");
const orderHistory = document.getElementById("orderHistory");

function formatPrice(value) {
  return `${Number(value || 0)} EGP`;
}

function renderEmptyState(title = "No order found", subtitle = "Complete checkout first, then AutoFix will show the confirmation summary here.") {
  heroTitle.textContent = title;
  heroSubtitle.textContent = subtitle;
  orderNumberPill.textContent = "Order unavailable";
  orderMethodPill.textContent = "Start from cart";

  orderContent.innerHTML = `
    <div class="order-empty">
      <h3>There is no confirmed order yet</h3>
      <p>Go back to your cart, finish checkout, and return here to review the confirmation details.</p>
    </div>
  `;
}

function renderCustomerInfo(order) {
  customerInfo.innerHTML = `
    <div class="order-info-item">
      <span>Full name</span>
      <strong>${order.customerFullName}</strong>
    </div>

    <div class="order-info-item">
      <span>Phone</span>
      <strong>${order.phone}</strong>
    </div>

    <div class="order-info-item">
      <span>Address</span>
      <strong>${order.addressLine}</strong>
    </div>

    <div class="order-info-item">
      <span>City</span>
      <strong>${order.city}</strong>
    </div>

    <div class="order-info-item">
      <span>Payment</span>
      <strong>${order.paymentMethod}</strong>
    </div>

    <div class="order-info-item">
      <span>Fulfillment</span>
      <strong>${order.fulfillmentMethod}</strong>
    </div>
  `;
}

function renderOrderItems(order) {
  orderItems.innerHTML = order.items
    .map((item) => `
      <article class="order-item">
        <div class="order-item__media">
          <img src="${item.part.image || "./pictures/autofix logo.png"}" alt="${item.part.name}" onerror="this.src='./pictures/autofix logo.png'">
        </div>

        <div class="order-item__body">
          <h3>${item.part.name}</h3>

          <div class="order-item__meta">
            <span class="order-chip">${item.part.type}</span>
            <span class="order-chip">Qty ${item.quantity}</span>
            ${item.vehicle ? `<span class="order-chip">${item.vehicle.name} ${item.vehicle.year}</span>` : ""}
          </div>

          <p class="order-item__price">
            ${item.dealer.name} / Unit price: ${formatPrice(item.unitPrice)}
          </p>
        </div>

        <div class="order-item__side">
          <span>Line total</span>
          <strong>${formatPrice(item.lineTotal)}</strong>
        </div>
      </article>
    `)
    .join("");
}

function renderSummary(order) {
  orderSummary.innerHTML = `
    <div class="order-summary__top">
      <div>
        <span class="order-step">Summary</span>
        <h3>Review your confirmed order</h3>
      </div>
      <span class="order-badge">${order.paymentMethod}</span>
    </div>

    <div class="order-summary__rows">
      <div class="order-summary__row">
        <span>Order number</span>
        <strong>${order.orderNumber}</strong>
      </div>

      <div class="order-summary__row">
        <span>Order date</span>
        <strong>${new Date(order.createdAt).toLocaleString()}</strong>
      </div>

      <div class="order-summary__row">
        <span>Fulfillment</span>
        <strong>${order.fulfillmentMethod}</strong>
      </div>

      <div class="order-summary__row">
        <span>Status</span>
        <strong>${order.status}</strong>
      </div>

      <div class="order-summary__row">
        <span>Subtotal</span>
        <strong>${formatPrice(order.subtotal)}</strong>
      </div>

      <div class="order-summary__row">
        <span>Shipping</span>
        <strong>${formatPrice(order.shippingFee)}</strong>
      </div>

      <div class="order-summary__row order-summary__row--total">
        <span>Total</span>
        <strong>${formatPrice(order.totalAmount)}</strong>
      </div>
    </div>

    <p class="order-summary__note">
      This confirmation comes from the live AutoFix backend and keeps your routed order history in one place.
    </p>

    <div class="order-summary__actions">
      <a class="order-btn order-btn--primary" href="index.html#replacementSection">Continue shopping</a>
      <a class="order-btn order-btn--soft" href="cart.html">Back to cart</a>
    </div>
  `;
}

function renderHistory(orders, activeOrderId) {
  if (!orders.length) {
    orderHistory.innerHTML = `
      <div class="order-history-empty">
        <h3>No previous orders</h3>
        <p>Your routed AutoFix orders will appear here after checkout.</p>
      </div>
    `;
    return;
  }

  orderHistory.innerHTML = orders
    .map((order) => `
      <a class="order-history-item ${Number(order.id) === Number(activeOrderId) ? "is-active" : ""}" href="order.html?order=${order.id}">
        <div>
          <strong>${order.orderNumber}</strong>
          <span>${new Date(order.createdAt).toLocaleDateString()} / ${order.itemCount} item${order.itemCount === 1 ? "" : "s"}</span>
        </div>

        <div class="order-history-item__side">
          <em>${order.status}</em>
          <span>${formatPrice(order.totalAmount)}</span>
        </div>
      </a>
    `)
    .join("");
}

async function initOrderPage() {
  if (!window.AutoFixCommerce.isAuthenticated()) {
    window.location.href = "signin.html?redirect=order.html";
    return;
  }

  try {
    await window.AutoFixAuth.refreshSessionUser();
    const params = new URLSearchParams(window.location.search);
    const requestedOrderId = Number(params.get("order") || window.AutoFixCommerce.getLastOrderId() || 0);
    const orders = await window.AutoFixCommerce.fetchOrders();

    if (!orders.length) {
      renderEmptyState();
      return;
    }

    const activeOrderId = requestedOrderId || orders[0].id;
    let order = null;

    try {
      order = await window.AutoFixCommerce.fetchOrder(activeOrderId);
    } catch (error) {
      if (error.statusCode === 404) {
        order = await window.AutoFixCommerce.fetchLatestOrder();
      } else {
        throw error;
      }
    }

    window.AutoFixCommerce.setLastOrderId(order.id);
    orderNumberPill.textContent = order.orderNumber || "Order confirmed";
    orderMethodPill.textContent = `${order.fulfillmentMethod} / ${order.paymentMethod}`;
    heroTitle.textContent = "Your order was confirmed successfully";
    heroSubtitle.textContent = "AutoFix saved your delivery details, routed parts, and confirmation summary to your live order history.";

    renderCustomerInfo(order);
    renderOrderItems(order);
    renderSummary(order);
    renderHistory(orders, order.id);
  } catch (error) {
    renderEmptyState("Unable to load your order", error.message || "Try refreshing the page again.");
  }
}

document.addEventListener("DOMContentLoaded", initOrderPage);
