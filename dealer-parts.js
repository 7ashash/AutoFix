const dealerId = localStorage.getItem("selectedDealerId") || "";
const dealerSlug = localStorage.getItem("selectedDealerSlug") || "";

const dealerTitle = document.getElementById("dealerTitle");
const dealerSubtitle = document.getElementById("dealerSubtitle");
const dealerBrandsCount = document.getElementById("dealerBrandsCount");
const dealerHeroImage = document.getElementById("dealerHeroImage");
const dealerHeroName = document.getElementById("dealerHeroName");
const dealerHeroMeta = document.getElementById("dealerHeroMeta");
const brandsGrid = document.getElementById("partsSections");

function openDealerBrand(brandKey) {
  localStorage.setItem("selectedCatalogScope", "dealer");
  localStorage.setItem("selectedBrand", brandKey);
  localStorage.removeItem("selectedModel");
  localStorage.removeItem("selectedModelName");
  localStorage.removeItem("selectedYear");
  localStorage.removeItem("selectedPartId");
  localStorage.removeItem("selectedPartSlug");
  localStorage.removeItem("selectedProductMode");
  localStorage.removeItem("carSupportedProducts");
  localStorage.removeItem("selectedGroup");
  localStorage.removeItem("selectedProductIndex");
  localStorage.removeItem("product");

  window.location.href = "model.html";
}

function renderEmptyState(titleText, descriptionText) {
  brandsGrid.innerHTML = `
    <div class="vehicle-empty-state">
      <h3>${titleText}</h3>
      <p>${descriptionText}</p>
    </div>
  `;
}

function renderDealer(dealer) {
  dealerTitle.textContent = `${dealer.name} vehicle access`;
  dealerSubtitle.textContent = `${dealer.description} Start by choosing a supported brand, then continue to model and manufactured year before browsing spare parts.`;
  dealerBrandsCount.textContent = String(dealer.brands.length);
  dealerHeroImage.src = dealer.image || "./pictures/autofix logo.png";
  dealerHeroImage.alt = dealer.name;
  dealerHeroName.textContent = dealer.name;
  dealerHeroMeta.textContent = `${dealer.location} - ${dealer.brands.length} supported brands on AutoFix`;

  brandsGrid.innerHTML = dealer.brands
    .map(
      (brand) => `
        <article class="vehicle-brand-card">
          <div class="vehicle-brand-card__logo">
            <img src="${brand.logo || "./pictures/autofix logo.png"}" alt="${brand.name}">
          </div>

          <div class="vehicle-brand-card__body">
            <h3>${brand.name}</h3>
            <p>Open the ${brand.name} vehicle flow, then choose the exact model and year before viewing compatible spare parts.</p>

            <div class="vehicle-brand-card__footer">
              <span class="vehicle-chip">Dealer-ready</span>
              <button type="button" class="vehicle-brand-card__button" data-brand-key="${brand.key}">
                Choose brand
              </button>
            </div>
          </div>
        </article>
      `
    )
    .join("");

  brandsGrid.querySelectorAll("[data-brand-key]").forEach((button) => {
    button.addEventListener("click", () => openDealerBrand(button.dataset.brandKey));
  });
}

async function initDealerPartsPage() {
  if (!dealerId && !dealerSlug) {
    dealerTitle.textContent = "Dealer not selected";
    dealerSubtitle.textContent = "Please go back and choose a dealer first.";
    dealerHeroName.textContent = "AutoFix";
    dealerHeroMeta.textContent = "Open the dealers page first, then return here to browse supported vehicles.";
    dealerBrandsCount.textContent = "0";
    renderEmptyState(
      "No dealer selected",
      "Go back to the dealers page and choose a dealer to browse its supported vehicle brands."
    );
    return;
  }

  try {
    const dealer = await window.AutoFixCatalogApi.fetchDealer(dealerId || dealerSlug);
    renderDealer(dealer);
  } catch (error) {
    dealerTitle.textContent = "Dealer not found";
    dealerSubtitle.textContent = "Please go back and choose a valid dealer first.";
    dealerHeroName.textContent = "AutoFix";
    dealerHeroMeta.textContent = "The selected dealer could not be loaded right now.";
    dealerBrandsCount.textContent = "0";
    renderEmptyState(
      "Dealer not available",
      error.message || "AutoFix could not load this dealer."
    );
  }
}

window.openDealerBrand = openDealerBrand;
initDealerPartsPage();
