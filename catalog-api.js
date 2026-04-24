(function () {
  const authApi = window.AutoFixAuth;

  function ensureApi() {
    if (!authApi?.apiFetch) {
      throw new Error("AutoFixAuth apiFetch is not available");
    }
  }

  function normalizeBrandKey(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "chevorlet") {
      return "chevrolet";
    }
    return normalized;
  }

  function denormalizeBrandKey(value) {
    const normalized = normalizeBrandKey(value);
    if (normalized === "chevrolet" && window.AutoFixBrandCatalog?.chevorlet) {
      return "chevorlet";
    }
    return normalized;
  }

  function buildQuery(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.set(key, value);
      }
    });
    return searchParams.toString() ? `?${searchParams.toString()}` : "";
  }

  async function fetchVehicleBrands() {
    ensureApi();
    return authApi.apiFetch("/vehicles/brands");
  }

  async function fetchBrandModels(brandKey, options = {}) {
    ensureApi();
    return authApi.apiFetch(
      `/vehicles/brands/${encodeURIComponent(normalizeBrandKey(brandKey))}/models${buildQuery(options)}`
    );
  }

  async function fetchModelYears(modelKey, options = {}) {
    ensureApi();
    return authApi.apiFetch(
      `/vehicles/models/${encodeURIComponent(String(modelKey || "").trim().toLowerCase())}/years${buildQuery(options)}`
    );
  }

  async function fetchCompatibleParts(filters) {
    ensureApi();
    const normalizedFilters = {
      ...filters,
      brandKey: normalizeBrandKey(filters?.brandKey)
    };
    return authApi.apiFetch(`/parts/compatible${buildQuery(normalizedFilters)}`);
  }

  async function fetchPartDetails(partRef, filters = {}) {
    ensureApi();
    const normalizedFilters = {
      ...filters,
      brandKey: normalizeBrandKey(filters?.brandKey)
    };
    return authApi.apiFetch(`/parts/${encodeURIComponent(partRef)}${buildQuery(normalizedFilters)}`);
  }

  async function fetchPartSearch(query, filters = {}) {
    ensureApi();
    const normalizedFilters = {
      ...filters,
      brandKey: normalizeBrandKey(filters?.brandKey),
      query
    };
    return authApi.apiFetch(`/parts/search${buildQuery(normalizedFilters)}`);
  }

  async function fetchDealers() {
    ensureApi();
    return authApi.apiFetch("/dealers");
  }

  async function fetchDealer(dealerRef) {
    ensureApi();
    return authApi.apiFetch(`/dealers/${encodeURIComponent(dealerRef)}`);
  }

  window.AutoFixCatalogApi = {
    normalizeBrandKey,
    denormalizeBrandKey,
    fetchVehicleBrands,
    fetchBrandModels,
    fetchModelYears,
    fetchCompatibleParts,
    fetchPartDetails,
    fetchPartSearch,
    fetchDealers,
    fetchDealer
  };
})();
