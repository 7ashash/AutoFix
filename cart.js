const container = document.getElementById("cartContainer");
const subtotalPrice = document.getElementById("subtotalPrice");
const shippingPrice = document.getElementById("shippingPrice");
const totalPrice = document.getElementById("totalPrice");
const cartItemCount = document.getElementById("cartItemCount");
const cartSummaryNote = document.getElementById("cartSummaryNote");
const checkoutBtn = document.getElementById("checkoutBtn");

let currentCartState = {
  mode: "guest",
  items: [],
  summary: {
    uniqueItems: 0,
    itemCount: 0,
    subtotal: 0,
    estimatedShipping: 0,
    estimatedTotal: 0
  }
};

function formatPrice(value) {
  return `${Number(value || 0)} EGP`;
}

function renderEmptyCart(mode = "guest") {
  const helperText = mode === "server"
    ? "Start from your car brand first, then add compatible spare parts to this live AutoFix cart."
    : "Start from your car brand first, then sign in before checkout to route the order to the right dealer.";

  container.innerHTML = `
    <div class="empty-cart">
      <div class="empty-cart__icon">AF</div>
      <h3>Your cart is empty</h3>
      <p>${helperText}</p>
      <a class="empty-cart__link" href="index.html#brandSelectionSection">Browse spare parts</a>
    </div>
  `;

  subtotalPrice.innerText = formatPrice(0);
  shippingPrice.innerText = formatPrice(0);
  totalPrice.innerText = formatPrice(0);
  cartItemCount.innerText = "0 items";
  cartSummaryNote.innerText = "Add compatible parts to continue to checkout.";
  checkoutBtn.disabled = true;
}

function renderCartItems(items, mode) {
  container.innerHTML = items
    .map((item) => {
      const quantity = Number(item.quantity || 1);
      const unitPrice = Number(item.part?.price || 0);
      const lineTotal = Number(item.lineTotal || (quantity * unitPrice));
      const vehicleLabel = item.vehicle
        ? `${item.vehicle.name} ${item.vehicle.year || ""}`.trim()
        : "Vehicle not selected";
      const syncNote = mode === "guest" && !item.syncEligible
        ? '<span class="item-pill item-pill--warning">Preview only</span>'
        : "";
      const ref = mode === "server" ? item.cartItemId : item.guestIndex;

      return `
        <article class="cart-item">
          <div class="cart-item__image-wrap">
            <img src="${item.part?.image || "./pictures/autofix logo.png"}" alt="${item.part?.name || "Part"}" onerror="this.src='./pictures/autofix logo.png'" />
          </div>

          <div class="item-info">
            <h3>${item.part?.name || "AutoFix Part"}</h3>

            <div class="item-meta">
              <span class="item-pill">${item.part?.type || "AutoFix Part"}</span>
              <span class="item-pill">${formatPrice(unitPrice)} / item</span>
              ${syncNote}
            </div>

            <p class="item-price">Unit price: ${formatPrice(unitPrice)}</p>
            <div class="item-context">
              <span>${vehicleLabel}</span>
              <span>${item.dealer?.name || "AutoFix catalog"}</span>
            </div>

            <div class="item-actions">
              <div class="quantity">
                <button type="button" onclick="decreaseQuantity('${ref}')">-</button>
                <span>${quantity}</span>
                <button type="button" onclick="increaseQuantity('${ref}')">+</button>
              </div>

              <button class="remove-btn" type="button" onclick="removeItem('${ref}')">Remove item</button>
            </div>
          </div>

          <div class="cart-item__side">
            <span class="cart-item__label">Line Total</span>
            <strong class="cart-item__total">${formatPrice(lineTotal)}</strong>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSummary(cartState) {
  subtotalPrice.innerText = formatPrice(cartState.summary?.subtotal || 0);
  shippingPrice.innerText = formatPrice(cartState.summary?.estimatedShipping || 0);
  totalPrice.innerText = formatPrice(cartState.summary?.estimatedTotal || 0);
  cartItemCount.innerText = `${cartState.summary?.itemCount || 0} ${cartState.summary?.itemCount === 1 ? "item" : "items"}`;
  checkoutBtn.disabled = !(cartState.items || []).length;

  if (cartState.mode === "server") {
    cartSummaryNote.innerText = "This live cart is connected to your AutoFix account and will route orders to the correct dealer.";
  } else {
    cartSummaryNote.innerText = "Guest cart is saved locally. Sign in at checkout to sync it with your AutoFix account.";
  }
}

function renderCart(cartState) {
  currentCartState = cartState;

  if (!Array.isArray(cartState.items) || cartState.items.length === 0) {
    renderEmptyCart(cartState.mode);
    return;
  }

  renderCartItems(cartState.items, cartState.mode);
  renderSummary(cartState);
}

async function refreshCart() {
  try {
    const isLoggedIn = window.AutoFixCommerce.isAuthenticated();

    if (isLoggedIn) {
      const syncResult = await window.AutoFixCommerce.syncGuestCartToServer();
      if (syncResult.failed?.length) {
        window.AutoFixToast.warning("Some old preview items could not be moved to your live cart. Re-add them from a fitment-ready product page.");
      }
      renderCart(syncResult.cart);
      return;
    }

    renderCart(await window.AutoFixCommerce.fetchCart());
  } catch (error) {
    container.innerHTML = `
      <div class="empty-cart">
        <div class="empty-cart__icon">!</div>
        <h3>Unable to load cart</h3>
        <p>${error.message || "Try refreshing the page again."}</p>
      </div>
    `;
  }
}

async function updateQuantity(ref, nextQuantity) {
  try {
    const result = await window.AutoFixCommerce.updateCartItem(ref, nextQuantity);
    renderCart(result.cart);
  } catch (error) {
    window.AutoFixToast.error(error.message || "Unable to update cart right now.");
  }
}

async function increaseQuantity(ref) {
  const item = currentCartState.items.find((entry) => String(currentCartState.mode === "server" ? entry.cartItemId : entry.guestIndex) === String(ref));
  const currentQuantity = Number(item?.quantity || 1);
  await updateQuantity(ref, currentQuantity + 1);
}

async function decreaseQuantity(ref) {
  const item = currentCartState.items.find((entry) => String(currentCartState.mode === "server" ? entry.cartItemId : entry.guestIndex) === String(ref));
  const currentQuantity = Number(item?.quantity || 1);

  if (currentQuantity <= 1) {
    await removeItem(ref);
    return;
  }

  await updateQuantity(ref, currentQuantity - 1);
}

async function removeItem(ref) {
  try {
    const result = await window.AutoFixCommerce.removeCartItem(ref);
    renderCart(result.cart);
  } catch (error) {
    window.AutoFixToast.error(error.message || "Unable to remove this cart item right now.");
  }
}

function goToCheckout() {
  if (!currentCartState.items?.length) {
    return;
  }

  window.location.href = "checkout.html";
}

window.increaseQuantity = increaseQuantity;
window.decreaseQuantity = decreaseQuantity;
window.removeItem = removeItem;
window.goToCheckout = goToCheckout;

document.addEventListener("DOMContentLoaded", refreshCart);
