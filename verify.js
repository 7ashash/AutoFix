const authApi = window.AutoFixAuth;
const verificationApi = window.AutoFixVerification;

const verifyImg = document.getElementById("verifyImg");
const verifyName = document.getElementById("verifyName");
const verifyType = document.getElementById("verifyType");
const verifyPrice = document.getElementById("verifyPrice");
const verifyTypeChip = document.getElementById("verifyTypeChip");
const verifyPriceChip = document.getElementById("verifyPriceChip");
const serialInput = document.getElementById("serialInput");
const resultBox = document.getElementById("resultBox");
const resultStatusBadge = document.getElementById("resultStatusBadge");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const resultSerial = document.getElementById("resultSerial");
const recommendationText = document.getElementById("recommendationText");
const verifyVehicleChip = document.getElementById("verifyVehicleChip");
const verifyDealerChip = document.getElementById("verifyDealerChip");
const verifySellerLink = document.getElementById("verifySellerLink");
const verifyReportLink = document.getElementById("verifyReportLink");
const verifyAlternativesLink = document.getElementById("verifyAlternativesLink");
const verifyHistorySection = document.getElementById("verifyHistorySection");
const verifyChecksCount = document.getElementById("verifyChecksCount");
const verifyReportsCount = document.getElementById("verifyReportsCount");
const verifyChecksList = document.getElementById("verifyChecksList");
const verifyReportsList = document.getElementById("verifyReportsList");
const verifyButton = document.querySelector(".verify-box button");

let verifyContext = loadVerifyContext();
let currentVerificationResult = null;

function readStoredContext() {
  try {
    return JSON.parse(localStorage.getItem("verifyProduct")) || null;
  } catch {
    return null;
  }
}

function loadVerifyContext() {
  const params = new URLSearchParams(window.location.search);
  const hasProductContext = params.has("partId") || params.has("partSlug");
  const hasSerialContext = params.has("serial");
  const stored = hasProductContext ? (readStoredContext() || {}) : {};

  return {
    contextMode: hasProductContext ? "product" : "manual",
    partId: Number(params.get("partId") || stored.partId || 0) || null,
    partSlug: String(params.get("partSlug") || stored.partSlug || "").trim(),
    serialNumber: String(hasSerialContext ? params.get("serial") : stored.serialNumber || "").trim(),
    dealerId: Number(params.get("dealerId") || stored.dealerId || 0) || null,
    dealerSlug: String(params.get("dealerSlug") || stored.dealerSlug || "").trim(),
    dealerName: String(params.get("dealerName") || stored.dealerName || "").trim(),
    brandKey: String(params.get("brandKey") || stored.brandKey || localStorage.getItem("selectedBrand") || "").trim().toLowerCase(),
    modelKey: String(params.get("modelKey") || stored.modelKey || localStorage.getItem("selectedModel") || "").trim().toLowerCase(),
    modelName: String(params.get("modelName") || stored.modelName || localStorage.getItem("selectedModelName") || "").trim(),
    year: Number(params.get("year") || stored.year || localStorage.getItem("selectedYear") || 0) || null,
    name: String(stored.name || "").trim(),
    image: String(stored.image || "").trim(),
    type: String(stored.type || "").trim(),
    price: Number(stored.price || 0) || 0,
    rating: Number(stored.rating || 0) || 0,
    partNumber: String(stored.partNumber || "").trim()
  };
}

function persistVerifyContext({ forReport = false } = {}) {
  if (verifyContext.contextMode !== "product" && !forReport) {
    return;
  }

  localStorage.setItem("verifyProduct", JSON.stringify(verifyContext));
}

function formatPrice(value) {
  return `${Number(value || 0)} EGP`;
}

function formatDateTime(value) {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return date.toLocaleString("en-EG", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function getVehicleLabel() {
  const brandKey = verifyContext.brandKey || String(localStorage.getItem("selectedBrand") || "").trim().toLowerCase();
  const modelName = verifyContext.modelName || verifyContext.modelKey || "";
  const year = verifyContext.year;

  if (brandKey && modelName && year) {
    const brandLabel = window.getAutoFixBrandName
      ? window.getAutoFixBrandName(brandKey)
      : brandKey.toUpperCase();
    return `${brandLabel} ${modelName} ${year}`;
  }

  return "Vehicle not selected";
}

function getStatusVariant(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "valid") {
    return "valid";
  }
  if (normalized === "unverified") {
    return "unverified";
  }
  return "suspicious";
}

function setButtonLoading(isLoading) {
  if (!verifyButton) {
    return;
  }

  verifyButton.disabled = isLoading;
  verifyButton.textContent = isLoading ? "Checking..." : "Verify";
}

function applyVerificationState({ status, title, registryMessage, serialNumber, recommendation }) {
  const variant = getStatusVariant(status);

  resultBox.classList.remove(
    "result-box--valid",
    "result-box--unverified",
    "result-box--suspicious"
  );
  resultBox.classList.add(`result-box--${variant}`);

  resultStatusBadge.textContent = capitalize(status);
  resultTitle.textContent = `Result: ${title}`;
  resultText.textContent = registryMessage;
  resultSerial.textContent = serialNumber || "Pending verification";
  recommendationText.textContent = recommendation;
}

function capitalize(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getPreviewPart() {
  return currentVerificationResult?.selectedPart
    || currentVerificationResult?.matchedPart
    || (verifyContext.name ? verifyContext : null);
}

function populateProductPreview() {
  const part = getPreviewPart();

  if (!part) {
    verifyName.textContent = "No product selected";
    verifyType.textContent = "Unknown";
    verifyPrice.textContent = "0 EGP";
    verifyTypeChip.textContent = "Unknown";
    verifyPriceChip.textContent = "0 EGP";
    verifyImg.src = "./pictures/autofix logo.png";

    applyVerificationState({
      status: "unverified",
      title: "Ready for serial lookup",
      registryMessage: "Enter any serial number from the part or packaging to check it against the AutoFix registry.",
      serialNumber: "No serial available",
      recommendation: "You do not need to open a product first. If the serial exists, AutoFix will detect the matched part automatically."
    });
    return;
  }

  verifyImg.src = part.image || "./pictures/autofix logo.png";
  verifyImg.onerror = function onImageError() {
    this.src = "./pictures/autofix logo.png";
  };

  verifyName.textContent = part.name || "Selected product";
  verifyType.textContent = part.type || "Unknown";
  verifyPrice.textContent = formatPrice(part.price || 0);
  verifyTypeChip.textContent = part.type || "Unknown";
  verifyPriceChip.textContent = formatPrice(part.price || 0);

  if (!serialInput.value && verifyContext.serialNumber) {
    serialInput.value = verifyContext.serialNumber;
  }
}

function populateContextChips() {
  verifyVehicleChip.textContent = getVehicleLabel();
  verifyDealerChip.textContent =
    currentVerificationResult?.dealer?.name
    || verifyContext.dealerName
    || "Dealer registry";
}

function updateActionLinks() {
  const resultPart = currentVerificationResult?.selectedPart || currentVerificationResult?.matchedPart || null;
  const dealer = currentVerificationResult?.dealer || resultPart?.dealer || null;
  const serialNumber = currentVerificationResult?.serialNumber || serialInput.value.trim() || verifyContext.serialNumber || "";
  const partId = resultPart?.id || verifyContext.partId || "";
  const partSlug = resultPart?.slug || verifyContext.partSlug || "";

  if (dealer?.id) {
    localStorage.setItem("selectedDealerId", String(dealer.id));
  }
  if (dealer?.slug) {
    localStorage.setItem("selectedDealerSlug", dealer.slug);
  }
  if (dealer?.name) {
    localStorage.setItem("selectedDealerName", dealer.name);
  }

  if (verifySellerLink) {
    verifySellerLink.href = "dealers.html";
  }

  if (verifyReportLink) {
    const reportParams = new URLSearchParams();
    if (serialNumber) reportParams.set("serial", serialNumber);
    if (partId) reportParams.set("partId", partId);
    if (partSlug) reportParams.set("partSlug", partSlug);
    if (dealer?.name) reportParams.set("seller", dealer.name);
    if (dealer?.id) reportParams.set("dealerId", dealer.id);
    if (dealer?.slug) reportParams.set("dealerSlug", dealer.slug);
    verifyReportLink.href = `report.html${reportParams.toString() ? `?${reportParams.toString()}` : ""}`;
  }

  if (verifyAlternativesLink) {
    verifyAlternativesLink.href = partId || partSlug ? "product.html" : "index.html";
  }
}

function renderHistoryEmpty(target, message) {
  target.innerHTML = `<div class="verify-history-empty">${message}</div>`;
}

function renderChecksHistory(checks) {
  verifyChecksCount.textContent = String(checks.length);
  if (!checks.length) {
    renderHistoryEmpty(verifyChecksList, "No verification checks yet.");
    return;
  }

  verifyChecksList.innerHTML = checks
    .map((item) => `
      <article class="verify-history-item">
        <div class="verify-history-item__top">
          <span class="verify-history-status verify-history-status--${getStatusVariant(item.resultStatus)}">${capitalize(item.resultStatus)}</span>
          <span class="verify-history-time">${formatDateTime(item.createdAt)}</span>
        </div>
        <h4>${item.part?.name || item.serialNumber}</h4>
        <p>Serial: ${item.serialNumber}</p>
        <p>${item.recommendation || "Verification completed."}</p>
      </article>
    `)
    .join("");
}

function renderReportsHistory(reports) {
  verifyReportsCount.textContent = String(reports.length);
  if (!reports.length) {
    renderHistoryEmpty(verifyReportsList, "No submitted reports yet.");
    return;
  }

  verifyReportsList.innerHTML = reports
    .map((item) => `
      <article class="verify-history-item">
        <div class="verify-history-item__top">
          <span class="verify-history-status verify-history-status--${getStatusVariant(item.reportStatus)}">${capitalize(item.reportStatus)}</span>
          <span class="verify-history-status verify-history-status--neutral">${capitalize(item.actionStatus)}</span>
        </div>
        <h4>${item.part?.name || item.serialNumber}</h4>
        <p>Seller: ${item.sellerName || "AutoFix marketplace"}</p>
        <p>${item.resolutionNote || item.note || "Report submitted for review."}</p>
      </article>
    `)
    .join("");
}

async function loadHistory() {
  const user = authApi?.getUser?.();
  if (!user || !verifyHistorySection) {
    return;
  }

  try {
    const history = await verificationApi.fetchHistory();
    verifyHistorySection.hidden = false;
    renderChecksHistory(history.checks || []);
    renderReportsHistory(history.reports || []);
  } catch {
    verifyHistorySection.hidden = true;
  }
}

async function runVerification() {
  const serialNumber = String(serialInput.value || "").trim().toUpperCase();
  const hasProductContext = verifyContext.contextMode === "product" && (verifyContext.partId || verifyContext.partSlug);

  if (!serialNumber) {
    window.AutoFixToast.warning("Please enter serial number");
    return;
  }

  setButtonLoading(true);

  try {
    const data = await verificationApi.runCheck({
      serialNumber,
      partId: hasProductContext ? verifyContext.partId : null,
      partSlug: hasProductContext ? verifyContext.partSlug : "",
      requestSource: "verify_page"
    });

    currentVerificationResult = data;
    verifyContext.serialNumber = serialNumber;

    const resultPart = data.selectedPart || data.matchedPart || null;
    if (resultPart) {
      verifyContext = {
        ...verifyContext,
        partId: resultPart.id || verifyContext.partId,
        partSlug: resultPart.slug || verifyContext.partSlug,
        dealerId: data.dealer?.id || resultPart.dealer?.id || verifyContext.dealerId,
        dealerSlug: data.dealer?.slug || resultPart.dealer?.slug || verifyContext.dealerSlug,
        dealerName: data.dealer?.name || resultPart.dealer?.name || verifyContext.dealerName,
        brandKey: resultPart.brand?.key || verifyContext.brandKey,
        name: resultPart.name || verifyContext.name,
        image: resultPart.image || verifyContext.image,
        type: resultPart.type || verifyContext.type,
        price: resultPart.price || verifyContext.price,
        rating: resultPart.rating || verifyContext.rating,
        partNumber: resultPart.partNumber || verifyContext.partNumber
      };
    }

    persistVerifyContext({ forReport: Boolean(resultPart) });
    applyVerificationState({
      status: data.status,
      title: data.title,
      registryMessage: data.registryMessage,
      serialNumber: data.serialNumber,
      recommendation: data.recommendation
    });
    populateProductPreview();
    populateContextChips();
    updateActionLinks();
    await loadHistory();
  } catch (error) {
    window.AutoFixToast.error(error.message || "Verification failed");
  } finally {
    setButtonLoading(false);
  }
}

function applyInitialState() {
  serialInput.value = verifyContext.serialNumber || "";
  populateProductPreview();
  populateContextChips();
  updateActionLinks();
}

window.runVerification = runVerification;

applyInitialState();

if (verifyContext.serialNumber) {
  runVerification();
} else {
  loadHistory();
}
