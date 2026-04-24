const productsGrid = document.getElementById("carProductsGrid");
const title = document.getElementById("carProductsTitle");
const subtitle = document.getElementById("carProductsSubtitle");
const selectedVehiclePill = document.getElementById("selectedVehiclePill");
const selectedDealerPill = document.getElementById("selectedDealerPill");
const compatibleCountPill = document.getElementById("compatibleCountPill");
const compatibleCountLabel = document.getElementById("compatibleCountLabel");
const heroEyebrow = document.getElementById("carProductsEyebrow");
const backLink = document.getElementById("compatibleBackLink");

const selectedBrand = window.AutoFixCatalogApi?.normalizeBrandKey(localStorage.getItem("selectedBrand")) || "";
const selectedModel = (localStorage.getItem("selectedModel") || "").trim().toLowerCase();
const selectedModelName = localStorage.getItem("selectedModelName") || selectedModel;
const selectedYear = Number(localStorage.getItem("selectedYear") || 0);
const selectedCatalogScope = localStorage.getItem("selectedCatalogScope") || "marketplace";
const selectedDealerId = localStorage.getItem("selectedDealerId") || "";
const selectedDealerSlug = localStorage.getItem("selectedDealerSlug") || "";
const selectedDealerName = localStorage.getItem("selectedDealerName") || "";
const pendingPartKey = localStorage.getItem("pendingPartKey") || "";
const isDealerScoped = selectedCatalogScope === "dealer" && Boolean(selectedDealerId || selectedDealerSlug);

let displayedProducts = [];
let requestedProduct = null;
let vehicleContext = null;

function formatPrice(value) {
  return `${value} EGP`;
}

function getVehicleLabel() {
  if (vehicleContext?.brand?.name && vehicleContext?.model?.name && vehicleContext?.year) {
    return `${vehicleContext.brand.name} ${vehicleContext.model.name} ${vehicleContext.year}`;
  }

  if (selectedBrand && selectedModelName && selectedYear) {
    const brandLabel = window.getAutoFixBrandName
      ? window.getAutoFixBrandName(selectedBrand)
      : String(selectedBrand || "").toUpperCase();
    return `${brandLabel} ${selectedModelName} ${selectedYear}`;
  }

  return "Vehicle not selected";
}

function getDealerQuery() {
  if (!isDealerScoped) {
    return {};
  }

  if (selectedDealerId) {
    return { dealerId: Number(selectedDealerId) };
  }

  if (selectedDealerSlug) {
    return { dealerSlug: selectedDealerSlug };
  }

  return {};
}

function renderEmptyState(titleText, descriptionText) {
  productsGrid.innerHTML = `
    <div class="catalog-empty">
      <h3>${titleText}</h3>
      <p>${descriptionText}</p>
    </div>
  `;
}

function renderHeroMeta() {
  if (heroEyebrow) {
    heroEyebrow.textContent = isDealerScoped ? "Dealer Compatible Parts" : "Vehicle Compatible Parts";
  }

  if (selectedVehiclePill) {
    selectedVehiclePill.textContent = getVehicleLabel();
  }

  if (selectedDealerPill) {
    selectedDealerPill.textContent = isDealerScoped
      ? (selectedDealerName || vehicleContext?.dealer?.name || "Dealer scope")
      : "AutoFix fitment";
  }

  if (compatibleCountPill) {
    compatibleCountPill.textContent = `${displayedProducts.length} parts`;
  }

  if (compatibleCountLabel) {
    compatibleCountLabel.textContent = `${displayedProducts.length} parts`;
  }

  if (backLink) {
    backLink.href = "model.html";
  }
}

function reorderRequestedProduct(products) {
  if (!pendingPartKey || !window.getAutoFixCompatibleProductByKey) {
    return products;
  }

  requestedProduct = window.getAutoFixCompatibleProductByKey(pendingPartKey, products);
  if (!requestedProduct) {
    return products;
  }

  return [requestedProduct, ...products.filter((item) => item.id !== requestedProduct.id)];
}

function renderProducts() {
  if (!displayedProducts.length) {
    renderEmptyState(
      "No compatible parts found",
      "AutoFix did not find fitment-ready parts for the selected combination right now."
    );
    return;
  }

  productsGrid.innerHTML = displayedProducts
    .map((product) => {
      const isRequested = requestedProduct && product.id === requestedProduct.id;

      return `
        <article class="compatible-card ${isRequested ? "compatible-card--requested" : ""}" data-part-id="${product.id}">
          <div class="compatible-card__media">
            ${isRequested ? '<span class="compatible-card__badge">Requested First</span>' : ""}
            <img src="${product.image}" alt="${product.name}" onerror="this.src='./pictures/autofix logo.png'">
          </div>

          <div class="compatible-card__body">
            <h3>${product.name}</h3>
            <p>${product.desc}</p>

            <div class="compatible-card__meta">
              <span class="compatible-chip">${product.type}</span>
              <span class="compatible-chip">Rating ${product.rating.toFixed(1)}</span>
              <span class="compatible-chip">${product.dealer.name}</span>
            </div>

            <div class="compatible-card__footer">
              <strong class="compatible-card__price">${formatPrice(product.price)}</strong>
              <span class="compatible-card__arrow">
                <i class="fa-solid fa-arrow-right"></i>
              </span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  productsGrid.querySelectorAll(".compatible-card").forEach((card) => {
    card.addEventListener("click", () => openSupportedProduct(Number(card.dataset.partId)));
  });
}

function openSupportedProduct(partId) {
  const product = displayedProducts.find((item) => item.id === partId);

  if (!product) {
    return;
  }

  localStorage.removeItem("selectedGroup");
  localStorage.removeItem("selectedProductIndex");
  localStorage.removeItem("product");
  localStorage.removeItem("pendingPartKey");
  localStorage.setItem("selectedPartId", String(product.id));
  localStorage.setItem("selectedPartSlug", product.slug);
  localStorage.setItem("selectedProductMode", "fitment");

  window.location.href = "product.html";
}

async function init() {
  if (!selectedBrand || !selectedModel || !selectedYear) {
    title.textContent = "Choose your vehicle first";
    subtitle.textContent = "Select a brand, model, and year so AutoFix can show only compatible parts.";
    renderHeroMeta();
    renderEmptyState(
      "No vehicle selected",
      "Go back and choose the brand, model, and manufactured year first."
    );
    return;
  }

  try {
    const data = await window.AutoFixCatalogApi.fetchCompatibleParts({
      brandKey: selectedBrand,
      modelKey: selectedModel,
      year: selectedYear,
      ...getDealerQuery()
    });

    vehicleContext = {
      ...data.vehicle,
      dealer: data.dealer
    };
    displayedProducts = reorderRequestedProduct(data.parts || []);

    title.textContent = `${getVehicleLabel()} compatible parts`;
    subtitle.textContent = isDealerScoped
      ? `Filtered for vehicles supported by ${selectedDealerName}, with only fitment-ready products shown here.`
      : "Only fitment-ready parts for your selected vehicle are shown in this AutoFix view.";

    renderHeroMeta();
    renderProducts();
  } catch (error) {
    title.textContent = "Compatible products are not ready";
    subtitle.textContent = "AutoFix could not load the compatible parts right now.";
    renderHeroMeta();
    renderEmptyState("Unable to load compatible parts", error.message || "Please try again.");
  }
}

window.openSupportedProduct = openSupportedProduct;
init();
