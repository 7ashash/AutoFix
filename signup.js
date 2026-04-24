document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("signupForm");
  const redirectParam = new URLSearchParams(window.location.search).get("redirect");
  const safeRedirect = redirectParam && /\.html(?:[?#].*)?$/i.test(redirectParam)
    ? redirectParam
    : "";

  const brandSelect = document.getElementById("signupVehicleBrand");
  const modelSelect = document.getElementById("signupVehicleModel");
  const yearSelect = document.getElementById("signupVehicleYear");

  if (!form || !brandSelect || !modelSelect || !yearSelect) return;

  function setSelectOptions(select, placeholder, items, mapper) {
    select.innerHTML = [`<option value="">${placeholder}</option>`]
      .concat(items.map((item) => mapper(item)))
      .join("");
  }

  function resetModelAndYear() {
    modelSelect.disabled = true;
    yearSelect.disabled = true;
    setSelectOptions(modelSelect, "Select model", [], () => "");
    setSelectOptions(yearSelect, "Select year", [], () => "");
  }

  async function loadBrands() {
    const data = await window.AutoFixCatalogApi.fetchVehicleBrands();
    setSelectOptions(
      brandSelect,
      "Select brand",
      data || [],
      (brand) => `<option value="${brand.key}">${brand.name}</option>`
    );
  }

  async function loadModels(brandKey, selectedModelKey = "") {
    resetModelAndYear();

    if (!brandKey) {
      return;
    }

    const data = await window.AutoFixCatalogApi.fetchBrandModels(brandKey);
    const models = data?.models || [];

    setSelectOptions(
      modelSelect,
      "Select model",
      models,
      (model) => `<option value="${model.key}">${model.name}</option>`
    );
    modelSelect.disabled = false;

    if (selectedModelKey) {
      modelSelect.value = selectedModelKey;
    }
  }

  async function loadYears(modelKey, selectedYearId = "") {
    yearSelect.disabled = true;
    setSelectOptions(yearSelect, "Select year", [], () => "");

    if (!modelKey) {
      return;
    }

    const data = await window.AutoFixCatalogApi.fetchModelYears(modelKey);
    const years = data?.years || [];

    setSelectOptions(
      yearSelect,
      "Select year",
      years,
      (year) => `<option value="${year.id}">${year.label}</option>`
    );
    yearSelect.disabled = false;

    if (selectedYearId) {
      yearSelect.value = String(selectedYearId);
    }
  }

  brandSelect.addEventListener("change", async function () {
    await loadModels(brandSelect.value);
  });

  modelSelect.addEventListener("change", async function () {
    await loadYears(modelSelect.value);
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("signupUsername").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value.trim();
    const confirmPassword = document.getElementById("confirmPassword").value.trim();
    const fullName = document.getElementById("fullName").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const brandKey = brandSelect.value.trim();
    const modelKey = modelSelect.value.trim();
    const vehicleYearId = yearSelect.value.trim();

    if (password !== confirmPassword) {
      window.AutoFixToast.warning("Passwords do not match");
      return;
    }

    if (!brandKey || !modelKey || !vehicleYearId) {
      window.AutoFixToast.warning("Please select your car brand, model, and year");
      return;
    }

    try {
      const data = await window.AutoFixAuth.apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username,
          email,
          password,
          fullName,
          phone,
          brandKey,
          modelKey,
          vehicleYearId
        })
      });

      window.AutoFixAuth.saveSession(data.token, data.user);
      window.location.href = safeRedirect || "index.html";
    } catch (error) {
      window.AutoFixToast.error(error.message || "Unable to create account right now.");
    }
  });

  loadBrands().catch((error) => {
    window.AutoFixToast.error(error.message || "Failed to load vehicle brands");
  });
});
