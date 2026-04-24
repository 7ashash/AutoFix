const API_BASE = process.env.AUTOFIX_API_BASE || "http://localhost:4000/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    throw new Error(`${path} failed: ${payload?.error?.message || response.statusText}`);
  }

  return payload.data;
}

async function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
}

async function main() {
  const uniqueSerial = `SN-PH6-${String(Date.now()).slice(-6)}`;

  const userLogin = await login("user@autofix.com", "User@123");
  const userHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${userLogin.token}`
  };

  const mgCompatible = await request("/parts/compatible?brandKey=mg&modelKey=mg-zs&year=2025", {
    headers: userHeaders
  });

  const toyotaCompatible = await request("/parts/compatible?brandKey=toyota&modelKey=toyota-corolla&year=2024", {
    headers: userHeaders
  });

  const validPart = (mgCompatible.parts || []).find((part) => part.groupKey === "carbattery") || mgCompatible.parts?.[0];
  const mismatchPart = (toyotaCompatible.parts || []).find((part) => part.groupKey === "oilfilter") || toyotaCompatible.parts?.[0];

  if (!validPart?.slug || !validPart?.serialNumber) {
    throw new Error("Could not load a valid MG fitment-ready part for verification smoke testing");
  }

  if (!mismatchPart?.serialNumber) {
    throw new Error("Could not load a mismatch serial for verification smoke testing");
  }

  const validCheck = await request("/verification/check", {
    method: "POST",
    headers: userHeaders,
    body: JSON.stringify({
      partSlug: validPart.slug,
      serialNumber: validPart.serialNumber,
      requestSource: "verify_page"
    })
  });

  if (validCheck.status !== "valid") {
    throw new Error("Expected a valid verification result for the known MG battery serial");
  }

  const serialOnlyCheck = await request("/verification/check", {
    method: "POST",
    headers: userHeaders,
    body: JSON.stringify({
      serialNumber: validPart.serialNumber,
      requestSource: "verify_page"
    })
  });

  if (serialOnlyCheck.status !== "valid" || !serialOnlyCheck.matchedPart?.id) {
    throw new Error("Expected serial-only verification to detect the matching registered product");
  }

  const mismatchCheck = await request("/verification/check", {
    method: "POST",
    headers: userHeaders,
    body: JSON.stringify({
      partSlug: validPart.slug,
      serialNumber: mismatchPart.serialNumber,
      requestSource: "verify_page"
    })
  });

  if (mismatchCheck.status !== "suspicious") {
    throw new Error("Expected a suspicious mismatch result when verifying a Toyota serial against the MG battery");
  }

  const createdReport = await request("/verification/reports", {
    method: "POST",
    headers: userHeaders,
    body: JSON.stringify({
      partSlug: validPart.slug,
      serialNumber: uniqueSerial,
      sellerName: "Al-Mansour Automotive",
      reportStatus: "suspicious",
      note: "Smoke test report for phase 6 to confirm the real verification reporting workflow."
    })
  });

  const history = await request("/verification/history", {
    headers: userHeaders
  });

  const historyHasReport = (history.reports || []).some((report) => Number(report.id) === Number(createdReport.report?.id));
  if (!historyHasReport) {
    throw new Error("The created verification report was not returned in the user history");
  }

  const adminLogin = await login("admin@autofix.com", "Admin@123");
  const adminHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminLogin.token}`
  };

  const reviewQueue = await request("/verification/reports/review", {
    headers: adminHeaders
  });

  const queuedReport = (reviewQueue.reports || []).find((report) => Number(report.id) === Number(createdReport.report?.id));
  if (!queuedReport) {
    throw new Error("Admin review queue did not return the created verification report");
  }

  const reviewed = await request(`/verification/reports/${createdReport.report.id}/review`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({
      actionStatus: "resolved",
      resolutionNote: "Phase 6 smoke test resolved the report successfully."
    })
  });

  if (reviewed.report?.actionStatus !== "resolved") {
    throw new Error("Verification review did not update the report status to resolved");
  }

  console.log("Phase 6 smoke test passed.");
  console.log(JSON.stringify({
    validStatus: validCheck.status,
    serialOnlyStatus: serialOnlyCheck.status,
    serialOnlyMatchedPart: serialOnlyCheck.matchedPart?.slug,
    mismatchStatus: mismatchCheck.status,
    createdReportId: createdReport.report?.id,
    reviewStatus: reviewed.report?.actionStatus,
    historyChecks: history.checks?.length || 0,
    historyReports: history.reports?.length || 0
  }, null, 2));
}

main().catch((error) => {
  console.error("Phase 6 smoke test failed.");
  console.error(error.message);
  process.exit(1);
});
