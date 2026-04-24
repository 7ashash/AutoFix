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
  const guestBootstrap = await request("/assistant/bootstrap");
  if (!guestBootstrap.locales?.length) {
    throw new Error("Assistant bootstrap did not return locales");
  }

  const userLogin = await login("user@autofix.com", "User@123");
  const userHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${userLogin.token}`
  };

  const partsSearch = await request("/assistant/chat", {
    method: "POST",
    headers: userHeaders,
    body: JSON.stringify({
      locale: "en",
      mode: "parts_search",
      message: "I need a battery for MG ZS 2025",
      context: {
        brandKey: "mg",
        modelKey: "mg-zs",
        modelName: "MG ZS",
        year: 2025,
        page: "product"
      }
    })
  });

  if (!partsSearch.reply || !partsSearch.data?.parts?.length) {
    throw new Error("Assistant parts search did not return a grounded reply with parts");
  }

  const arabicPartsSearch = await request("/assistant/chat", {
    method: "POST",
    headers: userHeaders,
    body: JSON.stringify({
      locale: "ar-eg",
      mode: "parts_search",
      message: "تيل فرامل تويوتا كورولا 2020",
      context: {
        page: "index"
      }
    })
  });

  if (!arabicPartsSearch.reply || !arabicPartsSearch.data?.parts?.length) {
    throw new Error("Assistant Arabic parts search did not return a grounded reply with parts");
  }

  const diagnosis = await request("/assistant/chat", {
    method: "POST",
    headers: userHeaders,
    body: JSON.stringify({
      locale: "ar-eg",
      mode: "fault_diagnosis",
      message: "العربية مش بتدور وفيه صوت تك تك",
      context: {
        brandKey: "mg",
        modelKey: "mg-zs",
        modelName: "MG ZS",
        year: 2025,
        page: "index"
      }
    })
  });

  if (!diagnosis.reply || !diagnosis.data?.likelyIssues?.length) {
    throw new Error("Assistant diagnosis did not return a grounded reply");
  }

  const history = await request("/assistant/history?mode=parts_search&locale=en", {
    headers: {
      Authorization: `Bearer ${userLogin.token}`
    }
  });

  if (!history.length) {
    throw new Error("Assistant history did not return any persisted logs");
  }

  console.log("Phase 7 smoke test passed.");
  console.log(JSON.stringify({
    guestLiveModel: guestBootstrap.liveModel,
    partsReplyProvider: partsSearch.provider,
    partsReturned: partsSearch.data?.parts?.length || 0,
    arabicPartsReturned: arabicPartsSearch.data?.parts?.length || 0,
    diagnosisAction: diagnosis.suggestedAction,
    historyCount: history.length
  }, null, 2));
}

main().catch((error) => {
  console.error("Phase 7 smoke test failed.");
  console.error(error.message);
  process.exit(1);
});
