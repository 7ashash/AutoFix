export const brandAliasMap = {
  chevorlet: "chevrolet"
};

export function normalizeBrandKey(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return brandAliasMap[normalized] || normalized;
}

export const brandPresentation = {
  bmw: {
    logo: "./pictures/brand-logos/bmw.png"
  },
  audi: {
    logo: "./pictures/brand-logos/audi.png"
  },
  toyota: {
    logo: "./pictures/brand-logos/toyota.png"
  },
  hyundai: {
    logo: "./pictures/brand-logos/hyundai.png"
  },
  mg: {
    logo: "./pictures/brand-logos/mg.png"
  },
  nissan: {
    logo: "./pictures/brand-logos/nissan.png"
  },
  mercedes: {
    logo: "./pictures/brand-logos/mercedes.png"
  },
  peugeot: {
    logo: "./pictures/brand-logos/peugeot.png"
  },
  kia: {
    logo: "./pictures/brand-logos/kia.png"
  },
  chevrolet: {
    logo: "./pictures/brand-logos/chevrolet.png"
  }
};

export const dealerPresentationBySlug = {
  "al-mansour-automotive": {
    image: "./pictures/dealer4.jpg"
  },
  "toyota-egypt": {
    image: "./pictures/dealer3.jpg"
  },
  "bavarian-auto-group": {
    image: "./pictures/dealer1.jpg"
  },
  "nissan-egypt": {
    image: "./pictures/dealer5.jpg"
  },
  "gb-auto-hyundai": {
    image: "./pictures/dealer2.jpg"
  }
};

export const supportedDealerBrands = {
  "al-mansour-automotive": ["mg", "peugeot", "chevrolet"],
  "toyota-egypt": ["toyota"],
  "bavarian-auto-group": ["bmw", "mercedes", "audi"],
  "nissan-egypt": ["nissan"],
  "gb-auto-hyundai": ["hyundai", "kia"]
};

export const brandDealerMap = Object.entries(supportedDealerBrands).reduce((result, [dealerSlug, brandKeys]) => {
  brandKeys.forEach((brandKey) => {
    result[brandKey] = dealerSlug;
  });
  return result;
}, {});

export const modelPresentation = {
  bmw: [
    { modelKey: "bmw-116i-e81", name: "116i - E81", image: "./pictures/116i-E81.jpeg", profileLabel: "Performance", profileDescription: "Driver-focused hatchback fitment with premium maintenance coverage." },
    { modelKey: "bmw-116i-e87", name: "116i - E87", image: "./pictures/116i-E87.jpeg", profileLabel: "Performance", profileDescription: "Balanced BMW compact fitment path with workshop-ready spare parts." },
    { modelKey: "bmw-118i-f20", name: "118i - F20", image: "./pictures/116i-F20.jpeg", profileLabel: "Performance", profileDescription: "Modern hatchback setup with electronics and maintenance-friendly compatibility." },
    { modelKey: "bmw-335i-f30", name: "335i - F30", image: "./pictures/335i-F30.jpeg", profileLabel: "Performance", profileDescription: "Higher-output BMW fitment with braking, ignition, and cooling coverage." },
    { modelKey: "bmw-316i-f30", name: "316i - F30", image: "./pictures/316i-F30.jpeg", profileLabel: "Premium Sedan", profileDescription: "Executive sedan fitment with refined daily-maintenance parts coverage." }
  ],
  audi: [
    { modelKey: "audi-a3", name: "A3", image: "./pictures/a3.jpeg", profileLabel: "Premium Sedan", profileDescription: "Compact Audi fitment with premium service and maintenance coverage." },
    { modelKey: "audi-a4", name: "A4", image: "./pictures/a4.jpeg", profileLabel: "Premium Sedan", profileDescription: "Daily executive sedan fitment with workshop-ready compatible parts." },
    { modelKey: "audi-a6", name: "A6", image: "./pictures/a6.jpeg", profileLabel: "Premium Sedan", profileDescription: "Long-wheelbase comfort fitment with electrical and engine parts coverage." },
    { modelKey: "audi-q3", name: "Q3", image: "./pictures/q3.jpeg", profileLabel: "SUV / Crossover", profileDescription: "Urban crossover fitment with suspension and cooling support." },
    { modelKey: "audi-q5", name: "Q5", image: "./pictures/q5.jpeg", profileLabel: "SUV / Crossover", profileDescription: "Mid-size SUV fitment with premium maintenance and consumables coverage." }
  ],
  toyota: [
    { modelKey: "toyota-corolla", name: "Corolla", image: "./pictures/corolla.jpeg", profileLabel: "Daily Sedan", profileDescription: "High-volume fitment path for one of the most common cars in Egypt." },
    { modelKey: "toyota-camry", name: "Camry", image: "./pictures/camry.jpeg", profileLabel: "Premium Sedan", profileDescription: "Comfort-oriented sedan fitment with dependable long-distance maintenance coverage." },
    { modelKey: "toyota-yaris", name: "Yaris", image: "./pictures/yaris.jpeg", profileLabel: "Daily Sedan", profileDescription: "Compact city-car fitment with efficient routine-maintenance parts." },
    { modelKey: "toyota-fortuner", name: "Fortuner", image: "./pictures/fortuner.jpeg", profileLabel: "SUV / Crossover", profileDescription: "Family SUV fitment with suspension, cooling, and electrical support." },
    { modelKey: "toyota-hilux", name: "Hilux", image: "./pictures/hilux.jpeg", profileLabel: "Pickup / Utility", profileDescription: "Utility-focused pickup fitment with rugged maintenance coverage." }
  ],
  hyundai: [
    { modelKey: "hyundai-elantra", name: "Elantra", image: "./pictures/elentra.jpeg", profileLabel: "Daily Sedan", profileDescription: "Popular sedan fitment with strong coverage for daily-use maintenance." },
    { modelKey: "hyundai-tucson", name: "Tucson", image: "./pictures/tucson.jpeg", profileLabel: "SUV / Crossover", profileDescription: "Crossover fitment with ready-to-order cooling, suspension, and brake parts." },
    { modelKey: "hyundai-accent", name: "Accent", image: "./pictures/accent.jpeg", profileLabel: "Daily Sedan", profileDescription: "Economy sedan fitment with high-rotation maintenance parts." }
  ],
  mg: [
    { modelKey: "mg-5", name: "MG 5", image: "./pictures/mg5.jpeg", profileLabel: "Daily Sedan", profileDescription: "Modern MG sedan fitment with original and aftermarket consumables." },
    { modelKey: "mg-zs", name: "MG ZS", image: "./pictures/mg zs.jpeg", profileLabel: "SUV / Crossover", profileDescription: "Crossover fitment path already used across the AutoFix prototype." },
    { modelKey: "mg-g50-plus", name: "MG G50 Plus", image: "./pictures/mg g50.jpeg", profileLabel: "SUV / Crossover", profileDescription: "MPV/SUV-oriented fitment with practical maintenance coverage." },
    { modelKey: "mg-1", name: "MG 1", image: "./pictures/mg1.jpeg", profileLabel: "SUV / Crossover", profileDescription: "New-generation MG crossover fitment with strong routine service coverage." },
    { modelKey: "mg-cyberster", name: "MG Cyberster", image: "./pictures/mg cybester.jpeg", profileLabel: "Performance", profileDescription: "Performance-oriented fitment with sharper braking and electrical support." }
  ],
  nissan: [
    { modelKey: "nissan-sunny-n16", name: "Sunny N16", image: "./pictures/sunny n16.jpeg", profileLabel: "Daily Sedan", profileDescription: "Legacy sedan fitment with maintenance-first parts coverage." },
    { modelKey: "nissan-sunny-n17", name: "Sunny N17", image: "./pictures/sunny n17.jpeg", profileLabel: "Daily Sedan", profileDescription: "Common market sedan fitment with high stock rotation." },
    { modelKey: "nissan-qashqai", name: "Qashqai", image: "./pictures/qashqai.jpeg", profileLabel: "SUV / Crossover", profileDescription: "High-demand crossover fitment with original wipers, filters, and brakes." },
    { modelKey: "nissan-sentra", name: "Sentra", image: "./pictures/sentra.jpeg", profileLabel: "Daily Sedan", profileDescription: "Family sedan fitment with balanced maintenance and repair parts." },
    { modelKey: "nissan-x-trail", name: "X Trail", image: "./pictures/x trail.jpeg", profileLabel: "SUV / Crossover", profileDescription: "Larger SUV fitment path with cooling and suspension support." }
  ],
  mercedes: [
    { modelKey: "mercedes-cla-180", name: "CLA 180", image: "./pictures/cla180.jpeg", profileLabel: "Premium Sedan", profileDescription: "Compact Mercedes coupe-sedan fitment with premium replacement parts." },
    { modelKey: "mercedes-e280", name: "E280", image: "./pictures/e280.jpeg", profileLabel: "Premium Sedan", profileDescription: "Classic executive Mercedes fitment with engine and electrical support." },
    { modelKey: "mercedes-cla200", name: "CLA200", image: "./pictures/cla200.jpeg", profileLabel: "Premium Sedan", profileDescription: "Popular Mercedes fitment path already used in the project flow." },
    { modelKey: "mercedes-e200", name: "E200", image: "./pictures/e200.jpeg", profileLabel: "Premium Sedan", profileDescription: "Long-distance executive fitment with comfort and maintenance coverage." },
    { modelKey: "mercedes-e180", name: "E180", image: "./pictures/e180.jpeg", profileLabel: "Premium Sedan", profileDescription: "Efficient executive fitment with reliable routine maintenance parts." }
  ],
  peugeot: [
    { modelKey: "peugeot-508", name: "508", image: "./pictures/508.jpeg", profileLabel: "Premium Sedan", profileDescription: "French premium sedan fitment with refined braking and service support." },
    { modelKey: "peugeot-3008", name: "3008", image: "./pictures/3008.jpeg", profileLabel: "SUV / Crossover", profileDescription: "Popular Peugeot SUV fitment with strong maintenance coverage." },
    { modelKey: "peugeot-2008", name: "2008", image: "./pictures/2008.jpeg", profileLabel: "SUV / Crossover", profileDescription: "Compact crossover fitment with daily-use consumables and repairs." },
    { modelKey: "peugeot-308", name: "308", image: "./pictures/308.jpeg", profileLabel: "Daily Sedan", profileDescription: "Hatch/sedan fitment with original and aftermarket workshop options." },
    { modelKey: "peugeot-408", name: "408", image: "./pictures/408.jpeg", profileLabel: "Premium Sedan", profileDescription: "Modern sedan fitment with cleaner dealer-routed compatibility." }
  ],
  kia: [
    { modelKey: "kia-rio", name: "Rio", image: "./pictures/rio.jpeg", profileLabel: "Daily Sedan", profileDescription: "Compact Kia fitment with high-rotation routine maintenance coverage." },
    { modelKey: "kia-cerato", name: "Cerato", image: "./pictures/cerato.jpeg", profileLabel: "Daily Sedan", profileDescription: "Popular compact sedan fitment with widespread replacement part demand." },
    { modelKey: "kia-carens", name: "Carens", image: "./pictures/carens.jpeg", profileLabel: "SUV / Crossover", profileDescription: "Family-oriented fitment with cooling and suspension support." },
    { modelKey: "kia-seltos", name: "Seltos", image: "./pictures/seltos.jpeg", profileLabel: "SUV / Crossover", profileDescription: "New-generation crossover fitment with strong brake and filter coverage." },
    { modelKey: "kia-carnival", name: "Carnival", image: "./pictures/carnival.jpeg", profileLabel: "SUV / Crossover", profileDescription: "Large family vehicle fitment with practical maintenance coverage." }
  ],
  chevrolet: [
    { modelKey: "chevrolet-optra", name: "Optra", image: "./pictures/optera.jpeg", profileLabel: "Daily Sedan", profileDescription: "Widely known sedan fitment with steady maintenance demand." },
    { modelKey: "chevrolet-captiva", name: "Captiva", image: "./pictures/captiva.jpeg", profileLabel: "SUV / Crossover", profileDescription: "SUV fitment with dealer-ready service and spare parts coverage." },
    { modelKey: "chevrolet-tahoe", name: "Tahoe", image: "./pictures/tahoe.jpeg", profileLabel: "SUV / Crossover", profileDescription: "Large SUV fitment with cooling, electrical, and suspension support." },
    { modelKey: "chevrolet-colorado", name: "Colorado", image: "./pictures/colorado.jpeg", profileLabel: "Pickup / Utility", profileDescription: "Utility truck fitment with work-ready maintenance coverage." },
    { modelKey: "chevrolet-silverado", name: "Silverado", image: "./pictures/silverado.jpeg", profileLabel: "Pickup / Utility", profileDescription: "Heavy-duty pickup fitment with rugged replacement part coverage." }
  ]
};

export const catalogModels = Object.entries(modelPresentation).flatMap(([brandKey, models]) =>
  models.map((model) => ({
    brandKey,
    ...model
  }))
);

export const partTemplates = [
  { key: "oil-filter", groupKey: "oilfilter", name: "Oil Filter", categoryKey: "filters", imageUrl: "./pictures/oil filter.jpg", partType: "aftermarket", basePrice: 350, baseRating: 4.3 },
  { key: "brake-pads", groupKey: "brakepads", name: "Brake Pads", categoryKey: "brakes", imageUrl: "./pictures/brake pads.webp", partType: "original", basePrice: 1200, baseRating: 4.5 },
  { key: "car-battery", groupKey: "carbattery", name: "Car Battery", categoryKey: "battery", imageUrl: "./pictures/automotive_battery_PNG12097.png", partType: "original", basePrice: 2500, baseRating: 4.7 },
  { key: "wiper-blades", groupKey: "wiperblades", name: "Wiper Blades", categoryKey: "wipers", imageUrl: "./pictures/blades.webp", partType: "aftermarket", basePrice: 220, baseRating: 4.2 },
  { key: "spark-plugs", groupKey: "sparkplugs", name: "Spark Plugs", categoryKey: "ignition", imageUrl: "./pictures/spark-plug_1.jpg", partType: "original", basePrice: 180, baseRating: 4.4 },
  { key: "alternator", groupKey: "alternator", name: "Alternator", categoryKey: "electrical", imageUrl: "./pictures/german-alternator-17197808.webp", partType: "original", basePrice: 3200, baseRating: 4.6 },
  { key: "shock-absorber", groupKey: "shockabsorber", name: "Shock Absorber", categoryKey: "suspension", imageUrl: "./pictures/car-shock-absorber-2JW0rlC-600.jpg", partType: "aftermarket", basePrice: 1500, baseRating: 4.3 },
  { key: "gaskets", groupKey: "gaskets", name: "Gaskets", categoryKey: "engine", imageUrl: "./pictures/Screenshot 2026-03-10 211535.png", partType: "aftermarket", basePrice: 220, baseRating: 4.1 },
  { key: "water-pump", groupKey: "waterpump", name: "Water Pump", categoryKey: "engine", imageUrl: "./pictures/water.jpg", partType: "original", basePrice: 1100, baseRating: 4.5 },
  { key: "tie-rod-ends", groupKey: "tierodends", name: "Tie Rod Ends", categoryKey: "steering", imageUrl: "./pictures/tie rod.png", partType: "aftermarket", basePrice: 600, baseRating: 4.2 },
  { key: "oxygen-sensor", groupKey: "oxygensensor", name: "Oxygen Sensor", categoryKey: "electrical", imageUrl: "./pictures/02.jpg", partType: "original", basePrice: 900, baseRating: 4.4 },
  { key: "serpentine-belt", groupKey: "serpentinebelt", name: "Serpentine Belt", categoryKey: "belts", imageUrl: "./pictures/belt.jpg", partType: "aftermarket", basePrice: 300, baseRating: 4.3 },
  { key: "cold-air-intake", groupKey: "coldairintake", name: "Cold Air Intake", categoryKey: "performance", imageUrl: "./pictures/cold air.jpg", partType: "aftermarket", basePrice: 900, baseRating: 4.4 },
  { key: "coilover-kit", groupKey: "coilover", name: "CoilOver Kit", categoryKey: "performance", imageUrl: "./pictures/coil.jpg", partType: "aftermarket", basePrice: 2600, baseRating: 4.5 },
  { key: "big-brake-kit", groupKey: "bigbrakekit", name: "Big Brake Kit", categoryKey: "performance", imageUrl: "./pictures/big brake.jpg", partType: "original", basePrice: 4200, baseRating: 4.7 },
  { key: "high-performance-tires", groupKey: "highperformancetires", name: "High Performance Tires", categoryKey: "performance", imageUrl: "./pictures/ultra-high-performance-tires-5.jpg", partType: "original", basePrice: 3800, baseRating: 4.6 }
];

const partGroupKeyByName = Object.fromEntries(
  partTemplates.map((template) => [template.name.trim().toLowerCase(), template.groupKey])
);

export const partCategories = [
  { key: "battery", name: "Battery" },
  { key: "brakes", name: "Brake Components" },
  { key: "filters", name: "Filters" },
  { key: "wipers", name: "Wiper Blades" },
  { key: "engine", name: "Engine Parts" },
  { key: "ignition", name: "Ignition" },
  { key: "electrical", name: "Electrical" },
  { key: "suspension", name: "Suspension" },
  { key: "steering", name: "Steering" },
  { key: "belts", name: "Belts" },
  { key: "performance", name: "Performance Upgrades" }
];

export function getBrandPresentation(brandKey) {
  return brandPresentation[normalizeBrandKey(brandKey)] || { logo: "./pictures/autofix logo.png" };
}

export function getDealerPresentation(dealerSlug) {
  return dealerPresentationBySlug[dealerSlug] || { image: "./pictures/dealer1.jpg" };
}

export function getModelPresentation(modelKey) {
  return catalogModels.find((model) => model.modelKey === modelKey) || null;
}

export function getPartGroupKeyByName(name) {
  return partGroupKeyByName[String(name || "").trim().toLowerCase()] || null;
}
