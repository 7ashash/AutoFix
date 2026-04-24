const authApi = window.AutoFixAuth;
const verificationApi = window.AutoFixVerification;

const reportForm = document.getElementById("reportForm");
const reportSerial = document.getElementById("reportSerial");
const reportSeller = document.getElementById("reportSeller");
const reportStatus = document.getElementById("reportStatus");
const reportPartReference = document.getElementById("reportPartReference");
const reportReason = document.getElementById("reportReason");
const reportSubmitBtn = document.getElementById("reportSubmitBtn");
const reportSigninBtn = document.getElementById("reportSigninBtn");
const reportAuthBanner = document.getElementById("reportAuthBanner");
const reportSuccess = document.getElementById("reportSuccess");
const reportSuccessText = document.getElementById("reportSuccessText");
const reportPreviewImage = document.getElementById("reportPreviewImage");
const reportPreviewName = document.getElementById("reportPreviewName");
const reportPreviewType = document.getElementById("reportPreviewType");
const reportPreviewPartNumber = document.getElementById("reportPreviewPartNumber");
const reportPreviewMeta = document.getElementById("reportPreviewMeta");

const reportContext = loadReportContext();

function readVerifyContext() {
  try {
    return JSON.parse(localStorage.getItem("verifyProduct")) || null;
  } catch {
    return null;
  }
}

function loadReportContext() {
  const params = new URLSearchParams(window.location.search);
  const stored = readVerifyContext() || {};

  return {
    partId: Number(params.get("partId") || stored.partId || 0) || null,
    partSlug: String(params.get("partSlug") || stored.partSlug || "").trim(),
    serialNumber: String(params.get("serial") || stored.serialNumber || "").trim(),
    sellerName: String(params.get("seller") || stored.dealerName || "").trim(),
    dealerId: Number(params.get("dealerId") || stored.dealerId || 0) || null,
    dealerSlug: String(params.get("dealerSlug") || stored.dealerSlug || "").trim(),
    name: String(stored.name || "").trim(),
    image: String(stored.image || "").trim(),
    type: String(stored.type || "").trim(),
    partNumber: String(stored.partNumber || "").trim()
  };
}

function getCurrentUrlForRedirect() {
  return `report.html${window.location.search || ""}`;
}

function setSubmitState(isLoading) {
  reportSubmitBtn.disabled = isLoading;
  reportSubmitBtn.textContent = isLoading ? "Submitting..." : "Submit report";
}

function updateAuthBanner() {
  const user = authApi?.getUser?.();
  if (user) {
    reportAuthBanner.textContent = `Signed in as ${user.fullName}. This report will be saved to your verification history.`;
    reportSigninBtn.textContent = "Signed in";
    reportSigninBtn.disabled = true;
    return;
  }

  reportAuthBanner.textContent = "Sign in to submit a report that will be saved to your account history.";
  reportSigninBtn.textContent = "Sign in first";
  reportSigninBtn.disabled = false;
}

function populateReportPreview() {
  reportPreviewImage.src = reportContext.image || "./pictures/autofix logo.png";
  reportPreviewImage.onerror = function onImageError() {
    this.src = "./pictures/autofix logo.png";
  };

  reportPreviewName.textContent = reportContext.name || "No selected part";
  reportPreviewType.textContent = reportContext.type || "Context";
  reportPreviewPartNumber.textContent = reportContext.partNumber || "No part number";
  reportPreviewMeta.textContent = reportContext.sellerName
    ? `Current seller context: ${reportContext.sellerName}`
    : "Open a product or verification result first to attach richer part context.";

  reportPartReference.value = reportContext.partNumber || reportContext.name || "No attached part context";
}

function populateForm() {
  reportSerial.value = reportContext.serialNumber || "";
  reportSeller.value = reportContext.sellerName || "";
}

function redirectToSignin() {
  const redirect = encodeURIComponent(getCurrentUrlForRedirect());
  window.location.href = `signin.html?redirect=${redirect}`;
}

async function submitReport(event) {
  event.preventDefault();

  const user = authApi?.getUser?.();
  if (!user) {
    redirectToSignin();
    return;
  }

  const payload = {
    serialNumber: reportSerial.value.trim(),
    sellerName: reportSeller.value.trim(),
    reportStatus: reportStatus.value,
    note: reportReason.value.trim(),
    partId: reportContext.partId,
    partSlug: reportContext.partSlug
  };

  setSubmitState(true);

  try {
    const data = await verificationApi.submitReport(payload);
    reportForm.hidden = true;
    reportSuccess.hidden = false;
    reportSuccessText.textContent = `Report #${data.report.id} for serial ${data.report.serialNumber} is now queued for AutoFix review.`;
  } catch (error) {
    window.AutoFixToast.error(error.message || "Unable to submit this report right now.");
  } finally {
    setSubmitState(false);
  }
}

reportSigninBtn.addEventListener("click", () => {
  if (!authApi?.getUser?.()) {
    redirectToSignin();
  }
});

reportForm.addEventListener("submit", submitReport);

updateAuthBanner();
populateReportPreview();
populateForm();
