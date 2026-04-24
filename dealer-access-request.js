(async function () {
  const freshUser = await window.AutoFixAuth.refreshSessionUser();
  if (!freshUser) {
    window.location.href = "signin.html";
    return;
  }

  const form = document.getElementById("dealerAccessRequestForm");
  const emailInput = document.getElementById("dealerRequestEmail");
  const dealerSelect = document.getElementById("dealerRequestDealerSelect");
  const brandGrid = document.getElementById("dealerRequestBrandGrid");
  const noteInput = document.getElementById("dealerRequestNote");
  const feedback = document.getElementById("dealerRequestFeedback");
  const accountBadge = document.getElementById("dealerRequestAccountBadge");
  const historyBadge = document.getElementById("dealerRequestHistoryBadge");
  const historyRoot = document.getElementById("dealerRequestHistory");
  const submitBtn = form.querySelector('button[type="submit"]');

  const state = {
    data: null
  };

  function setFeedback(message) {
    feedback.textContent = message;
  }

  function formatStatus(status) {
    return {
      pending: "Pending review",
      approved: "Approved",
      rejected: "Rejected"
    }[status] || status;
  }

  function renderBrandOptions() {
    const dealer = state.data?.dealers?.find((item) => String(item.id) === String(dealerSelect.value));
    if (!dealer) {
      brandGrid.innerHTML = '<span class="dealer-request-chip">Choose a dealer network first</span>';
      return;
    }

    brandGrid.innerHTML = dealer.brands
      .map((brand) => `
        <label class="dealer-request-brand">
          <input type="checkbox" value="${brand.key}" />
          <span>${brand.name}</span>
        </label>
      `)
      .join("");
  }

  function renderHistory() {
    const requests = state.data?.requests || [];
    historyBadge.textContent = `${requests.length} request${requests.length === 1 ? "" : "s"}`;

    if (!requests.length) {
      historyRoot.innerHTML = `
        <article class="dealer-request-history__item">
          <div class="dealer-request-history__top">
            <h3>No dealer requests yet</h3>
            <span class="dealer-request-status dealer-request-status--pending">Ready</span>
          </div>
          <p>Once you submit a request, the admin can review it from the control center and approve the correct dealer network for your account.</p>
        </article>
      `;
      return;
    }

    historyRoot.innerHTML = requests
      .map((request) => `
        <article class="dealer-request-history__item">
          <div class="dealer-request-history__top">
            <h3>${request.dealer.name}</h3>
            <span class="dealer-request-status dealer-request-status--${request.status}">${formatStatus(request.status)}</span>
          </div>
          <p>${request.note || "No business note was added for this request."}</p>
          <div class="dealer-request-chip-wrap">
            ${request.requestedBrands.map((brand) => `<span class="dealer-request-chip">${brand.name}</span>`).join("")}
          </div>
          <div class="dealer-request-history__meta">
            <span><i class="fa-regular fa-clock"></i> Submitted ${new Date(request.createdAt).toLocaleString("en-GB")}</span>
            ${request.reviewedAt ? `<span><i class="fa-solid fa-check"></i> Reviewed ${new Date(request.reviewedAt).toLocaleString("en-GB")}</span>` : ""}
          </div>
        </article>
      `)
      .join("");
  }

  function render(data) {
    state.data = data;
    emailInput.value = data.viewer.email;
    accountBadge.textContent = data.eligible ? "Eligible account" : "Dashboard already enabled";

    dealerSelect.innerHTML = (data.dealers || [])
      .map((dealer) => `<option value="${dealer.id}">${dealer.name}</option>`)
      .join("");

    renderBrandOptions();
    renderHistory();

    if (!data.eligible) {
      dealerSelect.disabled = true;
      noteInput.disabled = true;
      submitBtn.disabled = true;
      brandGrid.querySelectorAll("input").forEach((input) => {
        input.disabled = true;
      });
      setFeedback("This account already has admin or dealer dashboard access, so a new dealer request is not needed.");
      return;
    }

    dealerSelect.disabled = false;
    noteInput.disabled = false;
    submitBtn.disabled = false;
    setFeedback("Choose one official dealer network and only the brands that belong to it.");
  }

  async function loadRequestPage() {
    try {
      const data = await window.AutoFixAuth.apiFetch("/dealers/access/request/me");
      render(data);
    } catch (error) {
      setFeedback(error.message);
    }
  }

  dealerSelect.addEventListener("change", () => {
    renderBrandOptions();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const brandKeys = Array.from(brandGrid.querySelectorAll('input:checked')).map((input) => input.value);
    if (!brandKeys.length) {
      setFeedback("Choose at least one brand before sending the request.");
      return;
    }

    submitBtn.disabled = true;
    setFeedback("Submitting dealer-access request...");

    try {
      const data = await window.AutoFixAuth.apiFetch("/dealers/access/request", {
        method: "POST",
        body: JSON.stringify({
          dealerId: Number(dealerSelect.value),
          brandKeys,
          note: noteInput.value
        })
      });

      noteInput.value = "";
      render(data);
      setFeedback("Your dealer-access request was submitted and is now waiting for admin review.");
    } catch (error) {
      setFeedback(error.message);
    } finally {
      if (state.data?.eligible) {
        submitBtn.disabled = false;
      }
    }
  });

  loadRequestPage();
})();
