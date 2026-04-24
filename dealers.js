const dealersGrid = document.getElementById("dealersGrid");
const params = new URLSearchParams(window.location.search);
const selectedDealerQuery = params.get("dealer");

function formatBrands(brands) {
  return (brands || []).map((brand) => brand.name).join(", ");
}

function clearVehicleSelectionForDealer() {
  [
    "selectedBrand",
    "selectedModel",
    "selectedModelName",
    "selectedYear",
    "selectedPartId",
    "selectedPartSlug",
    "selectedProductMode",
    "carSupportedProducts",
    "selectedGroup",
    "selectedProductIndex",
    "product",
    "pendingPartKey"
  ].forEach((key) => localStorage.removeItem(key));
}

function openDealerVehicles(dealerId) {
  const dealer = window.__autoFixDealers?.find((item) => item.id === dealerId);

  if (!dealer) {
    return;
  }

  clearVehicleSelectionForDealer();
  localStorage.setItem("selectedCatalogScope", "dealer");
  localStorage.setItem("selectedDealerId", String(dealer.id));
  localStorage.setItem("selectedDealerSlug", dealer.slug);
  localStorage.setItem("selectedDealerName", dealer.name);
  window.location.href = "dealerParts.html";
}

function renderDealers(dealers) {
  if (!dealers.length) {
    dealersGrid.innerHTML = `
      <div class="catalog-empty">
        <h3>No dealers found</h3>
        <p>AutoFix could not load dealer coverage right now.</p>
      </div>
    `;
    return;
  }

  dealersGrid.innerHTML = dealers
    .map(
      (dealer) => `
        <div class="dealer-card">
          <img src="${dealer.image}" alt="${dealer.name}" onerror="this.src='./pictures/autofix logo.png'">
          <h3>${dealer.name}</h3>
          <p class="dealer-meta"><i class="fa-solid fa-location-dot"></i> ${dealer.location}</p>
          <p class="dealer-rating">${dealer.brands.length} supported brands</p>
          <p class="dealer-brands"><strong>Supported brands:</strong> ${formatBrands(dealer.brands)}</p>
          <p class="dealer-description">${dealer.description}</p>
          <div class="dealer-actions">
            <button type="button" data-dealer-id="${dealer.id}">View Supported Cars</button>
          </div>
        </div>
      `
    )
    .join("");

  dealersGrid.querySelectorAll("[data-dealer-id]").forEach((button) => {
    button.addEventListener("click", () => openDealerVehicles(Number(button.dataset.dealerId)));
  });
}

async function initDealersPage() {
  try {
    const dealers = await window.AutoFixCatalogApi.fetchDealers();
    window.__autoFixDealers = dealers;
    const filteredDealers = selectedDealerQuery
      ? dealers.filter((dealer) => dealer.slug === selectedDealerQuery || String(dealer.id) === selectedDealerQuery)
      : dealers;

    renderDealers(filteredDealers);
  } catch (error) {
    renderDealers([]);
  }
}

window.openDealerVehicles = openDealerVehicles;
initDealersPage();
