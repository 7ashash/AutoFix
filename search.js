const params = new URLSearchParams(window.location.search);

const resultsContainer = document.getElementById("results");
const heroTitle = document.getElementById("searchHeroTitle");
const heroSubtitle = document.getElementById("searchHeroSubtitle");
const sectionTitle = document.getElementById("searchSectionTitle");
const sectionSubtitle = document.getElementById("searchSectionSubtitle");
const statusPill = document.getElementById("searchStatusPill");
const countChip = document.getElementById("searchCountChip");
const vehicleChip = document.getElementById("searchVehicleChip");
const searchInput = document.getElementById("searchPageInput");
const searchForm = document.getElementById("searchForm");

const selectedBrand = window.AutoFixCatalogApi?.normalizeBrandKey(localStorage.getItem("selectedBrand")) || "";
const selectedModel = (localStorage.getItem("selectedModel") || "").trim().toLowerCase();
const selectedModelName = localStorage.getItem("selectedModelName") || selectedModel;
const selectedYear = Number(localStorage.getItem("selectedYear") || 0);

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function formatPrice(value) {
  return `${value} EGP`;
}

function getVehicleLabel() {
  if (selectedBrand && selectedModelName && selectedYear) {
    const brandLabel = window.getAutoFixBrandName
      ? window.getAutoFixBrandName(selectedBrand)
      : String(selectedBrand || "").toUpperCase();
    return `${brandLabel} ${selectedModelName} ${selectedYear}`;
  }

  return "Vehicle not selected";
}

function getSearchQuery() {
  return (params.get("query") || "").trim();
}

function getLocalCatalog() {
  return Object.values(window.AutoFixPartCatalog || {}).map((item) => ({
    groupKey: item.key,
    name: item.name,
    image: item.image,
    desc: item.description,
    price: item.priceFrom,
    type: item.type,
    rating: item.rating,
    category: item.category,
    vehicleRequired: item.vehicleRequired,
    keywords: item.keywords || []
  }));
}

function routeToResult(item) {
  localStorage.removeItem("product");
  localStorage.removeItem("selectedProductIndex");
  localStorage.removeItem("selectedGroup");

  if (item.vehicleRequired) {
    if (item.groupKey) {
      localStorage.setItem("pendingPartKey", item.groupKey);
    }

    if (selectedBrand && selectedModel && selectedYear) {
      if (item.id) {
        localStorage.setItem("selectedPartId", String(item.id));
        localStorage.setItem("selectedPartSlug", item.slug);
        localStorage.setItem("selectedProductMode", "fitment");
        window.location.href = "product.html";
        return;
      }

      window.location.href = "car-products.html";
      return;
    }

    if (selectedBrand) {
      window.location.href = "model.html";
      return;
    }

    window.location.href = "index.html#brandSelectionSection";
    return;
  }

  localStorage.removeItem("pendingPartKey");
  localStorage.setItem("selectedGroup", item.groupKey);
  localStorage.setItem("selectedProductIndex", "0");
  window.location.href = "product.html";
}

function renderEmptyState(query) {
  resultsContainer.innerHTML = `
    <div class="search-empty">
      <h3>No matching parts found</h3>
      <p>
        AutoFix could not find results for "${query}". Try another part name, category,
        or a simpler keyword like brake, battery, oil, or coolant.
      </p>
    </div>
  `;
}

function renderResults(results, query) {
  if (!results.length) {
    renderEmptyState(query);
    return;
  }

  resultsContainer.innerHTML = results
    .map((item) => {
      const description = item.desc || item.description || "AutoFix catalog item";
      const price = Number(item.price || item.priceFrom || 0);
      const rating = Number(item.rating || 0);
      const type = item.type || "Catalog Item";
      const vehicleRequired = Boolean(item.vehicleRequired);
      const actionLabel = vehicleRequired ? "Open fitment flow" : "Open catalog item";
      const hint = vehicleRequired
        ? "Vehicle selection comes first for compatibility and fitment."
        : "Opens directly inside the AutoFix catalog flow.";

      return `
        <article class="search-card">
          <div class="search-card__media">
            <div class="search-card__badges">
              <span class="search-card__chip search-card__chip--dark">${item.category || "Catalog"}</span>
              <span class="search-card__chip search-card__chip--soft">${vehicleRequired ? "Vehicle-first" : "Direct item"}</span>
            </div>
            <img src="${item.image}" alt="${item.name}" onerror="this.src='./pictures/autofix logo.png'">
          </div>

          <div class="search-card__body">
            <h3>${item.name}</h3>
            <p>${description}</p>

            <div class="search-card__meta">
              <div class="search-card__stat">
                <span>Starting price</span>
                <strong>${formatPrice(price)}</strong>
              </div>

              <div class="search-card__stat">
                <span>Type / rating</span>
                <strong>${type} · ${rating.toFixed(1)}</strong>
              </div>
            </div>

            <div class="search-card__footer">
              <span class="search-card__hint">${hint}</span>
              <button class="search-card__action" type="button" data-result-key="${item.id ? `part-${item.id}` : item.groupKey}">
                ${actionLabel}
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  resultsContainer.querySelectorAll("[data-result-key]").forEach((button, index) => {
    button.addEventListener("click", () => routeToResult(results[index]));
  });
}

function matchLocalQuery(item, query) {
  const haystack = [
    item.name,
    item.category,
    item.desc || item.description,
    ...(item.keywords || [])
  ]
    .map(normalizeText)
    .join(" ");

  return haystack.includes(normalizeText(query));
}

function dedupeResults(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.id ? `part-${item.id}` : `group-${item.groupKey}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function getResults(query) {
  const localCatalog = getLocalCatalog();
  const localResults = query
    ? localCatalog.filter((item) => matchLocalQuery(item, query))
    : localCatalog;

  if (!query) {
    return localResults;
  }

  try {
    const backendData = await window.AutoFixCatalogApi.fetchPartSearch(query, {
      brandKey: selectedBrand || undefined,
      modelKey: selectedModel || undefined,
      year: selectedYear || undefined
    });

    const backendResults = (backendData.results || []).map((item) => ({
      ...item,
      vehicleRequired: true,
      category: item.category || "Compatible Parts"
    }));

    return dedupeResults([...backendResults, ...localResults]);
  } catch {
    return localResults;
  }
}

async function applySearch(query) {
  const trimmedQuery = query.trim();
  const results = await getResults(trimmedQuery);
  const titleText = trimmedQuery ? `Results for "${trimmedQuery}"` : "Browse the full AutoFix catalog";

  heroTitle.textContent = titleText;
  heroSubtitle.textContent = trimmedQuery
    ? "Compare categories quickly, then continue through the right AutoFix flow for compatibility or direct catalog browsing."
    : "Browse the full AutoFix catalog, then continue through the right flow for vehicle-compatible or direct items.";
  sectionTitle.textContent = titleText;
  sectionSubtitle.textContent = trimmedQuery
    ? "Compatible parts are now pulled from the real AutoFix backend when available."
    : "Use the search bar above to narrow the catalog by part name, category, or a maintenance keyword.";

  statusPill.textContent = `${results.length} ${results.length === 1 ? "result" : "results"}`;
  countChip.textContent = `${results.length} ${results.length === 1 ? "result" : "results"}`;
  renderResults(results, trimmedQuery || "your search");
}

if (vehicleChip) {
  vehicleChip.textContent = getVehicleLabel();
}

if (searchInput) {
  searchInput.value = getSearchQuery();
}

if (searchForm) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const nextQuery = (searchInput?.value || "").trim();
    window.location.href = `search.html?query=${encodeURIComponent(nextQuery)}`;
  });
}

applySearch(getSearchQuery());
