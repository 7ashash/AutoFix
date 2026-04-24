import { Router } from "express";
import { query } from "../config/database.js";
import { attachOptionalAuth, requireAuth } from "../middleware/authenticate.js";
import { getBrandPresentation, getDealerPresentation } from "../lib/catalog-data.js";

const router = Router();

const PUBLIC_RESULT_STATUSES = new Set(["valid", "unverified", "suspicious"]);
const REPORT_STATUSES = new Set(["unverified", "suspicious"]);
const REVIEW_STATUSES = new Set(["open", "reviewing", "resolved", "dismissed"]);

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeSerial(serialNumber) {
  return String(serialNumber || "").trim().toUpperCase();
}

function normalizeSource(source) {
  const normalized = String(source || "").trim().toLowerCase();
  if (["verify_page", "product_page", "api"].includes(normalized)) {
    return normalized;
  }
  return "verify_page";
}

function capitalize(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function looksLikeKnownSerialFormat(serialNumber) {
  return /^[A-Z0-9]{2,}(?:-[A-Z0-9]{2,}){1,5}$/.test(serialNumber);
}

function mapPartSummary(row) {
  if (!row?.partId) {
    return null;
  }

  return {
    id: Number(row.partId),
    slug: row.partSlug,
    name: row.partName,
    image: row.imageUrl || "./pictures/autofix logo.png",
    type: row.partType === "original" ? "Original" : "Aftermarket",
    price: Number(row.price || 0),
    rating: Number(row.rating || 0),
    partNumber: row.partNumber,
    serialNumber: row.serialNumber,
    dealer: row.dealerId
      ? {
        id: Number(row.dealerId),
        name: row.dealerName,
        slug: row.dealerSlug,
        image: getDealerPresentation(row.dealerSlug).image
      }
      : null,
    brand: row.brandId
      ? {
        id: Number(row.brandId),
        key: row.brandKey,
        name: row.brandName,
        logo: getBrandPresentation(row.brandKey).logo
      }
      : null
  };
}

async function resolvePartReference({ partId = null, partSlug = "" } = {}) {
  const normalizedId = Number(partId || 0);
  const normalizedSlug = String(partSlug || "").trim();

  if (!normalizedId && !normalizedSlug) {
    return null;
  }

  const rows = await query(
    `
      SELECT
        p.id AS partId,
        p.slug AS partSlug,
        p.name AS partName,
        p.part_type AS partType,
        p.price,
        p.rating,
        p.part_number AS partNumber,
        p.image_url AS imageUrl,
        p.serial_number AS serialNumber,
        d.id AS dealerId,
        d.name AS dealerName,
        d.slug AS dealerSlug,
        b.id AS brandId,
        b.brand_key AS brandKey,
        b.name AS brandName
      FROM parts p
      INNER JOIN dealers d
        ON d.id = p.dealer_id
      INNER JOIN brands b
        ON b.id = p.brand_id
      WHERE p.active = 1
        AND (
          (:partId > 0 AND p.id = :partId)
          OR (:partSlug <> '' AND p.slug = :partSlug)
        )
      LIMIT 1
    `,
    {
      partId: normalizedId,
      partSlug: normalizedSlug
    }
  );

  return rows[0] || null;
}

async function resolveRegistryBySerial(serialNumber) {
  const rows = await query(
    `
      SELECT
        sr.id AS registryId,
        sr.serial_number AS serialNumber,
        sr.registry_status AS registryStatus,
        sr.seller_name AS sellerName,
        sr.notes AS registryNotes,
        p.id AS partId,
        p.slug AS partSlug,
        p.name AS partName,
        p.part_type AS partType,
        p.price,
        p.rating,
        p.part_number AS partNumber,
        p.image_url AS imageUrl,
        d.id AS dealerId,
        d.name AS dealerName,
        d.slug AS dealerSlug,
        b.id AS brandId,
        b.brand_key AS brandKey,
        b.name AS brandName
      FROM serial_registry sr
      INNER JOIN parts p
        ON p.id = sr.part_id
      INNER JOIN dealers d
        ON d.id = sr.dealer_id
      INNER JOIN brands b
        ON b.id = p.brand_id
      WHERE UPPER(sr.serial_number) = :serialNumber
      LIMIT 1
    `,
    { serialNumber }
  );

  if (rows[0]) {
    return rows[0];
  }

  const partRows = await query(
    `
      SELECT
        NULL AS registryId,
        p.serial_number AS serialNumber,
        'valid' AS registryStatus,
        d.name AS sellerName,
        'Matched from the live product serial index.' AS registryNotes,
        p.id AS partId,
        p.slug AS partSlug,
        p.name AS partName,
        p.part_type AS partType,
        p.price,
        p.rating,
        p.part_number AS partNumber,
        p.image_url AS imageUrl,
        d.id AS dealerId,
        d.name AS dealerName,
        d.slug AS dealerSlug,
        b.id AS brandId,
        b.brand_key AS brandKey,
        b.name AS brandName
      FROM parts p
      INNER JOIN dealers d
        ON d.id = p.dealer_id
      INNER JOIN brands b
        ON b.id = p.brand_id
      WHERE p.serial_number IS NOT NULL
        AND UPPER(p.serial_number) = :serialNumber
      LIMIT 1
    `,
    { serialNumber }
  );

  return partRows[0] || null;
}

function buildVerificationDecision({ serialNumber, selectedPart, registryMatch }) {
  if (registryMatch && selectedPart && Number(registryMatch.partId) !== Number(selectedPart.partId)) {
    return {
      status: "suspicious",
      title: "Serial mismatch",
      registryMessage: `This serial is registered to ${registryMatch.partName}, not the selected part.`,
      recommendation: "Do not complete the purchase before the seller is reviewed and the part is physically inspected."
    };
  }

  if (registryMatch) {
    if (registryMatch.registryStatus === "valid") {
      return {
        status: "valid",
        title: "Valid",
        registryMessage: "Matched in the official dealer registry.",
        recommendation: "Keep the invoice, save the serial, and continue through the trusted AutoFix checkout flow."
      };
    }

    if (registryMatch.registryStatus === "unverified") {
      return {
        status: "unverified",
        title: "Unverified",
        registryMessage: "The serial exists, but it is still waiting for dealer-side validation.",
        recommendation: "Ask the seller for invoice proof and compare the packaging details before purchase."
      };
    }

    return {
      status: "suspicious",
      title: "Suspicious",
      registryMessage: "The serial exists in the registry, but the item is flagged for further review.",
      recommendation: "Pause the purchase and report the listing so the verification team can review it."
    };
  }

  if (looksLikeKnownSerialFormat(serialNumber)) {
    return {
      status: "unverified",
      title: "Unverified serial",
      registryMessage: "The serial format is acceptable, but it was not found in the official registry snapshot.",
      recommendation: "Request invoice proof, compare packaging, and only buy from the official dealer page."
    };
  }

  return {
    status: "suspicious",
    title: "Suspicious serial",
    registryMessage: "The serial format looks unusual and it was not matched to the official registry.",
    recommendation: "Do not proceed before the seller and packaging are reviewed by AutoFix support."
  };
}

async function insertVerificationCheck({
  userId = null,
  partId = null,
  dealerId = null,
  matchedRegistryId = null,
  serialNumber,
  resultStatus,
  requestSource,
  recommendation
}) {
  const result = await query(
    `
      INSERT INTO verification_checks (
        user_id,
        part_id,
        dealer_id,
        matched_registry_id,
        serial_number,
        result_status,
        request_source,
        recommendation
      )
      VALUES (
        :userId,
        :partId,
        :dealerId,
        :matchedRegistryId,
        :serialNumber,
        :resultStatus,
        :requestSource,
        :recommendation
      )
    `,
    {
      userId,
      partId,
      dealerId,
      matchedRegistryId,
      serialNumber,
      resultStatus,
      requestSource,
      recommendation
    }
  );

  return Number(result.insertId);
}

function assertVerificationReviewer(user) {
  const allowed = Boolean(
    user?.dashboardAccess?.admin
      || (user?.dashboardAccess?.dealer && user?.permissionScope?.includes("verification"))
  );

  if (!allowed) {
    throw createError("Verification review access is not available for this account", 403);
  }
}

function buildScopedFilter(user, params) {
  if (user.dashboardAccess?.admin) {
    return "";
  }

  const dealerIds = (user.dealerAssignments || []).map((assignment) => Number(assignment.dealerId)).filter(Boolean);
  const brandKeys = (user.allowedBrandKeys || []).map((key) => String(key).trim().toLowerCase()).filter(Boolean);

  if (!dealerIds.length || !brandKeys.length) {
    return " AND 1 = 0 ";
  }

  const dealerTokens = dealerIds.map((value, index) => {
    const key = `dealerScope${index}`;
    params[key] = value;
    return `:${key}`;
  });

  const brandTokens = brandKeys.map((value, index) => {
    const key = `brandScope${index}`;
    params[key] = value;
    return `:${key}`;
  });

  return `
    AND COALESCE(vr.dealer_id, p.dealer_id) IN (${dealerTokens.join(", ")})
    AND b.brand_key IN (${brandTokens.join(", ")})
  `;
}

function mapReviewReport(row) {
  return {
    id: Number(row.id),
    serialNumber: row.serialNumber,
    reportStatus: row.reportStatus,
    actionStatus: row.actionStatus,
    note: row.note || "",
    sellerName: row.sellerName || row.dealerName || "",
    resolutionNote: row.resolutionNote || "",
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
    reporter: row.reporterId
      ? {
        id: Number(row.reporterId),
        fullName: row.reporterName,
        email: row.reporterEmail
      }
      : null,
    reviewedBy: row.reviewedById
      ? {
        id: Number(row.reviewedById),
        fullName: row.reviewedByName
      }
      : null,
    dealer: row.dealerId
      ? {
        id: Number(row.dealerId),
        name: row.dealerName,
        slug: row.dealerSlug,
        image: getDealerPresentation(row.dealerSlug).image
      }
      : null,
    part: row.partId
      ? {
        id: Number(row.partId),
        slug: row.partSlug,
        name: row.partName,
        image: row.imageUrl || "./pictures/autofix logo.png",
        type: row.partType === "original" ? "Original" : "Aftermarket"
      }
      : null,
    brand: row.brandId
      ? {
        id: Number(row.brandId),
        key: row.brandKey,
        name: row.brandName,
        logo: getBrandPresentation(row.brandKey).logo
      }
      : null
  };
}

async function loadVerificationHistory(userId) {
  const [checkRows, reportRows] = await Promise.all([
    query(
      `
        SELECT
          vc.id,
          vc.serial_number AS serialNumber,
          vc.result_status AS resultStatus,
          vc.request_source AS requestSource,
          vc.recommendation,
          vc.created_at AS createdAt,
          p.id AS partId,
          p.slug AS partSlug,
          p.name AS partName,
          p.part_type AS partType,
          p.image_url AS imageUrl,
          d.id AS dealerId,
          d.name AS dealerName,
          d.slug AS dealerSlug
        FROM verification_checks vc
        LEFT JOIN parts p
          ON p.id = vc.part_id
        LEFT JOIN dealers d
          ON d.id = vc.dealer_id
        WHERE vc.user_id = :userId
        ORDER BY vc.created_at DESC, vc.id DESC
        LIMIT 8
      `,
      { userId }
    ),
    query(
      `
        SELECT
          vr.id,
          vr.serial_number AS serialNumber,
          vr.report_status AS reportStatus,
          vr.action_status AS actionStatus,
          vr.seller_name AS sellerName,
          vr.note,
          vr.resolution_note AS resolutionNote,
          vr.created_at AS createdAt,
          vr.reviewed_at AS reviewedAt,
          p.id AS partId,
          p.slug AS partSlug,
          p.name AS partName,
          p.part_type AS partType,
          p.image_url AS imageUrl,
          d.id AS dealerId,
          d.name AS dealerName,
          d.slug AS dealerSlug,
          b.id AS brandId,
          b.brand_key AS brandKey,
          b.name AS brandName
        FROM verification_reports vr
        LEFT JOIN parts p
          ON p.id = vr.part_id
        LEFT JOIN dealers d
          ON d.id = COALESCE(vr.dealer_id, p.dealer_id)
        LEFT JOIN brands b
          ON b.id = p.brand_id
        WHERE vr.user_id = :userId
        ORDER BY vr.created_at DESC, vr.id DESC
        LIMIT 8
      `,
      { userId }
    )
  ]);

  return {
    checks: checkRows.map((row) => ({
      id: Number(row.id),
      serialNumber: row.serialNumber,
      resultStatus: row.resultStatus,
      requestSource: row.requestSource,
      recommendation: row.recommendation,
      createdAt: row.createdAt,
      part: row.partId
        ? {
          id: Number(row.partId),
          slug: row.partSlug,
          name: row.partName,
          image: row.imageUrl || "./pictures/autofix logo.png",
          type: row.partType === "original" ? "Original" : "Aftermarket"
        }
        : null,
      dealer: row.dealerId
        ? {
          id: Number(row.dealerId),
          name: row.dealerName,
          slug: row.dealerSlug,
          image: getDealerPresentation(row.dealerSlug).image
        }
        : null
    })),
    reports: reportRows.map((row) => ({
      id: Number(row.id),
      serialNumber: row.serialNumber,
      reportStatus: row.reportStatus,
      actionStatus: row.actionStatus,
      sellerName: row.sellerName || row.dealerName || "",
      note: row.note || "",
      resolutionNote: row.resolutionNote || "",
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt,
      part: row.partId
        ? {
          id: Number(row.partId),
          slug: row.partSlug,
          name: row.partName,
          image: row.imageUrl || "./pictures/autofix logo.png",
          type: row.partType === "original" ? "Original" : "Aftermarket"
        }
        : null,
      dealer: row.dealerId
        ? {
          id: Number(row.dealerId),
          name: row.dealerName,
          slug: row.dealerSlug,
          image: getDealerPresentation(row.dealerSlug).image
        }
        : null,
      brand: row.brandId
        ? {
          id: Number(row.brandId),
          key: row.brandKey,
          name: row.brandName,
          logo: getBrandPresentation(row.brandKey).logo
        }
        : null
    }))
  };
}

router.post("/check", attachOptionalAuth, async (req, res, next) => {
  try {
    const serialNumber = normalizeSerial(req.body?.serialNumber);
    const requestSource = normalizeSource(req.body?.requestSource);

    if (!serialNumber) {
      throw createError("Serial number is required");
    }

    const selectedPartRow = await resolvePartReference({
      partId: req.body?.partId,
      partSlug: req.body?.partSlug
    });

    if ((req.body?.partId || req.body?.partSlug) && !selectedPartRow) {
      throw createError("Selected part was not found", 404);
    }

    const registryMatch = await resolveRegistryBySerial(serialNumber);
    const decision = buildVerificationDecision({
      serialNumber,
      selectedPart: selectedPartRow,
      registryMatch
    });

    if (!PUBLIC_RESULT_STATUSES.has(decision.status)) {
      throw createError("Verification status is invalid", 500);
    }

    const checkId = await insertVerificationCheck({
      userId: req.auth?.user?.id || null,
      partId: selectedPartRow?.partId ? Number(selectedPartRow.partId) : registryMatch?.partId ? Number(registryMatch.partId) : null,
      dealerId: registryMatch?.dealerId ? Number(registryMatch.dealerId) : selectedPartRow?.dealerId ? Number(selectedPartRow.dealerId) : null,
      matchedRegistryId: registryMatch?.registryId ? Number(registryMatch.registryId) : null,
      serialNumber,
      resultStatus: decision.status,
      requestSource,
      recommendation: decision.recommendation
    });

    res.json({
      success: true,
      data: {
        checkId,
        status: decision.status,
        title: decision.title,
        registryMessage: decision.registryMessage,
        recommendation: decision.recommendation,
        serialNumber,
        selectedPart: mapPartSummary(selectedPartRow),
        matchedPart: mapPartSummary(registryMatch),
        sellerName: registryMatch?.sellerName || registryMatch?.dealerName || selectedPartRow?.dealerName || "",
        dealer: registryMatch?.dealerId
          ? {
            id: Number(registryMatch.dealerId),
            name: registryMatch.dealerName,
            slug: registryMatch.dealerSlug,
            image: getDealerPresentation(registryMatch.dealerSlug).image
          }
          : selectedPartRow?.dealerId
            ? {
              id: Number(selectedPartRow.dealerId),
              name: selectedPartRow.dealerName,
              slug: selectedPartRow.dealerSlug,
              image: getDealerPresentation(selectedPartRow.dealerSlug).image
            }
            : null
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/history", requireAuth, async (req, res, next) => {
  try {
    const history = await loadVerificationHistory(req.auth.user.id);
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
});

router.post("/reports", requireAuth, async (req, res, next) => {
  try {
    const serialNumber = normalizeSerial(req.body?.serialNumber);
    const reportStatus = String(req.body?.reportStatus || "").trim().toLowerCase();
    const note = String(req.body?.note || req.body?.reason || "").trim();
    const sellerNameInput = String(req.body?.sellerName || "").trim();

    if (!serialNumber) {
      throw createError("Serial number is required");
    }

    if (!REPORT_STATUSES.has(reportStatus)) {
      throw createError("Choose a valid report type");
    }

    if (note.length < 12) {
      throw createError("Please explain why you are reporting this item");
    }

    const selectedPartRow = await resolvePartReference({
      partId: req.body?.partId,
      partSlug: req.body?.partSlug
    });
    const registryMatch = await resolveRegistryBySerial(serialNumber);

    const partId = selectedPartRow?.partId ? Number(selectedPartRow.partId) : registryMatch?.partId ? Number(registryMatch.partId) : null;
    const dealerId = selectedPartRow?.dealerId ? Number(selectedPartRow.dealerId) : registryMatch?.dealerId ? Number(registryMatch.dealerId) : null;
    const sellerName = sellerNameInput || registryMatch?.sellerName || registryMatch?.dealerName || selectedPartRow?.dealerName || null;

    const openRows = await query(
      `
        SELECT id
        FROM verification_reports
        WHERE user_id = :userId
          AND serial_number = :serialNumber
          AND report_status = :reportStatus
          AND action_status IN ('open', 'reviewing')
        LIMIT 1
      `,
      {
        userId: req.auth.user.id,
        serialNumber,
        reportStatus
      }
    );

    if (openRows[0]) {
      throw createError("You already have an active report for this serial", 409);
    }

    const result = await query(
      `
        INSERT INTO verification_reports (
          user_id,
          part_id,
          dealer_id,
          serial_number,
          seller_name,
          report_status,
          note,
          action_status
        )
        VALUES (
          :userId,
          :partId,
          :dealerId,
          :serialNumber,
          :sellerName,
          :reportStatus,
          :note,
          'open'
        )
      `,
      {
        userId: req.auth.user.id,
        partId,
        dealerId,
        serialNumber,
        sellerName,
        reportStatus,
        note
      }
    );

    res.status(201).json({
      success: true,
      data: {
        report: {
          id: Number(result.insertId),
          serialNumber,
          reportStatus,
          actionStatus: "open",
          sellerName: sellerName || "",
          note,
          part: mapPartSummary(selectedPartRow || registryMatch),
          dealer: dealerId
            ? {
              id: dealerId,
              name: registryMatch?.dealerName || selectedPartRow?.dealerName || "",
              slug: registryMatch?.dealerSlug || selectedPartRow?.dealerSlug || "",
              image: getDealerPresentation(registryMatch?.dealerSlug || selectedPartRow?.dealerSlug || "").image
            }
            : null
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/reports/review", requireAuth, async (req, res, next) => {
  try {
    assertVerificationReviewer(req.auth.user);

    const params = {
      actionStatus: String(req.query?.actionStatus || "").trim().toLowerCase()
    };

    const reviewStatusClause = REVIEW_STATUSES.has(params.actionStatus)
      ? " AND vr.action_status = :actionStatus "
      : " AND vr.action_status IN ('open', 'reviewing') ";

    const scopeClause = buildScopedFilter(req.auth.user, params);

    const rows = await query(
      `
        SELECT
          vr.id,
          vr.serial_number AS serialNumber,
          vr.report_status AS reportStatus,
          vr.action_status AS actionStatus,
          vr.seller_name AS sellerName,
          vr.note,
          vr.resolution_note AS resolutionNote,
          vr.created_at AS createdAt,
          vr.reviewed_at AS reviewedAt,
          reporter.id AS reporterId,
          reporter.full_name AS reporterName,
          reporter.email AS reporterEmail,
          reviewer.id AS reviewedById,
          reviewer.full_name AS reviewedByName,
          p.id AS partId,
          p.slug AS partSlug,
          p.name AS partName,
          p.part_type AS partType,
          p.image_url AS imageUrl,
          d.id AS dealerId,
          d.name AS dealerName,
          d.slug AS dealerSlug,
          b.id AS brandId,
          b.brand_key AS brandKey,
          b.name AS brandName
        FROM verification_reports vr
        LEFT JOIN users reporter
          ON reporter.id = vr.user_id
        LEFT JOIN users reviewer
          ON reviewer.id = vr.reviewed_by
        LEFT JOIN parts p
          ON p.id = vr.part_id
        LEFT JOIN dealers d
          ON d.id = COALESCE(vr.dealer_id, p.dealer_id)
        LEFT JOIN brands b
          ON b.id = p.brand_id
        WHERE 1 = 1
          ${reviewStatusClause}
          ${scopeClause}
        ORDER BY vr.created_at DESC, vr.id DESC
        LIMIT 40
      `,
      params
    );

    res.json({
      success: true,
      data: {
        reports: rows.map(mapReviewReport)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/reports/:reportId/review", requireAuth, async (req, res, next) => {
  try {
    assertVerificationReviewer(req.auth.user);

    const reportId = Number(req.params.reportId || 0);
    const actionStatus = String(req.body?.actionStatus || "").trim().toLowerCase();
    const resolutionNote = String(req.body?.resolutionNote || "").trim();

    if (!reportId) {
      throw createError("Report was not found", 404);
    }

    if (!REVIEW_STATUSES.has(actionStatus)) {
      throw createError("Choose a valid review status");
    }

    if (["resolved", "dismissed"].includes(actionStatus) && resolutionNote.length < 10) {
      throw createError("Add a clear resolution note before closing this report");
    }

    const params = {
      reportId
    };
    const scopeClause = buildScopedFilter(req.auth.user, params);

    const rows = await query(
      `
        SELECT vr.id
        FROM verification_reports vr
        LEFT JOIN parts p
          ON p.id = vr.part_id
        LEFT JOIN brands b
          ON b.id = p.brand_id
        WHERE vr.id = :reportId
          ${scopeClause}
        LIMIT 1
      `,
      params
    );

    if (!rows[0]) {
      throw createError("Report was not found", 404);
    }

    await query(
      `
        UPDATE verification_reports
        SET action_status = :actionStatus,
            reviewed_by = :reviewedBy,
            reviewed_at = CURRENT_TIMESTAMP,
            resolution_note = :resolutionNote
        WHERE id = :reportId
      `,
      {
        reportId,
        actionStatus,
        reviewedBy: req.auth.user.id,
        resolutionNote: resolutionNote || null
      }
    );

    const refreshed = await query(
      `
        SELECT
          vr.id,
          vr.serial_number AS serialNumber,
          vr.report_status AS reportStatus,
          vr.action_status AS actionStatus,
          vr.seller_name AS sellerName,
          vr.note,
          vr.resolution_note AS resolutionNote,
          vr.created_at AS createdAt,
          vr.reviewed_at AS reviewedAt,
          reporter.id AS reporterId,
          reporter.full_name AS reporterName,
          reporter.email AS reporterEmail,
          reviewer.id AS reviewedById,
          reviewer.full_name AS reviewedByName,
          p.id AS partId,
          p.slug AS partSlug,
          p.name AS partName,
          p.part_type AS partType,
          p.image_url AS imageUrl,
          d.id AS dealerId,
          d.name AS dealerName,
          d.slug AS dealerSlug,
          b.id AS brandId,
          b.brand_key AS brandKey,
          b.name AS brandName
        FROM verification_reports vr
        LEFT JOIN users reporter
          ON reporter.id = vr.user_id
        LEFT JOIN users reviewer
          ON reviewer.id = vr.reviewed_by
        LEFT JOIN parts p
          ON p.id = vr.part_id
        LEFT JOIN dealers d
          ON d.id = COALESCE(vr.dealer_id, p.dealer_id)
        LEFT JOIN brands b
          ON b.id = p.brand_id
        WHERE vr.id = :reportId
        LIMIT 1
      `,
      { reportId }
    );

    res.json({
      success: true,
      data: {
        report: mapReviewReport(refreshed[0])
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
