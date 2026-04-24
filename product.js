function img(name, ext = "jpg") {
  return `./pictures/${name}.${ext}`;
}

function makeItem(title, name, price, type, rating, ext = "jpg") {
  return {
    name,
    image: img(name, ext),
    desc: `${name} for ${title.toLowerCase()} upgrades, maintenance, and a cleaner AutoFix buying flow.`,
    price,
    type,
    rating
  };
}

function buildGroup(title, variants) {
  return {
    title,
    items: variants.map(([name, price, type, rating, ext]) =>
      makeItem(title, name, price, type, rating, ext)
    )
  };
}

const productGroups = {
  seatcovers: buildGroup("Seat Covers", [["Seat Cover Premium", 300, "Aftermarket", 4.3], ["Leather Seat Cover", 450, "Original", 4.6], ["Sport Seat Cover", 380, "Aftermarket", 4.4], ["Classic Seat Cover", 280, "Aftermarket", 4.2]]),
  oilfilter: buildGroup("Oil Filter", [["Standard Oil Filter", 350, "Aftermarket", 4.3], ["Premium Oil Filter", 420, "Original", 4.6], ["Heavy Duty Oil Filter", 390, "Aftermarket", 4.4], ["Eco Oil Filter", 300, "Aftermarket", 4.2]]),
  brakepads: buildGroup("Brake Pads", [["Standard Brake Pads", 1200, "Original", 4.5], ["Ceramic Brake Pads", 1450, "Original", 4.7], ["Sport Brake Pads", 1350, "Aftermarket", 4.6], ["Economy Brake Pads", 980, "Aftermarket", 4.2]]),
  carbattery: buildGroup("Car Battery", [["Standard Car Battery", 2500, "Original", 4.7], ["Maintenance Free Battery", 2800, "Original", 4.8], ["High Power Battery", 3000, "Original", 4.9], ["Economy Car Battery", 2200, "Aftermarket", 4.3]]),
  wiperblades: buildGroup("Wiper Blades", [["Standard Wiper Blades", 200, "Aftermarket", 4.2], ["Silicone Wiper Blades", 280, "Original", 4.5], ["Heavy Duty Wiper Blades", 260, "Aftermarket", 4.4], ["Premium Wiper Blades", 320, "Original", 4.6]]),
  sparkplugs: buildGroup("Spark Plugs", [["Standard Spark Plug", 180, "Original", 4.4], ["Iridium Spark Plug", 260, "Original", 4.7], ["Platinum Spark Plug", 230, "Original", 4.6], ["Economy Spark Plug", 150, "Aftermarket", 4.1]]),
  alternator: buildGroup("Alternator", [["Standard Alternator", 3200, "Original", 4.6], ["High Output Alternator", 3800, "Original", 4.8], ["Premium Alternator", 3500, "Original", 4.7], ["Aftermarket Alternator", 2900, "Aftermarket", 4.3]]),
  shockabsorber: buildGroup("Shock Absorber", [["Standard Shock Absorber", 1500, "Aftermarket", 4.3], ["Gas Shock Absorber", 1750, "Original", 4.6], ["Heavy Duty Shock Absorber", 1900, "Aftermarket", 4.5], ["Sport Shock Absorber", 2100, "Original", 4.7]]),
  gaskets: buildGroup("Gaskets", [["Standard Gasket", 220, "Aftermarket", 4.1], ["Engine Head Gasket", 350, "Original", 4.5], ["Premium Gasket Set", 480, "Original", 4.6], ["Economy Gasket", 180, "Aftermarket", 4.0]]),
  waterpump: buildGroup("Water Pump", [["Standard Water Pump", 1100, "Original", 4.5], ["Premium Water Pump", 1350, "Original", 4.7], ["Heavy Duty Water Pump", 1450, "Aftermarket", 4.6], ["Economy Water Pump", 950, "Aftermarket", 4.2]]),
  tierodends: buildGroup("Tie Rod Ends", [["Standard Tie Rod End", 600, "Aftermarket", 4.2], ["Outer Tie Rod End", 720, "Original", 4.5], ["Heavy Duty Tie Rod End", 780, "Aftermarket", 4.4], ["Premium Tie Rod End", 850, "Original", 4.6]]),
  oxygensensor: buildGroup("Oxygen Sensor", [["Standard Oxygen Sensor", 900, "Original", 4.4], ["Premium Oxygen Sensor", 1050, "Original", 4.6], ["Universal Oxygen Sensor", 820, "Aftermarket", 4.2], ["High Performance Oxygen Sensor", 1150, "Original", 4.7]]),
  serpentinebelt: buildGroup("Serpentine Belt", [["Standard Serpentine Belt", 300, "Aftermarket", 4.3], ["Premium Serpentine Belt", 380, "Original", 4.6], ["Heavy Duty Belt", 360, "Aftermarket", 4.4], ["Eco Serpentine Belt", 270, "Aftermarket", 4.1]]),
  floormats: buildGroup("Floor Mats", [["Rubber Floor Mat", 300, "Aftermarket", 4.3], ["Luxury Floor Mat", 420, "Original", 4.5], ["All Weather Mat", 350, "Aftermarket", 4.4], ["Classic Floor Mat", 250, "Aftermarket", 4.1]]),
  phonemount: buildGroup("Phone Mount", [["Dashboard Phone Mount", 300, "Aftermarket", 4.3], ["Air Vent Phone Mount", 260, "Aftermarket", 4.2], ["Magnetic Phone Mount", 340, "Original", 4.5], ["Adjustable Phone Mount", 320, "Aftermarket", 4.4]]),
  steeringwheel: buildGroup("Steering Wheel", [["Classic Steering Wheel", 300, "Aftermarket", 4.3], ["Sport Steering Wheel", 500, "Original", 4.6], ["Leather Steering Wheel", 550, "Original", 4.7], ["Performance Steering Wheel", 480, "Aftermarket", 4.5]]),
  socketset: buildGroup("Socket Set", [["Standard Socket Set", 300, "Aftermarket", 4.3], ["Professional Socket Set", 450, "Original", 4.6], ["Heavy Duty Socket Set", 400, "Aftermarket", 4.4], ["Compact Socket Set", 270, "Aftermarket", 4.2]]),
  pliersset: buildGroup("Plier Set", [["Standard Plier Set", 300, "Aftermarket", 4.3], ["Professional Plier Set", 420, "Original", 4.6], ["Heavy Duty Plier Set", 380, "Aftermarket", 4.4], ["Mini Plier Set", 250, "Aftermarket", 4.1]]),
  floorjack: buildGroup("Floor Jack", [["Standard Floor Jack", 300, "Aftermarket", 4.3], ["Hydraulic Floor Jack", 520, "Original", 4.7], ["Heavy Duty Floor Jack", 600, "Aftermarket", 4.6], ["Compact Floor Jack", 350, "Aftermarket", 4.2]]),
  torquewrench: buildGroup("Torque Wrench", [["Standard Torque Wrench", 300, "Aftermarket", 4.3], ["Digital Torque Wrench", 550, "Original", 4.7], ["Professional Torque Wrench", 480, "Original", 4.6], ["Adjustable Torque Wrench", 390, "Aftermarket", 4.4]]),
  motoroil: buildGroup("Motor Oil", [["Standard Motor Oil", 300, "Aftermarket", 4.3], ["Synthetic Motor Oil", 420, "Original", 4.6], ["High Mileage Motor Oil", 380, "Aftermarket", 4.4], ["Premium Motor Oil", 450, "Original", 4.7]]),
  enginecoolant: buildGroup("Engine Coolant", [["Standard Engine Coolant", 300, "Aftermarket", 4.3], ["Long Life Coolant", 390, "Original", 4.5], ["Premium Engine Coolant", 430, "Original", 4.6], ["Heavy Duty Coolant", 360, "Aftermarket", 4.4]]),
  brakefluid: buildGroup("Brake Fluid", [["Standard Brake Fluid", 300, "Aftermarket", 4.3], ["DOT 4 Brake Fluid", 360, "Original", 4.5], ["Premium Brake Fluid", 410, "Original", 4.6], ["High Performance Brake Fluid", 450, "Original", 4.7]]),
  transmissionfluid: buildGroup("Transmission Fluid", [["Standard Transmission Fluid", 300, "Aftermarket", 4.3], ["Automatic Transmission Fluid", 390, "Original", 4.5], ["Premium Transmission Fluid", 440, "Original", 4.6], ["Synthetic Transmission Fluid", 470, "Original", 4.7]]),
  coldairintake: buildGroup("Cold Air Intake", [["Standard Cold Air Intake", 300, "Aftermarket", 4.3], ["Performance Cold Air Intake", 450, "Original", 4.6], ["Sport Cold Air Intake", 420, "Aftermarket", 4.5], ["Premium Cold Air Intake", 500, "Original", 4.7]]),
  coilover: buildGroup("CoilOver", [["Standard CoilOver", 300, "Aftermarket", 4.3], ["Sport CoilOver", 520, "Original", 4.7], ["Adjustable CoilOver", 480, "Aftermarket", 4.5], ["Premium CoilOver", 580, "Original", 4.8]]),
  bigbrakekit: buildGroup("Big Brake Kit", [["Standard Big Brake Kit", 300, "Aftermarket", 4.3], ["Performance Big Brake Kit", 650, "Original", 4.7], ["Sport Big Brake Kit", 620, "Aftermarket", 4.6], ["Premium Big Brake Kit", 720, "Original", 4.8]]),
  highperformancetires: buildGroup("High Performance Tires", [["Standard Performance Tire", 300, "Aftermarket", 4.3], ["Sport Performance Tire", 480, "Original", 4.6], ["Ultra Performance Tire", 550, "Original", 4.8], ["Premium Performance Tire", 520, "Original", 4.7]])
};

let currentGroup = null;
let currentProduct = null;
let fitmentMode = false;

const savedGroupKey = localStorage.getItem("selectedGroup");
const savedProductIndex = parseInt(localStorage.getItem("selectedProductIndex"), 10) || 0;
const selectedPartId = localStorage.getItem("selectedPartId") || "";
const selectedPartSlug = localStorage.getItem("selectedPartSlug") || "";

const selectedBrand = window.AutoFixCatalogApi?.normalizeBrandKey(localStorage.getItem("selectedBrand")) || "";
const selectedModel = (localStorage.getItem("selectedModel") || "").trim().toLowerCase();
const selectedModelName = localStorage.getItem("selectedModelName") || selectedModel;
const selectedYear = Number(localStorage.getItem("selectedYear") || 0);
const selectedCatalogScope = localStorage.getItem("selectedCatalogScope") || "marketplace";
const selectedDealerId = localStorage.getItem("selectedDealerId") || "";
const selectedDealerSlug = localStorage.getItem("selectedDealerSlug") || "";
const selectedDealerName = localStorage.getItem("selectedDealerName") || "";
const isDealerScoped = selectedCatalogScope === "dealer" && Boolean(selectedDealerId || selectedDealerSlug);

const brandLabel = window.getAutoFixBrandName ? window.getAutoFixBrandName(selectedBrand) : String(selectedBrand || "").toUpperCase();

const selectionSection = document.getElementById("productSelectionSection");
const groupTitle = document.getElementById("groupTitle");
const groupSubtitle = document.getElementById("groupSubtitle");
const groupCount = document.getElementById("groupCount");
const productsGrid = document.getElementById("productsGrid");
const productDetails = document.getElementById("productDetails");

const productBackLink = document.getElementById("productBackLink");
const productHeroEyebrow = document.getElementById("productHeroEyebrow");
const productHeroTitle = document.getElementById("productHeroTitle");
const productHeroSubtitle = document.getElementById("productHeroSubtitle");
const productVehicleChip = document.getElementById("productVehicleChip");
const productDealerChip = document.getElementById("productDealerChip");
const productContextLabel = document.getElementById("productContextLabel");
const productTypeBadge = document.getElementById("productTypeBadge");
const productContextChip = document.getElementById("productContextChip");
const productImg = document.getElementById("productImg");
const productName = document.getElementById("productName");
const productDesc = document.getElementById("productDesc");
const productType = document.getElementById("productType");
const productRating = document.getElementById("productRating");
const productVehicleContext = document.getElementById("productVehicleContext");
const productDealerContext = document.getElementById("productDealerContext");
const productPrice = document.getElementById("productPrice");
const productPriceNote = document.getElementById("productPriceNote");

function formatPrice(value) {
  return `${value} EGP`;
}

function getVehicleContextText() {
  if (selectedBrand && selectedModelName && selectedYear) {
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

function syncCartCount() {
  const total = window.AutoFixCommerce?.getCachedCartCount?.() || 0;
  const cartCount = document.getElementById("siteCartCount");

  if (cartCount) {
    cartCount.textContent = total;
  }
}

function setHeroContent(mode, product) {
  const vehicleText = getVehicleContextText();

  if (productVehicleChip) {
    productVehicleChip.textContent = vehicleText;
  }

  if (productDealerChip) {
    productDealerChip.textContent = isDealerScoped
      ? (selectedDealerName || product?.dealer?.name || "Dealer scope")
      : (product?.dealer?.name || "AutoFix catalog");
  }

  if (productBackLink) {
    productBackLink.href = mode === "fitment" ? "car-products.html" : "index.html";
    productBackLink.innerHTML = mode === "fitment"
      ? '<i class="fa-solid fa-arrow-left"></i> Back to compatible parts'
      : '<i class="fa-solid fa-arrow-left"></i> Back to home';
  }

  if (mode === "fitment" && product) {
    productHeroEyebrow.textContent = "Fitment-Ready Part";
    productHeroTitle.textContent = `${product.name} for ${vehicleText}`;
    productHeroSubtitle.textContent = isDealerScoped
      ? `This part is matched to your selected vehicle and filtered through ${selectedDealerName}.`
      : "This part is matched to your selected vehicle through the AutoFix compatibility flow.";
  } else if (currentGroup && product) {
    productHeroEyebrow.textContent = "Catalog Collection";
    productHeroTitle.textContent = `${currentGroup.title} details`;
    productHeroSubtitle.textContent = "Compare collection options, then review the selected product details below.";
  } else {
    productHeroEyebrow.textContent = "Product Details";
    productHeroTitle.textContent = "No product found";
    productHeroSubtitle.textContent = "Return to the previous page and choose a product first.";
  }
}

function renderEmptyState() {
  setHeroContent("empty");

  if (selectionSection) {
    selectionSection.style.display = "none";
  }

  if (productDetails) {
    productDetails.innerHTML = `
      <div class="catalog-empty">
        <h3>No product selected</h3>
        <p>Go back and choose a compatible part or a collection item first.</p>
      </div>
    `;
  }
}

function renderGroup(group, activeIndex) {
  groupTitle.textContent = group.title;
  groupSubtitle.textContent = "Choose a variant from this collection to refresh the details below.";
  groupCount.textContent = `${group.items.length} options`;

  productsGrid.innerHTML = group.items
    .map((item, index) => `
      <article class="product-option-card ${index === activeIndex ? "active" : ""}" data-product-index="${index}">
        <div class="product-option-card__media">
          <img src="${item.image}" alt="${item.name}" onerror="this.src='./pictures/autofix logo.png'">
        </div>

        <div class="product-option-card__body">
          <h3>${item.name}</h3>
          <p>${item.desc}</p>

          <div class="product-option-card__meta">
            <span class="product-chip">${item.type}</span>
            <span class="product-chip">Rating ${item.rating}</span>
          </div>

          <div class="product-option-card__footer">
            <strong class="product-option-card__price">${formatPrice(item.price)}</strong>
            <span class="product-option-card__arrow"><i class="fa-solid fa-arrow-right"></i></span>
          </div>
        </div>
      </article>
    `)
    .join("");

  productsGrid.querySelectorAll(".product-option-card").forEach((card) => {
    card.addEventListener("click", () => selectProduct(Number(card.dataset.productIndex)));
  });
}

function renderProductDetails(product, mode) {
  if (!product) {
    return;
  }

  productImg.src = product.image;
  productImg.onerror = function onImageError() {
    this.src = "./pictures/autofix logo.png";
  };

  productName.textContent = product.name;
  productDesc.textContent = product.desc;
  productType.textContent = product.type;
  productRating.textContent = `${Number(product.rating).toFixed(1)} / 5`;
  productVehicleContext.textContent = getVehicleContextText();
  productDealerContext.textContent = selectedDealerName || product.dealer?.name || "AutoFix catalog";
  productPrice.textContent = formatPrice(product.price);
  productPriceNote.textContent = mode === "fitment"
    ? "Matched to your vehicle and ready for the AutoFix checkout flow."
    : "Browse the collection, compare options, then continue through checkout.";

  productTypeBadge.textContent = product.type;
  productTypeBadge.className = `detail-chip ${product.type === "Original" ? "detail-chip--original" : "detail-chip--aftermarket"}`;
  productContextChip.textContent = mode === "fitment" ? "Vehicle compatible" : "Collection detail";
  productContextLabel.textContent = mode === "fitment" ? "Ready to order" : "Selected option";

  setHeroContent(mode, product);
}

function selectProduct(index) {
  if (!currentGroup) {
    return;
  }

  currentProduct = currentGroup.items[index];
  localStorage.setItem("selectedProductIndex", index);
  renderGroup(currentGroup, index);
  renderProductDetails(currentProduct, "collection");
}

async function addToCart() {
  if (!currentProduct) {
    window.AutoFixToast.error("No product found");
    return;
  }

  if (!currentProduct.id && !currentProduct.slug) {
    window.AutoFixToast.warning("This collection preview is not linked to the live catalog yet. Choose a fitment-ready part from a specific vehicle first.");
    return;
  }

  try {
    await window.AutoFixCommerce.addToCart({
      partId: currentProduct.id,
      partSlug: currentProduct.slug,
      quantity: 1,
      modelKey: fitmentMode ? selectedModel : "",
      year: fitmentMode ? selectedYear : "",
      name: currentProduct.name,
      image: currentProduct.image,
      price: currentProduct.price,
      type: currentProduct.type,
      rating: currentProduct.rating,
      dealerId: currentProduct.dealer?.id || null,
      dealerSlug: currentProduct.dealer?.slug || selectedDealerSlug || "",
      dealerName: currentProduct.dealer?.name || selectedDealerName || "",
      brandId: currentProduct.brand?.id || null,
      brandKey: currentProduct.brand?.key || selectedBrand || "",
      brandName: currentProduct.brand?.name || brandLabel || "",
      vehicleName: fitmentMode ? `${selectedModelName} ${selectedYear}` : ""
    });

    syncCartCount();
    window.AutoFixToast.success("Added to cart");
  } catch (error) {
    window.AutoFixToast.error(error.message || "Unable to add this part to cart right now.");
  }
}

function verify() {
  if (!currentProduct) {
    window.AutoFixToast.error("No product found");
    return;
  }

  const verifyData = {
    partId: currentProduct.id || null,
    partSlug: currentProduct.slug || "",
    name: currentProduct.name,
    image: currentProduct.image,
    type: currentProduct.type,
    price: currentProduct.price,
    rating: currentProduct.rating || 0,
    partNumber: currentProduct.partNumber || "",
    serialNumber: currentProduct.serialNumber || "",
    dealerId: currentProduct.dealer?.id || Number(selectedDealerId || 0) || null,
    dealerSlug: currentProduct.dealer?.slug || selectedDealerSlug || "",
    dealerName: currentProduct.dealer?.name || selectedDealerName || "",
    brandKey: currentProduct.brand?.key || selectedBrand || "",
    modelKey: selectedModel || "",
    modelName: selectedModelName || "",
    year: selectedYear || null
  };

  localStorage.setItem("verifyProduct", JSON.stringify(verifyData));

  const params = new URLSearchParams();
  if (verifyData.partId) params.set("partId", verifyData.partId);
  if (verifyData.partSlug) params.set("partSlug", verifyData.partSlug);
  if (verifyData.serialNumber) params.set("serial", verifyData.serialNumber);
  if (verifyData.dealerId) params.set("dealerId", verifyData.dealerId);
  if (verifyData.dealerSlug) params.set("dealerSlug", verifyData.dealerSlug);
  if (verifyData.brandKey) params.set("brandKey", verifyData.brandKey);
  if (verifyData.modelKey) params.set("modelKey", verifyData.modelKey);
  if (verifyData.modelName) params.set("modelName", verifyData.modelName);
  if (verifyData.year) params.set("year", verifyData.year);

  window.location.href = `verify.html${params.toString() ? `?${params.toString()}` : ""}`;
}

async function loadFitmentProduct() {
  const partRef = selectedPartSlug || selectedPartId;
  if (!partRef) {
    return false;
  }

  try {
    const data = await window.AutoFixCatalogApi.fetchPartDetails(partRef, {
      brandKey: selectedBrand,
      modelKey: selectedModel,
      year: selectedYear,
      ...getDealerQuery()
    });

    fitmentMode = true;
    currentProduct = data.part;

    if (selectionSection) {
      selectionSection.style.display = "none";
    }

    renderProductDetails(currentProduct, "fitment");
    return true;
  } catch (error) {
    renderEmptyState();
    return false;
  }
}

async function init() {
  const fitmentLoaded = await loadFitmentProduct();

  if (fitmentLoaded) {
    syncCartCount();
    return;
  }

  if (savedGroupKey && productGroups[savedGroupKey]) {
    currentGroup = productGroups[savedGroupKey];
    currentProduct = currentGroup.items[savedProductIndex] || currentGroup.items[0];

    if (selectionSection) {
      selectionSection.style.display = "block";
    }

    renderGroup(currentGroup, savedProductIndex);
    renderProductDetails(currentProduct, "collection");
    syncCartCount();
    return;
  }

  const legacyProduct = JSON.parse(localStorage.getItem("product") || "null");
  if (legacyProduct) {
    currentProduct = legacyProduct;
    fitmentMode = false;

    if (selectionSection) {
      selectionSection.style.display = "none";
    }

    renderProductDetails(currentProduct, "collection");
    syncCartCount();
    return;
  }

  renderEmptyState();
  syncCartCount();
}

window.selectProduct = selectProduct;
window.addToCart = addToCart;
window.verify = verify;

init();
