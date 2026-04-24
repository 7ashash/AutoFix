(function () {
  const authApi = window.AutoFixAuth;

  function ensureApi() {
    if (!authApi?.apiFetch) {
      throw new Error("AutoFixAuth apiFetch is not available");
    }
  }

  async function runCheck(payload) {
    ensureApi();
    const data = await authApi.apiFetch("/verification/check", {
      method: "POST",
      body: JSON.stringify(payload || {})
    });
    return data;
  }

  async function fetchHistory() {
    ensureApi();
    return authApi.apiFetch("/verification/history");
  }

  async function submitReport(payload) {
    ensureApi();
    return authApi.apiFetch("/verification/reports", {
      method: "POST",
      body: JSON.stringify(payload || {})
    });
  }

  async function fetchReviewQueue(filters = {}) {
    ensureApi();
    const searchParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.set(key, value);
      }
    });

    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return authApi.apiFetch(`/verification/reports/review${queryString}`);
  }

  async function updateReview(reportId, payload) {
    ensureApi();
    return authApi.apiFetch(`/verification/reports/${encodeURIComponent(reportId)}/review`, {
      method: "PATCH",
      body: JSON.stringify(payload || {})
    });
  }

  window.AutoFixVerification = {
    runCheck,
    fetchHistory,
    submitReport,
    fetchReviewQueue,
    updateReview
  };
})();
