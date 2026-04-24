export const ASSISTANT_LOCALES = {
  en: {
    key: "en",
    label: "English",
    greeting: "Hi, I'm the AutoFix assistant.",
    modeLabels: {
      parts_search: "Parts search",
      fault_diagnosis: "Fault diagnosis"
    }
  },
  "ar-eg": {
    key: "ar-eg",
    label: "مصري",
    greeting: "أهلاً، أنا مساعد أوتوفكس.",
    modeLabels: {
      parts_search: "بحث عن قطعة",
      fault_diagnosis: "تشخيص عطل"
    }
  }
};

export function normalizeAssistantLocale(locale) {
  const normalized = String(locale || "").trim().toLowerCase();
  if (["ar", "ar-eg", "arabic", "masri", "egyptian"].includes(normalized)) {
    return "ar-eg";
  }
  return "en";
}

export function normalizeAssistantMode(mode) {
  const normalized = String(mode || "").trim().toLowerCase();
  if (normalized === "fault_diagnosis") {
    return "fault_diagnosis";
  }
  return "parts_search";
}

export function getAssistantStarterPrompts(locale) {
  if (normalizeAssistantLocale(locale) === "ar-eg") {
    return {
      parts_search: [
        "عايز بطارية لـ MG ZS 2025",
        "هاتلي تيل فرامل لتويوتا كورولا 2024",
        "ايه القطع المتوافقة مع نيسان قشقاي 2024؟"
      ],
      fault_diagnosis: [
        "العربية مش بتدور وفيه صوت تك تك",
        "فيه سخونية ودخان خفيف من الكبوت",
        "العربية فيها رعشة وصوت من قدام"
      ]
    };
  }

  return {
    parts_search: [
      "I need a battery for MG ZS 2025",
      "Find brake pads for Toyota Corolla 2024",
      "Show compatible parts for Nissan Qashqai 2024"
    ],
    fault_diagnosis: [
      "The car will not start and I hear clicking",
      "The engine is overheating and I smell coolant",
      "The car shakes and I hear front suspension noise"
    ]
  };
}

export function buildAssistantInstructions({ locale, mode }) {
  const normalizedLocale = normalizeAssistantLocale(locale);
  const normalizedMode = normalizeAssistantMode(mode);

  const commonRules = [
    "You are AutoFix Assistant for an Egyptian vehicle-first spare-parts marketplace.",
    "AutoFix connects drivers, official dealer networks, part listings, authenticity verification, and preliminary car diagnosis.",
    "Be practical, clear, and short enough for a real website chat drawer.",
    "Do not use markdown, bold markers, heading markers, asterisks, or decorative formatting.",
    "Write clean plain text only.",
    "Keep the answer visually tight: short paragraphs and single line breaks only when actually needed.",
    "Never invent parts, fitment, or dealer coverage beyond the grounded data you receive.",
    "For parts search, if the user gives the part name plus brand, model, and year, treat that as enough to search the AutoFix catalog directly.",
    "Do not ask for VIN, chassis number, trim level, exact sub-variant, or serial number for a normal parts search unless the grounded catalog data explicitly requires a clarification and there is no safe direct result.",
    "If the user does not provide enough vehicle data to confirm fitment, ask only for the missing brand, model, and/or year instead of pretending compatibility is confirmed.",
    "If you mention diagnosis, always frame it as preliminary guidance and not a final mechanical verdict.",
    "If the situation sounds unsafe, advise the user to stop driving and seek urgent inspection or towing.",
    "If relevant, remind the user that AutoFix can verify authenticity by serial number before purchase."
  ];

  const localeRules = normalizedLocale === "ar-eg"
    ? [
      "Reply only in Egyptian colloquial Arabic.",
      "Use natural Egyptian wording, simple and direct, not Modern Standard Arabic unless needed for clarity.",
      "Keep the tone helpful, calm, and practical."
    ]
    : [
      "Reply only in English.",
      "Use a helpful, concise website-assistant tone."
    ];

  const modeRules = normalizedMode === "fault_diagnosis"
    ? [
      "Your primary job is to help with preliminary car fault diagnosis.",
      "Summarize the likely issue, severity level, and next action.",
      "When grounded fitment-ready parts are available and directly relevant, mention them as possible next steps, but never over-claim that replacing the part will definitely solve the issue."
    ]
    : [
      "Your primary job is to help the user find compatible spare parts.",
      "Focus on fitment, original vs aftermarket clarity, dealer source, and serial verification guidance.",
      "If the user asks broadly what is available for a vehicle, summarize the available categories first, then highlight the most relevant matched parts.",
      "If grounded data already includes brand, model, year, and matched parts, do not ask for VIN, chassis number, trim, or sub-variant.",
      "If grounded data already contains matched parts, speak confidently about what is available in the AutoFix catalog and point the user to the matched options."
    ];

  return [...commonRules, ...localeRules, ...modeRules].join("\n");
}
