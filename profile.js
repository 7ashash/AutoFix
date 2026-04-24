document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("profileForm");
  const brandSelect = document.getElementById("profileVehicleBrand");
  const modelSelect = document.getElementById("profileVehicleModel");
  const yearSelect = document.getElementById("profileVehicleYear");
  const statusText = document.getElementById("profileFormStatus");
  const profileRoleBadge = document.getElementById("profileRoleBadge");
  const profileStatusBadge = document.getElementById("profileStatusBadge");
  const profileVehicleNote = document.getElementById("profileVehicleNote");

  if (!form || !brandSelect || !modelSelect || !yearSelect) return;

  let currentUser = null;

  function setStatus(message, type = "") {
    statusText.textContent = message || "";
    statusText.className = "profile-form__status";
    if (type) {
      statusText.classList.add(`is-${type}`);
    }
  }

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
    const brands = await window.AutoFixCatalogApi.fetchVehicleBrands();
    setSelectOptions(
      brandSelect,
      "Select brand",
      brands || [],
      (brand) => `<option value="${brand.key}">${brand.name}</option>`
    );
  }

  async function loadModels(brandKey, selectedModelKey = "") {
    resetModelAndYear();
    if (!brandKey) return;

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
    if (!modelKey) return;

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

  function renderProfileMeta(user) {
    const savedVehicle = user?.savedVehicle;
    if (profileRoleBadge) {
      profileRoleBadge.textContent = user?.role
        ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
        : "Account";
    }

    if (profileStatusBadge) {
      profileStatusBadge.textContent = user?.accountStatus
        ? user.accountStatus.replace("_", " ")
        : "Active";
    }

    if (profileVehicleNote) {
      profileVehicleNote.textContent = savedVehicle
        ? `Current car on your account: ${savedVehicle.label}. You can update it anytime below.`
        : "Add your car details below so AutoFix can personalize parts search around your account.";
    }
  }

  async function fillForm(user) {
    document.getElementById("profileUsername").value = user.username || "";
    document.getElementById("profileEmail").value = user.email || "";
    document.getElementById("profileFullName").value = user.fullName || "";
    document.getElementById("profilePhone").value = user.phone || "";
    document.getElementById("profileAddressLine").value = user.addressLine || "";
    document.getElementById("profileCity").value = user.city || "";

    const savedVehicle = user.savedVehicle;
    if (savedVehicle) {
      brandSelect.value = savedVehicle.brandKey;
      await loadModels(savedVehicle.brandKey, savedVehicle.modelKey);
      await loadYears(savedVehicle.modelKey, savedVehicle.vehicleYearId);
    } else {
      resetModelAndYear();
    }

    renderProfileMeta(user);
  }

  brandSelect.addEventListener("change", async function () {
    setStatus("");
    await loadModels(brandSelect.value);
  });

  modelSelect.addEventListener("change", async function () {
    setStatus("");
    await loadYears(modelSelect.value);
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    setStatus("");

    const payload = {
      username: document.getElementById("profileUsername").value.trim(),
      email: document.getElementById("profileEmail").value.trim(),
      fullName: document.getElementById("profileFullName").value.trim(),
      phone: document.getElementById("profilePhone").value.trim(),
      addressLine: document.getElementById("profileAddressLine").value.trim(),
      city: document.getElementById("profileCity").value.trim(),
      brandKey: brandSelect.value.trim(),
      modelKey: modelSelect.value.trim(),
      vehicleYearId: yearSelect.value.trim()
    };

    if (!payload.brandKey || !payload.modelKey || !payload.vehicleYearId) {
      setStatus("Please select your car brand, model, and year.", "error");
      return;
    }

    try {
      const data = await window.AutoFixAuth.apiFetch("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });

      currentUser = data.user;
      window.AutoFixAuth.saveSession(window.AutoFixAuth.getToken(), currentUser);
      await fillForm(currentUser);
      setStatus("Profile updated successfully.", "success");
    } catch (error) {
      setStatus(error.message || "Could not update profile.", "error");
    }
  });

  async function init() {
    const user = await window.AutoFixAuth.refreshSessionUser();
    if (!user) {
      window.location.href = "signin.html?redirect=profile.html";
      return;
    }

    currentUser = user;
    await loadBrands();
    await fillForm(user);
  }

  init().catch((error) => {
    setStatus(error.message || "Failed to load profile.", "error");
  });
});
