(function () {
  const brandCatalog = {
bmw: { key: "bmw", name: "BMW", image: "./pictures/brand-logos/bmw.png" },
audi: { key: "audi", name: "Audi", image: "./pictures/brand-logos/audi.png" },
toyota: { key: "toyota", name: "Toyota", image: "./pictures/brand-logos/toyota.png" },
hyundai: { key: "hyundai", name: "Hyundai", image: "./pictures/brand-logos/hyundai.png" },
mg: { key: "mg", name: "MG", image: "./pictures/brand-logos/mg.png" },
nissan: { key: "nissan", name: "Nissan", image: "./pictures/brand-logos/nissan.png" },
mercedes: { key: "mercedes", name: "Mercedes", image: "./pictures/brand-logos/mercedes.png" },
peugeot: { key: "peugeot", name: "Peugeot", image: "./pictures/brand-logos/peugeot.png" },
kia: { key: "kia", name: "Kia", image: "./pictures/brand-logos/kia.png" },
chevorlet: { key: "chevorlet", name: "Chevrolet", image: "./pictures/brand-logos/chevrolet.png" }
  ,
chevrolet: { key: "chevrolet", name: "Chevrolet", image: "./pictures/brand-logos/chevrolet.png" }
  };

  const dealerCatalog = {
    abou: {
      key: "abou",
      name: "Abou Ghaly Motors",
      image: "./pictures/dealer1.jpg",
      location: "Cairo, Egypt",
      rating: 4.8,
      brands: ["bmw"],
      description: "BMW models currently supported through the AutoFix marketplace."
    },
    ezz: {
      key: "ezz",
      name: "Ezz Elarab Automotive",
      image: "./pictures/dealer2.jpg",
      location: "Giza, Egypt",
      rating: 4.7,
      brands: ["audi", "mercedes"],
      description: "Premium European vehicles available now on AutoFix."
    },
    toyota: {
      key: "toyota",
      name: "Toyota Egypt",
      image: "./pictures/dealer3.jpg",
      location: "Cairo, Egypt",
      rating: 4.9,
      brands: ["toyota"],
      description: "Toyota passenger cars and SUVs with fitment-first parts browsing."
    },
    mansour: {
      key: "mansour",
      name: "Al-Mansour Automotive",
      image: "./pictures/dealer4.jpg",
      location: "Alexandria, Egypt",
      rating: 4.6,
      brands: ["chevrolet", "mg"],
      description: "Chevrolet and MG vehicle coverage available inside the platform."
    },
    ramsis: {
      key: "ramsis",
      name: "Ramsis Group",
      image: "./pictures/dealer5.jpg",
      location: "Cairo, Egypt",
      rating: 4.5,
      brands: ["nissan", "hyundai", "kia", "peugeot"],
      description: "Multi-brand local inventory for popular vehicles in Egypt."
    }
  };

  const vehicleRequiredGroups = [
    "oilfilter",
    "brakepads",
    "carbattery",
    "wiperblades",
    "sparkplugs",
    "alternator",
    "shockabsorber",
    "gaskets",
    "waterpump",
    "tierodends",
    "oxygensensor",
    "serpentinebelt",
    "coldairintake",
    "coilover",
    "bigbrakekit",
    "highperformancetires"
  ];

  const partCatalog = {
    oilfilter: {
      key: "oilfilter",
      name: "Oil Filters",
      image: "./pictures/oil filter.jpg",
      category: "Replacement Parts",
      description: "Engine filtration parts for routine maintenance and cleaner vehicle performance.",
      priceFrom: 350,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: true,
      keywords: ["filter", "engine", "maintenance"]
    },
    brakepads: {
      key: "brakepads",
      name: "Brake Pads",
      image: "./pictures/brake pads.webp",
      category: "Replacement Parts",
      description: "Front and rear braking components with original and aftermarket options.",
      priceFrom: 1200,
      type: "Original",
      rating: 4.5,
      vehicleRequired: true,
      keywords: ["brakes", "stopping", "safety"]
    },
    carbattery: {
      key: "carbattery",
      name: "Car Battery",
      image: "./pictures/automotive_battery_PNG12097.png",
      category: "Replacement Parts",
      description: "Battery solutions for starting reliability, charging support, and roadside recovery.",
      priceFrom: 2500,
      type: "Original",
      rating: 4.7,
      vehicleRequired: true,
      keywords: ["battery", "charging", "starter"]
    },
    wiperblades: {
      key: "wiperblades",
      name: "Wiper Blades",
      image: "./pictures/blades.webp",
      category: "Replacement Parts",
      description: "Clear-vision blade sets for seasonal maintenance and safer daily driving.",
      priceFrom: 200,
      type: "Aftermarket",
      rating: 4.2,
      vehicleRequired: true,
      keywords: ["wipers", "rain", "blades"]
    },
    sparkplugs: {
      key: "sparkplugs",
      name: "Spark Plug",
      image: "./pictures/spark-plug_1.jpg",
      category: "Replacement Parts",
      description: "Ignition components that improve engine response, starts, and combustion efficiency.",
      priceFrom: 180,
      type: "Original",
      rating: 4.4,
      vehicleRequired: true,
      keywords: ["ignition", "engine", "combustion"]
    },
    alternator: {
      key: "alternator",
      name: "Alternator",
      image: "./pictures/german-alternator-17197808.webp",
      category: "Replacement Parts",
      description: "Charging-system replacements for battery support and electrical stability.",
      priceFrom: 3200,
      type: "Original",
      rating: 4.6,
      vehicleRequired: true,
      keywords: ["charging", "electrical", "battery"]
    },
    shockabsorber: {
      key: "shockabsorber",
      name: "Shock Absorber",
      image: "./pictures/car-shock-absorber-2JW0rlC-600.jpg",
      category: "Replacement Parts",
      description: "Suspension parts that improve ride comfort, handling, and road stability.",
      priceFrom: 1500,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: true,
      keywords: ["suspension", "ride", "handling"]
    },
    gaskets: {
      key: "gaskets",
      name: "Gaskets",
      image: "./pictures/Screenshot 2026-03-10 211535.png",
      category: "Replacement Parts",
      description: "Sealing components for engine repairs, leak prevention, and workshop maintenance.",
      priceFrom: 220,
      type: "Aftermarket",
      rating: 4.1,
      vehicleRequired: true,
      keywords: ["seal", "engine", "leak"]
    },
    waterpump: {
      key: "waterpump",
      name: "Water Pump",
      image: "./pictures/water.jpg",
      category: "Replacement Parts",
      description: "Cooling-system parts that support coolant circulation and overheating protection.",
      priceFrom: 1100,
      type: "Original",
      rating: 4.5,
      vehicleRequired: true,
      keywords: ["cooling", "overheating", "coolant"]
    },
    tierodends: {
      key: "tierodends",
      name: "Tie Rod Ends",
      image: "./pictures/tie rod.png",
      category: "Replacement Parts",
      description: "Steering linkage parts for accurate control and front-end stability.",
      priceFrom: 600,
      type: "Aftermarket",
      rating: 4.2,
      vehicleRequired: true,
      keywords: ["steering", "alignment", "front suspension"]
    },
    oxygensensor: {
      key: "oxygensensor",
      name: "Oxygen Sensor",
      image: "./pictures/02.jpg",
      category: "Replacement Parts",
      description: "Sensor replacements that support emissions efficiency and engine management.",
      priceFrom: 900,
      type: "Original",
      rating: 4.4,
      vehicleRequired: true,
      keywords: ["sensor", "engine light", "emissions"]
    },
    serpentinebelt: {
      key: "serpentinebelt",
      name: "Serpentine Belt",
      image: "./pictures/belt.jpg",
      category: "Replacement Parts",
      description: "Drive belts for alternator, cooling, and accessory system performance.",
      priceFrom: 300,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: true,
      keywords: ["belt", "drive", "engine"]
    },
    floormats: {
      key: "floormats",
      name: "Floor Mat",
      image: "./pictures/floor mats.webp",
      category: "Accessories",
      description: "Interior protection accessories with everyday comfort and easy-clean coverage.",
      priceFrom: 300,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: false,
      keywords: ["interior", "comfort", "mat"]
    },
    seatcovers: {
      key: "seatcovers",
      name: "Seat Covers",
      image: "./pictures/seat cover2.jpg",
      category: "Accessories",
      description: "Cabin upgrades that protect seats and improve the overall interior feel.",
      priceFrom: 300,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: false,
      keywords: ["interior", "comfort", "protection"]
    },
    phonemount: {
      key: "phonemount",
      name: "Phone Mount",
      image: "./pictures/phone2.jpg",
      category: "Accessories",
      description: "Hands-free phone holders for navigation, calls, and safer daily driving.",
      priceFrom: 300,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: false,
      keywords: ["phone", "navigation", "holder"]
    },
    steeringwheel: {
      key: "steeringwheel",
      name: "Stearing Wheel",
      image: "./pictures/steering wheel2.jpg",
      category: "Accessories",
      description: "Steering upgrades for grip, style, and a sportier in-cabin experience.",
      priceFrom: 300,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: false,
      keywords: ["steering", "interior", "style"]
    },
    socketset: {
      key: "socketset",
      name: "Socket Set",
      image: "./pictures/socket set.png",
      category: "Tools",
      description: "Workshop tools for maintenance, repairs, and quick garage tasks.",
      priceFrom: 300,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: false,
      keywords: ["tools", "garage", "repair"]
    },
    pliersset: {
      key: "pliersset",
      name: "Plier Set",
      image: "./pictures/pliers set.jpg",
      category: "Tools",
      description: "Garage-ready plier kits for electrical work, fastening, and repairs.",
      priceFrom: 300,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: false,
      keywords: ["pliers", "tools", "repair"]
    },
    floorjack: {
      key: "floorjack",
      name: "Floor Jack",
      image: "./pictures/floor jack.jpg",
      category: "Tools",
      description: "Lifting equipment for tire work, brake service, and workshop safety.",
      priceFrom: 300,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: false,
      keywords: ["jack", "lifting", "garage"]
    },
    torquewrench: {
      key: "torquewrench",
      name: "Torque Wrench",
      image: "./pictures/torque wrench.jpg",
      category: "Tools",
      description: "Precision tightening tools for wheel work, engine service, and safer repairs.",
      priceFrom: 300,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: false,
      keywords: ["torque", "tools", "precision"]
    },
    motoroil: {
      key: "motoroil",
      name: "Motor Oil",
      image: "./pictures/motor oil.jpg",
      category: "Fluids",
      description: "Engine oils for protection, cooling support, and routine maintenance intervals.",
      priceFrom: 300,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: false,
      keywords: ["oil", "engine", "lubrication"]
    },
    enginecoolant: {
      key: "enginecoolant",
      name: "Engine Coolant",
      image: "./pictures/engine coolant.jpg",
      category: "Fluids",
      description: "Cooling fluids that support temperature control and engine protection.",
      priceFrom: 300,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: false,
      keywords: ["coolant", "cooling", "radiator"]
    },
    brakefluid: {
      key: "brakefluid",
      name: "Brake Fluid",
      image: "./pictures/brake fluid.jpg",
      category: "Fluids",
      description: "Brake system fluids for pressure consistency and dependable stopping performance.",
      priceFrom: 300,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: false,
      keywords: ["brake", "fluid", "maintenance"]
    },
    transmissionfluid: {
      key: "transmissionfluid",
      name: "Transmission Fluid",
      image: "./pictures/tranmission.png",
      category: "Fluids",
      description: "Transmission lubricants for smoother shifting and drivetrain protection.",
      priceFrom: 300,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: false,
      keywords: ["transmission", "gearbox", "fluid"]
    },
    coldairintake: {
      key: "coldairintake",
      name: "Cold Air Intake",
      image: "./pictures/cold air.jpg",
      category: "Performance",
      description: "Performance airflow upgrades for sharper throttle response and engine sound.",
      priceFrom: 300,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: true,
      keywords: ["performance", "airflow", "engine"]
    },
    coilover: {
      key: "coilover",
      name: "CoilOver",
      image: "./pictures/coil.jpg",
      category: "Performance",
      description: "Suspension performance kits for handling response and adjustable ride feel.",
      priceFrom: 300,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: true,
      keywords: ["performance", "suspension", "handling"]
    },
    bigbrakekit: {
      key: "bigbrakekit",
      name: "Big Brake Kit",
      image: "./pictures/big brake.jpg",
      category: "Performance",
      description: "Brake upgrade kits for stronger stopping power and track-inspired setups.",
      priceFrom: 300,
      type: "Aftermarket",
      rating: 4.3,
      vehicleRequired: true,
      keywords: ["performance", "brakes", "upgrade"]
    },
    highperformancetires: {
      key: "highperformancetires",
      name: "High Performance Tiers",
      image: "./pictures/ultra-high-performance-tires-5.jpg",
      category: "Performance",
      description: "Grip-focused tire upgrades for performance builds and higher-speed confidence.",
      priceFrom: 300,
      type: "Original",
      rating: 4.6,
      vehicleRequired: true,
      keywords: ["tires", "performance", "grip"]
    }
  };

  const partKeyToNames = {
    oilfilter: ["oil filter", "oil filters"],
    brakepads: ["brake pads"],
    carbattery: ["car battery"],
    wiperblades: ["wiper blades"],
    sparkplugs: ["spark plugs", "spark plug"],
    alternator: ["alternator"],
    shockabsorber: ["shock absorber"],
    gaskets: ["gaskets", "gasket set"],
    waterpump: ["water pump"],
    tierodends: ["tie rod ends"],
    oxygensensor: ["oxygen sensor"],
    serpentinebelt: ["serpentine belt"],
    coldairintake: ["cold air intake"],
    coilover: ["coilover"],
    bigbrakekit: ["big brake kit"],
    highperformancetires: ["high performance tires"]
  };

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getBrandName(key) {
    const normalizedKey = key === "chevorlet" ? "chevrolet" : key;
    return brandCatalog[normalizedKey]?.name || String(normalizedKey || "").toUpperCase();
  }

  function getCompatibleProductByKey(groupKey, products) {
    const aliases = partKeyToNames[groupKey] || [];
    return (products || []).find((product) => {
      const productName = normalizeText(product?.name);
      return aliases.some((alias) => productName === normalizeText(alias));
    }) || null;
  }

  window.AutoFixBrandCatalog = brandCatalog;
  window.AutoFixDealerCatalog = dealerCatalog;
  window.AutoFixVehicleRequiredGroups = vehicleRequiredGroups;
  window.AutoFixPartKeyToNames = partKeyToNames;
  window.AutoFixPartCatalog = partCatalog;
  window.getAutoFixBrandName = getBrandName;
  window.getAutoFixCompatibleProductByKey = getCompatibleProductByKey;
})();
