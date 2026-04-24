const API_BASE = process.env.API_BASE || "http://localhost:4000/api";

async function getJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    const message = payload?.error?.message || `Request failed for ${path}`;
    throw new Error(message);
  }

  return payload.data;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  console.log("Running Phase 4 smoke test against:", API_BASE);

  const health = await getJson("/health");
  assert(health?.database?.connected, "Database is not connected");

  const dealers = await getJson("/dealers");
  assert(Array.isArray(dealers) && dealers.length > 0, "No dealers were returned");

  const brands = await getJson("/vehicles/brands");
  assert(Array.isArray(brands) && brands.length > 0, "No brands were returned");

  const targetBrand = brands.find((brand) => brand.key === "mg") || brands[0];
  assert(targetBrand?.key, "Could not choose a target brand");

  const brandModelsResponse = await getJson(`/vehicles/brands/${encodeURIComponent(targetBrand.key)}/models`);
  assert(Array.isArray(brandModelsResponse?.models) && brandModelsResponse.models.length > 0, `No models were returned for brand ${targetBrand.key}`);

  const targetModel = brandModelsResponse.models.find((model) => model.key === "mg-zs") || brandModelsResponse.models[0];
  assert(targetModel?.key, "Could not choose a target model");
  assert(Array.isArray(targetModel.availableYears) && targetModel.availableYears.length > 0, "Target model has no available years");

  const yearsResponse = await getJson(`/vehicles/models/${encodeURIComponent(targetModel.key)}/years`);
  assert(Array.isArray(yearsResponse?.years) && yearsResponse.years.length > 0, `No years were returned for model ${targetModel.key}`);

  const targetYear = yearsResponse.years.find((year) => Number(year.value) === 2025) || yearsResponse.years[0];
  assert(targetYear?.value, "Could not choose a target year");

  const compatiblePartsResponse = await getJson(
    `/parts/compatible?brandKey=${encodeURIComponent(targetBrand.key)}&modelKey=${encodeURIComponent(targetModel.key)}&year=${encodeURIComponent(targetYear.value)}`
  );
  assert(Array.isArray(compatiblePartsResponse?.parts) && compatiblePartsResponse.parts.length > 0, "No compatible parts were returned");

  const targetPart = compatiblePartsResponse.parts.find((part) => part.groupKey === "car-battery") || compatiblePartsResponse.parts[0];
  assert(targetPart?.id, "Could not choose a compatible part");

  const partDetailsResponse = await getJson(
    `/parts/${encodeURIComponent(targetPart.slug || targetPart.id)}?brandKey=${encodeURIComponent(targetBrand.key)}&modelKey=${encodeURIComponent(targetModel.key)}&year=${encodeURIComponent(targetYear.value)}`
  );
  assert(partDetailsResponse?.part?.id, "Part details endpoint did not return a part");
  assert(Array.isArray(partDetailsResponse?.compatibility) && partDetailsResponse.compatibility.length > 0, "Part details returned no compatibility data");

  const searchResponse = await getJson(`/parts/search?query=${encodeURIComponent("battery")}&brandKey=${encodeURIComponent(targetBrand.key)}`);
  assert(Array.isArray(searchResponse?.results) && searchResponse.results.length > 0, "Search endpoint returned no results");

  const dealerByRef = await getJson(`/dealers/${encodeURIComponent(dealers[0].slug || dealers[0].id)}`);
  assert(Array.isArray(dealerByRef?.brands) && dealerByRef.brands.length > 0, "Dealer details returned no supported brands");

  console.log("Phase 4 smoke test passed.");
  console.log(
    JSON.stringify(
      {
        brand: targetBrand.name,
        model: targetModel.name,
        year: targetYear.value,
        part: targetPart.name,
        dealer: dealers[0].name,
        searchResults: searchResponse.results.length
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error("Phase 4 smoke test failed:", error.message);
  process.exit(1);
});
