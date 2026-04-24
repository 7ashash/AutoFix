function goToSignIn() {
  window.location.href = "signin.html";
}

function goToCart() {
  window.location.href = "cart.html";
}

function goToProduct(name, image, desc, price, type, rating) {
  localStorage.setItem(
    "product",
    JSON.stringify({
      name,
      image,
      desc,
      price,
      type,
      rating,
    })
  );

  window.location.href = "product.html";
}

function buildSearchCatalog() {
  const partCatalog = window.AutoFixPartCatalog || {};

  return Object.values(partCatalog).map((item) => ({
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

function openSearchResults(query) {
  const catalog = buildSearchCatalog();
  localStorage.setItem("allProducts", JSON.stringify(catalog));
  window.location.href = `search.html?query=${encodeURIComponent(query)}`;
}

function resetVehicleSelectionState() {
  [
    "selectedBrand",
    "selectedModel",
    "selectedModelName",
    "selectedYear",
    "carSupportedProducts",
    "selectedGroup",
    "selectedProductIndex",
    "product",
    "selectedPartId",
    "selectedPartSlug",
    "selectedProductMode",
    "selectedDealerId",
    "selectedDealerSlug",
    "selectedDealerName",
    "selectedCatalogScope"
  ].forEach((key) => localStorage.removeItem(key));
}

function promptVehicleSelectionFromHome(groupKey) {
  const brandsSection = document.getElementById("brandSelectionSection");

  resetVehicleSelectionState();
  localStorage.setItem("pendingPartKey", groupKey);

  if (brandsSection) {
    brandsSection.classList.add("brands-section--focus");
    brandsSection.scrollIntoView({ behavior: "smooth", block: "start" });

    window.setTimeout(() => {
      brandsSection.classList.remove("brands-section--focus");
    }, 1400);
  }

  window.AutoFixToast.warning("Please choose your car brand, model, and year first so we can show the correct compatible part.");
}

function goToProducts(groupKey, productIndex = 0) {
  const vehicleRequiredGroups = new Set(window.AutoFixVehicleRequiredGroups || []);

  if (vehicleRequiredGroups.has(groupKey)) {
    promptVehicleSelectionFromHome(groupKey);
    return;
  }

  localStorage.removeItem("pendingPartKey");
  localStorage.setItem("selectedGroup", groupKey);
  localStorage.setItem("selectedProductIndex", productIndex);
  localStorage.removeItem("product");
  window.location.href = "product.html";
}

function updateCartCount() {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  let totalQuantity = 0;

  cart.forEach((item) => {
    totalQuantity += item.quantity;
  });

  const cartCount = document.getElementById("cartCount");
  if (cartCount) {
    cartCount.innerText = totalQuantity;
  }
}

function updateAuthUI() {
  const authText = document.getElementById("authText");
  const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));

  if (authText) {
    authText.innerText = loggedInUser ? "Log Out" : "Sign In";
  }
}

function handleAuthAction() {
  const loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));

  if (loggedInUser) {
    localStorage.removeItem("loggedInUser");
    window.AutoFixToast.success("Logged out successfully");
    window.location.href = "index.html";
  } else {
    window.location.href = "signin.html";
  }
}

function sendMessage() {
  const input = document.getElementById("userInput");
  const chatBody = document.getElementById("chatBody");

  if (!input || !chatBody) return;

  let text = input.value.trim();
  if (text === "") return;

  let userMsg = document.createElement("div");
  userMsg.className = "user-msg";
  userMsg.innerText = text;
  chatBody.appendChild(userMsg);

  let botMsg = document.createElement("div");
  botMsg.className = "bot-msg";

  let message = text.toLowerCase();

  if (message.includes("brake")) {
    botMsg.innerText = "Brake pads and brake fluid are available 🔧";
  } else if (message.includes("oil")) {
    botMsg.innerText = "Check Motor Oil in the Fluids section 🛢️";
  } else if (message.includes("battery")) {
    botMsg.innerText = "We have car batteries available 🔋";
  } else if (message.includes("tire") || message.includes("tires")) {
    botMsg.innerText = "High performance tires are available 🏁";
  } else if (message.includes("tool")) {
    botMsg.innerText = "Check the Car Tools section 🧰";
  } else if (message.includes("accessories")) {
    botMsg.innerText = "You can find many car accessories 🚗";
  } else {
    botMsg.innerText = "Ask me about car parts, tools, fluids, or accessories 🚘";
  }

  chatBody.appendChild(botMsg);
  input.value = "";
  chatBody.scrollTop = chatBody.scrollHeight;
}

document.addEventListener("DOMContentLoaded", function () {
  updateAuthUI();
  updateCartCount();

  const menuBtn = document.getElementById("menuBtn");
  const sidebar = document.getElementById("sidebar");
  const closeSidebar = document.getElementById("closeSidebar");

  const aiBtn = document.getElementById("aiBtn");
  const chatSidebar = document.getElementById("chatSidebar");
  const closeChat = document.getElementById("closeChat");

  const replacementLink = document.getElementById("replacementLink");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const shopBtn = document.getElementById("shopNowBtn");
  const userInput = document.getElementById("userInput");

  const carousel = document.getElementById("carousel");
  const nextBtn = document.getElementById("nextBtn");
  const prevBtn = document.getElementById("prevBtn");

  if (menuBtn && sidebar) {
    menuBtn.addEventListener("click", () => {
      sidebar.style.left = "0";
    });
  }

  if (closeSidebar && sidebar) {
    closeSidebar.addEventListener("click", () => {
      sidebar.style.left = "-250px";
    });
  }

  if (aiBtn && chatSidebar) {
    aiBtn.addEventListener("click", function () {
      chatSidebar.classList.add("active");
    });
  }

  if (closeChat && chatSidebar) {
    closeChat.addEventListener("click", function () {
      chatSidebar.classList.remove("active");
    });
  }

  if (replacementLink) {
    replacementLink.addEventListener("click", (e) => {
      const replacementSection = document.getElementById("replacementSection");
      if (replacementSection) {
        e.preventDefault();
        replacementSection.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  if (carousel && nextBtn) {
    nextBtn.addEventListener("click", () => {
      carousel.scrollBy({
        left: 140,
        behavior: "smooth"
      });
    });
  }

  if (carousel && prevBtn) {
    prevBtn.addEventListener("click", () => {
      carousel.scrollBy({
        left: -140,
        behavior: "smooth"
      });
    });
  }

  document.querySelectorAll(".brand").forEach((item) => {
    item.addEventListener("click", () => {
      const brand = item.getAttribute("data-brand");
      const normalizedBrand = brand === "chevorlet" ? "chevrolet" : brand;
      localStorage.setItem("selectedBrand", normalizedBrand);
      localStorage.removeItem("selectedModel");
      localStorage.removeItem("selectedModelName");
      localStorage.removeItem("selectedYear");
      localStorage.removeItem("carSupportedProducts");
      localStorage.removeItem("selectedGroup");
      localStorage.removeItem("selectedProductIndex");
      localStorage.removeItem("product");
      localStorage.removeItem("selectedPartId");
      localStorage.removeItem("selectedPartSlug");
      localStorage.removeItem("selectedProductMode");
      localStorage.removeItem("selectedDealerId");
      localStorage.removeItem("selectedDealerSlug");
      localStorage.removeItem("selectedDealerName");
      localStorage.setItem("selectedCatalogScope", "marketplace");
      window.location.href = "model.html";
    });
  });

  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", () => {
      const value = searchInput.value.trim();

      if (value === "") {
        window.AutoFixToast.warning("Please enter something to search");
      } else {
        openSearchResults(value);
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        const value = searchInput.value.trim();

        if (value === "") {
          window.AutoFixToast.warning("Please enter something to search");
        } else {
          openSearchResults(value);
        }
      }
    });
  }

  if (shopBtn) {
    shopBtn.addEventListener("click", () => {
      const brandSelectionSection = document.getElementById("brandSelectionSection");
      if (brandSelectionSection) {
        brandSelectionSection.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  if (userInput) {
    userInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        sendMessage();
      }
    });
  }

  const products = [];
  document.querySelectorAll(
    ".replacement-item, .accessories-item, .tools-item, .fluid-item, .Performance-item"
  ).forEach((item) => {
    const nameEl = item.querySelector("p");
    const imageEl = item.querySelector("img");
    const onclick = item.getAttribute("onclick");

    if (!nameEl || !imageEl || !onclick) return;

    products.push({
      name: nameEl.innerText,
      image: imageEl.src,
      onclick
    });
  });

  const suggestionsBox = document.getElementById("suggestions");

  if (searchInput && suggestionsBox) {
    searchInput.addEventListener("input", function () {
      const value = this.value.toLowerCase();
      suggestionsBox.innerHTML = "";

      if (value === "") {
        suggestionsBox.style.display = "none";
        return;
      }

      const filtered = products.filter((item) =>
        item.name.toLowerCase().includes(value)
      );

      filtered.forEach((item) => {
        const div = document.createElement("div");
        div.classList.add("suggestion-item");

        div.innerHTML = `
          <img src="${item.image}">
          <span>${item.name}</span>
        `;

        div.addEventListener("click", () => {
          suggestionsBox.style.display = "none";
          eval(item.onclick);
        });

        suggestionsBox.appendChild(div);
      });

      suggestionsBox.style.display = filtered.length ? "block" : "none";
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest(".search-bar")) {
        suggestionsBox.style.display = "none";
      }
    });
  }
});


document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll("section");

  let startReveal = false;
  let revealElements = [];

  sections.forEach((section) => {
    if (
      section.textContent.toLowerCase().includes("replacement parts") ||
      section.classList.contains("replacement-parts")
    ) {
      startReveal = true;
    }

    if (startReveal) {
      const items = section.querySelectorAll("h1, h2, h3, p, .card, .box, .item, img, button");
      items.forEach((item) => {
        item.classList.add("reveal-on-scroll");
        revealElements.push(item);
      });
    }
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add("show");
          }, index * 120);

          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealElements.forEach((el) => observer.observe(el));
});




document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(
    ".replacement-item, .accessories-item"
  );

  cards.forEach((card) => {
    card.classList.add("reveal-on-scroll");
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.05 }
  );

  cards.forEach((card) => observer.observe(card));



  const verifyModal = document.getElementById("verifyModal");
  const openVerifyModal = document.getElementById("openVerifyModal");
  const verifyNavBtn = document.getElementById("verifyNavBtn");
  const closeVerifyModal = document.getElementById("closeVerifyModal");
  const verifyBtn = document.getElementById("verifyBtn");
  const serialInput = document.getElementById("serialInput");
  const verifyMessage = document.getElementById("verifyMessage");
  const partResult = document.getElementById("partResult");

  const resultName = document.getElementById("resultName");
  const resultBrand = document.getElementById("resultBrand");
  const resultSerial = document.getElementById("resultSerial");
  const resultCategory = document.getElementById("resultCategory");
  const resultCar = document.getElementById("resultCar");
  const resultPrice = document.getElementById("resultPrice");
  const resultCondition = document.getElementById("resultCondition");
  const resultWarranty = document.getElementById("resultWarranty");

  function showVerifyModal() {
    verifyModal.classList.add("show");
  }

  function hideVerifyModal() {
    verifyModal.classList.remove("show");
  }

  if (openVerifyModal) {
    openVerifyModal.addEventListener("click", function (e) {
      e.preventDefault();
      showVerifyModal();
    });
  }

  if (verifyNavBtn) {
    verifyNavBtn.addEventListener("click", showVerifyModal);
  }

  if (closeVerifyModal) {
    closeVerifyModal.addEventListener("click", hideVerifyModal);
  }

  if (verifyModal) {
    verifyModal.addEventListener("click", function (e) {
      if (e.target === verifyModal) {
        hideVerifyModal();
      }
    });
  }

});




