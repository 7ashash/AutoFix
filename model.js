const container = document.getElementById("modelsContainer");
const yearSection = document.getElementById("yearSection");
const yearsContainer = document.getElementById("yearsContainer");

const heroEyebrow = document.getElementById("vehicleHeroEyebrow");
const heroTitle = document.getElementById("vehicleHeroTitle");
const heroSubtitle = document.getElementById("vehicleHeroSubtitle");
const availableModelsCount = document.getElementById("availableModelsCount");
const vehicleFlowLabel = document.getElementById("vehicleFlowLabel");
const brandHeroLogo = document.getElementById("brandHeroLogo");
const brandHeroName = document.getElementById("brandHeroName");
const brandHeroMeta = document.getElementById("brandHeroMeta");
const modelsSectionTitle = document.getElementById("modelsSectionTitle");
const modelsSectionSubtitle = document.getElementById("modelsSectionSubtitle");
const selectedModelStatus = document.getElementById("selectedModelStatus");
const yearSectionTitle = document.getElementById("yearSectionTitle");
const selectedYearStatus = document.getElementById("selectedYearStatus");
const backLink = document.getElementById("vehicleBackLink");

const selectedBrand = window.AutoFixCatalogApi?.normalizeBrandKey(localStorage.getItem("selectedBrand")) || "";
const selectedCatalogScope = localStorage.getItem("selectedCatalogScope") || "marketplace";
const selectedDealerId = localStorage.getItem("selectedDealerId") || "";
const selectedDealerSlug = localStorage.getItem("selectedDealerSlug") || "";
const selectedDealerName = localStorage.getItem("selectedDealerName") || "";
const isDealerScoped = selectedCatalogScope === "dealer" && Boolean(selectedDealerId || selectedDealerSlug);

const storedModelKey = (localStorage.getItem("selectedModel") || "").trim().toLowerCase();
const storedYearValue = Number(localStorage.getItem("selectedYear") || 0);

let models = [];
let selectedModel = null;

function getBrandLabel(brandKey) {
  if (window.getAutoFixBrandName) {
    return window.getAutoFixBrandName(brandKey);
  }

  return String(brandKey || "").toUpperCase();
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

function clearFitmentState({ keepBrand = true, keepDealer = true } = {}) {
  if (!keepBrand) {
    localStorage.removeItem("selectedBrand");
  }

  if (!keepDealer) {
    localStorage.removeItem("selectedDealerId");
    localStorage.removeItem("selectedDealerSlug");
    localStorage.removeItem("selectedDealerName");
    localStorage.removeItem("selectedCatalogScope");
  }

  [
    "selectedModel",
    "selectedModelName",
    "selectedYear",
    "selectedPartId",
    "selectedPartSlug",
    "selectedProductMode",
    "carSupportedProducts",
    "product"
  ].forEach((key) => localStorage.removeItem(key));
}

function renderEmptyState(titleText, descriptionText) {
  container.innerHTML = `
    <div class="vehicle-empty-state">
      <h3>${titleText}</h3>
      <p>${descriptionText}</p>
    </div>
  `;
}

function updateSelectionStatus(model) {
  if (selectedModelStatus) {
    selectedModelStatus.textContent = model
      ? `Selected model: ${model.name}`
      : "No model selected yet";
  }

  if (selectedYearStatus) {
    selectedYearStatus.textContent = model
      ? `Next step: choose the manufactured year for ${model.name}`
      : "Select a model first";
  }
}

function highlightSelectedModel() {
  document.querySelectorAll(".vehicle-model-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.modelKey === selectedModel?.key);
  });
}

function renderYears(model) {
  if (!yearsContainer) {
    return;
  }

  const years = model?.availableYears || [];

  if (!years.length) {
    yearsContainer.innerHTML = `
      <div class="vehicle-empty-state">
        <h3>No supported years</h3>
        <p>AutoFix could not find fitment-ready years for this model yet.</p>
      </div>
    `;
    return;
  }

  yearsContainer.innerHTML = years
    .map(
      (year) => `
        <button class="year ${storedYearValue === year.value && selectedModel?.key === model.key ? "active" : ""}" type="button" data-year="${year.value}">
          ${year.label}
        </button>
      `
    )
    .join("");

  yearsContainer.querySelectorAll(".year").forEach((button) => {
    button.addEventListener("click", () => handleYearSelection(model, Number(button.dataset.year)));
  });
}

function renderModels() {
  if (!models.length) {
    renderEmptyState(
      "No supported models",
      isDealerScoped
        ? "This brand does not have fitment-ready models available yet for the selected dealer scope."
        : "This brand does not have fitment-ready models available yet in the marketplace flow."
    );
    return;
  }

  container.innerHTML = models
    .map(
      (model) => `
        <article class="vehicle-model-card ${selectedModel?.key === model.key ? "active" : ""}" data-model-key="${model.key}">
          <div class="vehicle-model-card__media">
            <span class="vehicle-model-card__series">${model.profileLabel}</span>
            <img src="${model.image}" alt="${model.name}" onerror="this.src='./pictures/autofix logo.png'">
          </div>

          <div class="vehicle-model-card__body">
            <h3>${model.name}</h3>
            <p>${model.profileDescription}</p>

            <div class="vehicle-model-card__footer">
              <div class="vehicle-model-card__chips">
                <span class="vehicle-chip">${model.availableYears.length} years</span>
                <span class="vehicle-chip">${model.partCount} parts</span>
              </div>

              <span class="vehicle-model-card__arrow">
                <i class="fa-solid fa-arrow-right"></i>
              </span>
            </div>
          </div>
        </article>
      `
    )
    .join("");

  container.querySelectorAll(".vehicle-model-card").forEach((card) => {
    card.addEventListener("click", () => {
      const model = models.find((item) => item.key === card.dataset.modelKey);
      selectModel(model);
    });
  });
}

function setHeroContent(data) {
  const brand = data?.brand;
  const dealer = data?.dealer;
  const brandLabel = brand?.name || getBrandLabel(selectedBrand);

  if (heroEyebrow) {
    heroEyebrow.textContent = dealer
      ? `Dealer Fitment - ${dealer.name}`
      : "Vehicle Fitment Flow";
  }

  if (heroTitle) {
    heroTitle.textContent = brand
      ? `Choose your ${brandLabel} model`
      : "Choose your vehicle brand first";
  }

  if (heroSubtitle) {
    heroSubtitle.textContent = dealer
      ? `Browse only the ${brandLabel} models supported by ${dealer.name}, then choose the manufactured year to unlock compatible spare parts.`
      : `Browse ${brandLabel} models, then choose the manufactured year to unlock compatible spare parts only.`;
  }

  if (availableModelsCount) {
    availableModelsCount.textContent = String(models.length);
  }

  if (vehicleFlowLabel) {
    vehicleFlowLabel.textContent = dealer ? "Dealer to Model to Year" : "Model to Year";
  }

  if (brandHeroLogo) {
    brandHeroLogo.src = brand?.logo || "./pictures/autofix logo.png";
    brandHeroLogo.alt = `${brandLabel} logo`;
  }

  if (brandHeroName) {
    brandHeroName.textContent = brandLabel;
  }

  if (brandHeroMeta) {
    brandHeroMeta.textContent = dealer
      ? `Available through ${dealer.name}. Choose the exact model before browsing fitment-ready parts.`
      : "Choose the exact model before moving to year and compatible spare parts.";
  }

  if (modelsSectionTitle) {
    modelsSectionTitle.textContent = brand
      ? `${brandLabel} models available now`
      : "Pick your model";
  }

  if (modelsSectionSubtitle) {
    modelsSectionSubtitle.textContent = dealer
      ? "These models are scoped to the selected dealer network and will continue through the real compatibility flow."
      : "Each model below continues through the real AutoFix compatibility flow.";
  }

  if (yearSectionTitle) {
    yearSectionTitle.textContent = brand
      ? `${brandLabel} manufactured year`
      : "Choose manufactured year";
  }

  if (backLink) {
    backLink.href = dealer ? "dealerParts.html" : "index.html#brandSelectionSection";
  }
}

function selectModel(model, skipScroll = false) {
  if (!model) {
    return;
  }

  selectedModel = model;
  localStorage.setItem("selectedModel", model.key);
  localStorage.setItem("selectedModelName", model.name);
  localStorage.removeItem("selectedYear");
  localStorage.removeItem("selectedPartId");
  localStorage.removeItem("selectedPartSlug");
  localStorage.removeItem("selectedProductMode");

  highlightSelectedModel();
  updateSelectionStatus(model);
  renderYears(model);

  if (!skipScroll && yearSection) {
    yearSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function handleYearSelection(model, yearValue) {
  if (!model || !yearValue) {
    return;
  }

  localStorage.setItem("selectedYear", String(yearValue));
  selectedYearStatus.textContent = `${model.name} - ${yearValue} selected`;

  yearsContainer.querySelectorAll(".year").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.year) === yearValue);
  });

  setTimeout(() => {
    window.location.href = "car-products.html";
  }, 220);
}

async function init() {
  if (!selectedBrand) {
    setHeroContent(null);
    renderEmptyState(
      "Choose a brand first",
      "Go back to the home page or dealer flow, choose a brand, then return here to continue."
    );
    return;
  }

  try {
    const data = await window.AutoFixCatalogApi.fetchBrandModels(selectedBrand, getDealerQuery());
    models = data.models || [];
    setHeroContent(data);
    renderModels();

    const restoredModel = models.find((item) => item.key === storedModelKey) || null;
    if (restoredModel) {
      selectModel(restoredModel, true);
    } else {
      updateSelectionStatus(null);
      renderYears(null);
    }
  } catch (error) {
    setHeroContent(null);
    renderEmptyState(
      "Vehicle flow is not ready",
      error.message || "AutoFix could not load the brand models right now."
    );
  }
}

clearFitmentState({ keepBrand: true, keepDealer: true });
if (storedModelKey) {
  localStorage.setItem("selectedModel", storedModelKey);
}
if (storedYearValue) {
  localStorage.setItem("selectedYear", String(storedYearValue));
}

init();
