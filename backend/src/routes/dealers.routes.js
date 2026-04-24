import { Router } from "express";
import { getPool, withTransaction } from "../config/database.js";
import { requireAuth } from "../middleware/authenticate.js";
import { requireDealerOrAdmin } from "../middleware/authorize.js";
import { buildUserAccessProfileById } from "../lib/auth-profile.js";
import { getBrandPresentation, getDealerPresentation, getModelPresentation } from "../lib/catalog-data.js";

const router = Router();

const LOW_STOCK_THRESHOLD = 5;
const ORDER_EDITABLE_STATUSES = new Set(["new", "pending", "confirmed", "preparing"]);
const ORDER_ITEM_STATUSES = new Set(["new", "pending", "preparing", "shipped", "delivered", "completed", "cancelled"]);
const ORDER_PARENT_STATUSES = new Set(["pending", "confirmed", "preparing", "shipped", "delivered", "completed", "cancelled"]);
const OFFER_SCOPE_TYPES = new Set(["part", "category"]);
const DISCOUNT_TYPES = new Set(["percentage", "fixed"]);
const MOVEMENT_TYPES = new Set(["manual_adjustment", "import", "sale", "restock", "correction"]);
const SUPPORT_PRIORITIES = new Set(["low", "normal", "high"]);
const SUPPORT_STATUSES = new Set(["open", "in_progress", "resolved"]);

const FULL_DEALER_PERMISSIONS = {
  inventory: true,
  orders: true,
  verification: true,
  analytics: true,
  discounts: true,
  customers: true,
  notifications: true,
  shipping: true,
  staff: true,
  support: true,
  profile: true
};

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function toNumber(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function normalizeText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === 1 || value === "1" || value === "true") {
    return true;
  }
  if (value === 0 || value === "0" || value === "false") {
    return false;
  }
  return fallback;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function toPermissions(permissionScope = []) {
  const scope = new Set(permissionScope || []);
  return {
    inventory: scope.has("inventory"),
    orders: scope.has("orders"),
    verification: scope.has("verification"),
    analytics: scope.has("analytics"),
    discounts: scope.has("inventory") || scope.has("analytics"),
    customers: scope.has("orders"),
    notifications: scope.has("orders") || scope.has("analytics"),
    shipping: scope.has("orders"),
    staff: scope.has("inventory"),
    support: true,
    profile: true
  };
}

function parseJson(value, fallback = {}) {
  if (!value) {
    return fallback;
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeTechnicalSpecs(input) {
  if (!input) {
    return {};
  }

  if (typeof input === "object" && !Array.isArray(input)) {
    return input;
  }

  const text = normalizeText(input);
  if (!text) {
    return {};
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { notes: text };
  }

  const result = {};
  lines.forEach((line, index) => {
    const [rawKey, ...rawValue] = line.split(":");
    if (rawValue.length) {
      result[slugify(rawKey) || `spec-${index + 1}`] = rawValue.join(":").trim();
    } else {
      result[`spec-${index + 1}`] = rawKey.trim();
    }
  });
  return result;
}

function normalizeImageUrls(input) {
  if (!input) {
    return [];
  }

  const urls = Array.isArray(input)
    ? input
    : String(input)
      .split(/\r?\n|,/)
      .map((item) => item.trim());

  return uniqueBy(
    urls.filter(Boolean).map((url) => url.slice(0, 500)),
    (url) => url.toLowerCase()
  );
}

function normalizeFitments(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return uniqueBy(
    input
      .map((item) => ({
        modelKey: normalizeText(item?.modelKey).toLowerCase(),
        year: toNumber(item?.year, 0)
      }))
      .filter((item) => item.modelKey && item.year),
    (item) => `${item.modelKey}:${item.year}`
  );
}

function buildSerialNumber({ brandKey, modelKey, year, partNumber }) {
  const normalizedBrand = normalizeText(brandKey).slice(0, 3).toUpperCase() || "AFX";
  const normalizedModel = normalizeText(modelKey).replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || "PART";
  const normalizedYear = String(year || "").slice(-2) || "00";
  const normalizedPart = normalizeText(partNumber).replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase() || "0000";
  const token = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SN-${normalizedBrand}-${normalizedModel}-${normalizedYear}-${normalizedPart}${token}`;
}

async function executeRows(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

function buildInClause(values = []) {
  const normalized = values.map((value) => Number(value)).filter((value) => value > 0);
  if (!normalized.length) {
    return {
      clause: "(0)",
      values: []
    };
  }

  return {
    clause: `(${normalized.map(() => "?").join(", ")})`,
    values: normalized
  };
}

function mapPublicDealerRows(rows) {
  const byDealer = new Map();

  rows.forEach((row) => {
    const dealerId = Number(row.id);
    if (!byDealer.has(dealerId)) {
      byDealer.set(dealerId, {
        id: dealerId,
        name: row.name,
        slug: row.slug,
        description: row.description,
        location: row.location,
        contactEmail: row.contactEmail,
        contactPhone: row.contactPhone,
        image: getDealerPresentation(row.slug).image,
        activeListings: Number(row.activeListings || 0),
        lowStockItems: Number(row.lowStockItems || 0),
        staffCount: Number(row.staffCount || 0),
        brands: []
      });
    }

    if (row.brandId) {
      byDealer.get(dealerId).brands.push({
        id: Number(row.brandId),
        key: row.brandKey,
        name: row.brandName,
        logo: getBrandPresentation(row.brandKey).logo
      });
    }
  });

  return Array.from(byDealer.values());
}

async function loadPublicDealers({ onlyDealerRef = null } = {}) {
  const isNumeric = /^\d+$/.test(String(onlyDealerRef || "").trim());
  const params = [];
  let whereSql = "WHERE d.is_active = 1";

  if (onlyDealerRef) {
    if (isNumeric) {
      whereSql += " AND d.id = ?";
      params.push(Number(onlyDealerRef));
    } else {
      whereSql += " AND d.slug = ?";
      params.push(String(onlyDealerRef).trim().toLowerCase());
    }
  }

  const rows = await executeRows(
    `
      SELECT
        d.id,
        d.name,
        d.slug,
        d.description,
        d.location,
        d.contact_email AS contactEmail,
        d.contact_phone AS contactPhone,
        b.id AS brandId,
        b.brand_key AS brandKey,
        b.name AS brandName,
        (
          SELECT COUNT(*)
          FROM parts p
          WHERE p.dealer_id = d.id
            AND p.active = 1
        ) AS activeListings,
        (
          SELECT COUNT(*)
          FROM parts p
          WHERE p.dealer_id = d.id
            AND p.active = 1
            AND p.stock_quantity <= ?
        ) AS lowStockItems,
        (
          SELECT COUNT(DISTINCT dba.user_id)
          FROM dealer_brand_access dba
          WHERE dba.dealer_id = d.id
            AND dba.access_status = 'active'
        ) AS staffCount
      FROM dealers d
      LEFT JOIN dealer_supported_brands dsb
        ON dsb.dealer_id = d.id
      LEFT JOIN brands b
        ON b.id = dsb.brand_id
      ${whereSql}
      ORDER BY d.name ASC, b.name ASC
    `,
    [LOW_STOCK_THRESHOLD, ...params]
  );

  return mapPublicDealerRows(rows);
}

async function loadMyDealerAccessRequest(userId) {
  const rows = await executeRows(
    `
      SELECT
        dar.id,
        dar.status,
        dar.note,
        dar.created_at AS createdAt,
        d.id AS dealerId,
        d.name AS dealerName,
        d.slug AS dealerSlug,
        b.id AS brandId,
        b.brand_key AS brandKey,
        b.name AS brandName
      FROM dealer_access_requests dar
      INNER JOIN dealers d
        ON d.id = dar.dealer_id
      LEFT JOIN dealer_access_request_brands darb
        ON darb.request_id = dar.id
      LEFT JOIN brands b
        ON b.id = darb.brand_id
      WHERE dar.user_id = ?
      ORDER BY dar.created_at DESC, b.name ASC
    `,
    [userId]
  );

  if (!rows.length) {
    return null;
  }

  const first = rows[0];
  return {
    id: Number(first.id),
    status: first.status,
    note: first.note,
    createdAt: first.createdAt,
    dealer: {
      id: Number(first.dealerId),
      name: first.dealerName,
      slug: first.dealerSlug
    },
    requestedBrands: rows
      .filter((row) => row.brandId)
      .map((row) => ({
        id: Number(row.brandId),
        key: row.brandKey,
        name: row.brandName
      }))
  };
}

function extractDealerRefFromRequest(req) {
  const candidates = [
    req.query?.dealerId,
    req.body?.dealerId,
    req.query?.dealerSlug,
    req.body?.dealerSlug
  ];

  const match = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
  return match ? String(match).trim() : "";
}

async function resolveDealerScope(req) {
  const viewer = req.auth.user;
  const publicDealers = await loadPublicDealers();
  const byId = new Map(publicDealers.map((dealer) => [dealer.id, dealer]));
  const bySlug = new Map(publicDealers.map((dealer) => [dealer.slug, dealer]));

  let accessibleDealers;

  if (viewer.dashboardAccess?.admin) {
    accessibleDealers = publicDealers.map((dealer) => ({
      ...dealer,
      permissions: { ...FULL_DEALER_PERMISSIONS },
      allowedBrandIds: dealer.brands.map((brand) => brand.id),
      allowedBrandKeys: dealer.brands.map((brand) => brand.key)
    }));
  } else {
    accessibleDealers = viewer.dealerAssignments
      .map((assignment) => {
        const matchedDealer = byId.get(Number(assignment.dealerId));
        if (!matchedDealer) {
          return null;
        }

        const scopedBrands = matchedDealer.brands.filter((brand) => assignment.allowedBrandKeys.includes(brand.key));
        if (!scopedBrands.length) {
          return null;
        }

        return {
          ...matchedDealer,
          permissions: toPermissions(assignment.permissionScope),
          allowedBrandIds: scopedBrands.map((brand) => brand.id),
          allowedBrandKeys: scopedBrands.map((brand) => brand.key),
          brands: scopedBrands
        };
      })
      .filter(Boolean);
  }

  if (!accessibleDealers.length) {
    throw createError("Dealer dashboard access is not configured for this account", 403);
  }

  const requestedDealerRef = extractDealerRefFromRequest(req);
  let activeDealer = null;

  if (requestedDealerRef) {
    activeDealer = accessibleDealers.find((dealer) => String(dealer.id) === requestedDealerRef || dealer.slug === requestedDealerRef);
    if (!activeDealer) {
      throw createError("Selected dealer is not available in this dashboard scope", 403);
    }
  }

  if (!activeDealer) {
    activeDealer = accessibleDealers[0];
  }

  return {
    viewer,
    accessibleDealers,
    activeDealer,
    dealerId: Number(activeDealer.id),
    allowedBrandIds: activeDealer.allowedBrandIds,
    allowedBrandKeys: activeDealer.allowedBrandKeys,
    permissions: activeDealer.permissions,
    dealerViewMode: viewer.dashboardAccess?.admin ? "admin-preview" : "dealer-scoped"
  };
}

function assertScopePermission(scope, key, message) {
  if (!scope.permissions?.[key] && !scope.viewer.dashboardAccess?.admin) {
    throw createError(message || "You do not have permission to perform this action", 403);
  }
}

async function loadCatalogCategories(scope) {
  const brandClause = buildInClause(scope.allowedBrandIds);
  const rows = await executeRows(
    `
      SELECT
        pc.id,
        pc.category_key AS categoryKey,
        pc.name,
        COUNT(p.id) AS listingCount
      FROM part_categories pc
      LEFT JOIN parts p
        ON p.category_id = pc.id
        AND p.dealer_id = ?
        AND p.brand_id IN ${brandClause.clause}
      GROUP BY pc.id, pc.category_key, pc.name
      ORDER BY listingCount DESC, pc.name ASC
    `,
    [scope.dealerId, ...brandClause.values]
  );

  return rows.map((row) => ({
    id: Number(row.id),
    key: row.categoryKey,
    name: row.name,
    listingCount: Number(row.listingCount || 0)
  }));
}

async function loadInventory(scope) {
  const brandClause = buildInClause(scope.allowedBrandIds);
  const rows = await executeRows(
    `
      SELECT
        p.id,
        p.name,
        p.slug,
        p.part_number AS partNumber,
        p.part_type AS partType,
        p.price,
        p.rating,
        p.stock_quantity AS stockQuantity,
        p.description,
        p.image_url AS imageUrl,
        p.serial_number AS serialNumber,
        p.active,
        p.created_at AS createdAt,
        p.updated_at AS updatedAt,
        p.manufacturer_name AS manufacturerName,
        p.warranty_months AS warrantyMonths,
        p.technical_specs AS technicalSpecs,
        p.archive_reason AS archiveReason,
        b.id AS brandId,
        b.brand_key AS brandKey,
        b.name AS brandName,
        c.id AS categoryId,
        c.category_key AS categoryKey,
        c.name AS categoryName,
        (
          SELECT COALESCE(SUM(oi.quantity), 0)
          FROM order_items oi
          WHERE oi.part_id = p.id
            AND oi.status <> 'cancelled'
        ) AS soldUnits,
        (
          SELECT GROUP_CONCAT(pi.image_url ORDER BY pi.is_primary DESC, pi.id ASC SEPARATOR '||')
          FROM part_images pi
          WHERE pi.part_id = p.id
        ) AS imageUrls
      FROM parts p
      INNER JOIN brands b
        ON b.id = p.brand_id
      LEFT JOIN part_categories c
        ON c.id = p.category_id
      WHERE p.dealer_id = ?
        AND p.brand_id IN ${brandClause.clause}
      ORDER BY p.active DESC, p.updated_at DESC, p.id DESC
    `,
    [scope.dealerId, ...brandClause.values]
  );

  const partIds = rows.map((row) => Number(row.id));
  if (!partIds.length) {
    return [];
  }

  const partClause = buildInClause(partIds);
  const fitmentRows = await executeRows(
    `
      SELECT
        pc.part_id AS partId,
        m.id AS modelId,
        m.model_key AS modelKey,
        m.name AS modelName,
        vy.id AS vehicleYearId,
        vy.year_value AS yearValue,
        vy.year_label AS yearLabel
      FROM part_compatibility pc
      INNER JOIN models m
        ON m.id = pc.model_id
      INNER JOIN vehicle_years vy
        ON vy.id = pc.vehicle_year_id
      WHERE pc.part_id IN ${partClause.clause}
      ORDER BY m.name ASC, vy.year_value ASC
    `,
    [...partClause.values]
  );

  const fitmentsByPart = new Map();
  fitmentRows.forEach((row) => {
    const partId = Number(row.partId);
    if (!fitmentsByPart.has(partId)) {
      fitmentsByPart.set(partId, []);
    }
    fitmentsByPart.get(partId).push({
      modelId: Number(row.modelId),
      modelKey: row.modelKey,
      modelName: row.modelName,
      yearId: Number(row.vehicleYearId),
      year: Number(row.yearValue),
      yearLabel: row.yearLabel,
      image: getModelPresentation(row.modelKey)?.image || "./pictures/autofix logo.png"
    });
  });

  return rows.map((row) => {
    const imageUrls = uniqueBy(
      [row.imageUrl, ...(row.imageUrls ? String(row.imageUrls).split("||") : [])].filter(Boolean),
      (url) => url.toLowerCase()
    );
    const fitments = fitmentsByPart.get(Number(row.id)) || [];

    return {
      id: Number(row.id),
      name: row.name,
      slug: row.slug,
      partNumber: row.partNumber,
      partType: row.partType,
      price: Number(row.price || 0),
      rating: Number(row.rating || 0),
      stockQuantity: Number(row.stockQuantity || 0),
      lowStock: Number(row.stockQuantity || 0) <= LOW_STOCK_THRESHOLD,
      description: row.description,
      primaryImage: imageUrls[0] || "./pictures/autofix logo.png",
      imageUrls,
      serialNumber: row.serialNumber,
      active: normalizeBoolean(row.active, true),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      manufacturerName: row.manufacturerName,
      warrantyMonths: row.warrantyMonths ? Number(row.warrantyMonths) : null,
      technicalSpecs: parseJson(row.technicalSpecs, {}),
      archiveReason: row.archiveReason,
      soldUnits: Number(row.soldUnits || 0),
      brand: {
        id: Number(row.brandId),
        key: row.brandKey,
        name: row.brandName,
        logo: getBrandPresentation(row.brandKey).logo
      },
      category: row.categoryId
        ? {
          id: Number(row.categoryId),
          key: row.categoryKey,
          name: row.categoryName
        }
        : null,
      fitments,
      fitmentSummary: fitments.map((fitment) => `${fitment.modelName} ${fitment.year}`).join(" · ")
    };
  });
}

async function loadInventoryMovements(scope, limit = 50) {
  const brandClause = buildInClause(scope.allowedBrandIds);
  const safeLimit = Math.max(1, Math.min(250, Number(limit) || 50));
  const rows = await executeRows(
    `
      SELECT
        im.id,
        im.movement_type AS movementType,
        im.quantity_delta AS quantityDelta,
        im.unit_cost AS unitCost,
        im.note,
        im.created_at AS createdAt,
        p.id AS partId,
        p.name AS partName,
        p.slug AS partSlug,
        p.stock_quantity AS stockQuantity,
        u.id AS actorUserId,
        u.full_name AS actorName
      FROM inventory_movements im
      INNER JOIN parts p
        ON p.id = im.part_id
      LEFT JOIN users u
        ON u.id = im.created_by_user_id
      WHERE im.dealer_id = ?
        AND p.brand_id IN ${brandClause.clause}
      ORDER BY im.created_at DESC, im.id DESC
      LIMIT ${safeLimit}
    `,
    [scope.dealerId, ...brandClause.values]
  );

  return rows.map((row) => ({
    id: Number(row.id),
    movementType: row.movementType,
    quantityDelta: Number(row.quantityDelta || 0),
    unitCost: row.unitCost !== null ? Number(row.unitCost) : null,
    note: row.note,
    createdAt: row.createdAt,
    part: {
      id: Number(row.partId),
      name: row.partName,
      slug: row.partSlug,
      stockQuantity: Number(row.stockQuantity || 0)
    },
    actor: row.actorUserId
      ? {
        id: Number(row.actorUserId),
        fullName: row.actorName
      }
      : null
  }));
}

function groupOrders(rows) {
  const byOrder = new Map();

  rows.forEach((row) => {
    const orderId = Number(row.orderId);
    if (!byOrder.has(orderId)) {
      byOrder.set(orderId, {
        id: orderId,
        orderNumber: row.orderNumber,
        status: row.orderStatus,
        fulfillmentMethod: row.fulfillmentMethod,
        paymentMethod: row.paymentMethod,
        subtotal: Number(row.subtotal || 0),
        shippingFee: Number(row.shippingFee || 0),
        discountAmount: Number(row.discountAmount || 0),
        totalAmount: Number(row.totalAmount || 0),
        couponCode: row.couponCode,
        createdAt: row.orderCreatedAt,
        customer: {
          id: Number(row.userId),
          fullName: row.customerFullName,
          email: row.customerEmail,
          phone: row.customerPhone,
          addressLine: row.addressLine,
          city: row.city
        },
        items: []
      });
    }

    byOrder.get(orderId).items.push({
      orderItemId: Number(row.orderItemId),
      quantity: Number(row.quantity || 0),
      unitPrice: Number(row.unitPrice || 0),
      lineTotal: Number(row.lineTotal || 0),
      status: row.status,
      statusNote: row.statusNote,
      shippingCarrier: row.shippingCarrier,
      trackingNumber: row.trackingNumber,
      shippedAt: row.shippedAt,
      deliveredAt: row.deliveredAt,
      cancelledAt: row.cancelledAt,
      createdAt: row.itemCreatedAt,
      part: {
        id: Number(row.partId),
        name: row.partName,
        slug: row.partSlug,
        image: row.imageUrl || "./pictures/autofix logo.png",
        partNumber: row.partNumber,
        brand: {
          key: row.brandKey,
          name: row.brandName,
          logo: getBrandPresentation(row.brandKey).logo
        }
      },
      vehicle: row.modelKey && row.yearValue
        ? {
          modelKey: row.modelKey,
          modelName: row.modelName,
          year: Number(row.yearValue)
        }
        : null
    });
  });

  return Array.from(byOrder.values());
}

async function loadOrders(scope) {
  const brandClause = buildInClause(scope.allowedBrandIds);
  const rows = await executeRows(
    `
      SELECT
        oi.id AS orderItemId,
        oi.order_id AS orderId,
        oi.quantity,
        oi.unit_price AS unitPrice,
        oi.line_total AS lineTotal,
        oi.status,
        oi.status_note AS statusNote,
        oi.shipping_carrier AS shippingCarrier,
        oi.tracking_number AS trackingNumber,
        oi.shipped_at AS shippedAt,
        oi.delivered_at AS deliveredAt,
        oi.cancelled_at AS cancelledAt,
        oi.created_at AS itemCreatedAt,
        o.order_number AS orderNumber,
        o.status AS orderStatus,
        o.fulfillment_method AS fulfillmentMethod,
        o.payment_method AS paymentMethod,
        o.subtotal,
        o.shipping_fee AS shippingFee,
        o.discount_amount AS discountAmount,
        o.total_amount AS totalAmount,
        o.coupon_code AS couponCode,
        o.created_at AS orderCreatedAt,
        u.id AS userId,
        u.full_name AS customerFullName,
        u.email AS customerEmail,
        o.phone AS customerPhone,
        o.address_line AS addressLine,
        o.city,
        p.id AS partId,
        p.name AS partName,
        p.slug AS partSlug,
        p.image_url AS imageUrl,
        p.part_number AS partNumber,
        b.brand_key AS brandKey,
        b.name AS brandName,
        m.model_key AS modelKey,
        m.name AS modelName,
        vy.year_value AS yearValue
      FROM order_items oi
      INNER JOIN orders o
        ON o.id = oi.order_id
      INNER JOIN users u
        ON u.id = o.user_id
      INNER JOIN parts p
        ON p.id = oi.part_id
      INNER JOIN brands b
        ON b.id = p.brand_id
      LEFT JOIN models m
        ON m.id = oi.model_id
      LEFT JOIN vehicle_years vy
        ON vy.id = oi.vehicle_year_id
      WHERE oi.dealer_id = ?
        AND p.brand_id IN ${brandClause.clause}
      ORDER BY o.created_at DESC, oi.id DESC
    `,
    [scope.dealerId, ...brandClause.values]
  );

  return groupOrders(rows);
}

async function loadOffers(scope) {
  const brandClause = buildInClause(scope.allowedBrandIds);
  const rows = await executeRows(
    `
      SELECT
        dof.id,
        dof.title,
        dof.description,
        dof.scope_type AS scopeType,
        dof.discount_type AS discountType,
        dof.discount_value AS discountValue,
        dof.starts_at AS startsAt,
        dof.ends_at AS endsAt,
        dof.is_active AS isActive,
        p.id AS partId,
        p.name AS partName,
        p.slug AS partSlug,
        pc.id AS categoryId,
        pc.category_key AS categoryKey,
        pc.name AS categoryName
      FROM dealer_offers dof
      LEFT JOIN parts p
        ON p.id = dof.part_id
      LEFT JOIN part_categories pc
        ON pc.id = dof.category_id
      WHERE dof.dealer_id = ?
        AND (
          dof.part_id IS NULL
          OR p.brand_id IN ${brandClause.clause}
        )
      ORDER BY dof.is_active DESC, dof.created_at DESC, dof.id DESC
    `,
    [scope.dealerId, ...brandClause.values]
  );

  return rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    description: row.description,
    scopeType: row.scopeType,
    discountType: row.discountType,
    discountValue: Number(row.discountValue || 0),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    isActive: normalizeBoolean(row.isActive, true),
    part: row.partId
      ? {
        id: Number(row.partId),
        name: row.partName,
        slug: row.partSlug
      }
      : null,
    category: row.categoryId
      ? {
        id: Number(row.categoryId),
        key: row.categoryKey,
        name: row.categoryName
      }
      : null
  }));
}

async function loadCoupons(scope) {
  const rows = await executeRows(
    `
      SELECT
        dc.id,
        dc.code,
        dc.title,
        dc.description,
        dc.discount_type AS discountType,
        dc.discount_value AS discountValue,
        dc.minimum_order_value AS minimumOrderValue,
        dc.usage_limit AS usageLimit,
        dc.times_used AS timesUsed,
        dc.starts_at AS startsAt,
        dc.ends_at AS endsAt,
        dc.is_active AS isActive,
        u.id AS targetUserId,
        u.full_name AS targetUserName,
        u.email AS targetUserEmail
      FROM dealer_coupons dc
      LEFT JOIN dealer_coupon_targets dct
        ON dct.coupon_id = dc.id
      LEFT JOIN users u
        ON u.id = dct.user_id
      WHERE dc.dealer_id = ?
      ORDER BY dc.is_active DESC, dc.created_at DESC, dc.id DESC
    `,
    [scope.dealerId]
  );

  const byCoupon = new Map();
  rows.forEach((row) => {
    const couponId = Number(row.id);
    if (!byCoupon.has(couponId)) {
      byCoupon.set(couponId, {
        id: couponId,
        code: row.code,
        title: row.title,
        description: row.description,
        discountType: row.discountType,
        discountValue: Number(row.discountValue || 0),
        minimumOrderValue: Number(row.minimumOrderValue || 0),
        usageLimit: row.usageLimit === null ? null : Number(row.usageLimit),
        timesUsed: Number(row.timesUsed || 0),
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        isActive: normalizeBoolean(row.isActive, true),
        targets: []
      });
    }

    if (row.targetUserId) {
      byCoupon.get(couponId).targets.push({
        id: Number(row.targetUserId),
        fullName: row.targetUserName,
        email: row.targetUserEmail
      });
    }
  });

  return Array.from(byCoupon.values());
}

async function loadNotifications(scope) {
  const rows = await executeRows(
    `
      SELECT
        dn.id,
        dn.notification_type AS notificationType,
        dn.title,
        dn.message,
        dn.reference_type AS referenceType,
        dn.reference_id AS referenceId,
        dn.is_read AS isRead,
        dn.created_at AS createdAt,
        u.id AS userId,
        u.full_name AS userFullName,
        u.email AS userEmail
      FROM dealer_notifications dn
      LEFT JOIN users u
        ON u.id = dn.user_id
      WHERE dn.dealer_id = ?
      ORDER BY dn.is_read ASC, dn.created_at DESC, dn.id DESC
    `,
    [scope.dealerId]
  );

  return rows.map((row) => ({
    id: Number(row.id),
    notificationType: row.notificationType,
    title: row.title,
    message: row.message,
    referenceType: row.referenceType,
    referenceId: row.referenceId ? Number(row.referenceId) : null,
    isRead: normalizeBoolean(row.isRead, false),
    createdAt: row.createdAt,
    user: row.userId
      ? {
        id: Number(row.userId),
        fullName: row.userFullName,
        email: row.userEmail
      }
      : null
  }));
}

async function loadShippingMethods(scope) {
  const rows = await executeRows(
    `
      SELECT
        id,
        carrier_name AS carrierName,
        region_name AS regionName,
        base_fee AS baseFee,
        fee_per_item AS feePerItem,
        estimated_days_min AS estimatedDaysMin,
        estimated_days_max AS estimatedDaysMax,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM dealer_shipping_methods
      WHERE dealer_id = ?
      ORDER BY is_active DESC, region_name ASC, carrier_name ASC
    `,
    [scope.dealerId]
  );

  return rows.map((row) => ({
    id: Number(row.id),
    carrierName: row.carrierName,
    regionName: row.regionName,
    baseFee: Number(row.baseFee || 0),
    feePerItem: Number(row.feePerItem || 0),
    estimatedDaysMin: row.estimatedDaysMin === null ? null : Number(row.estimatedDaysMin),
    estimatedDaysMax: row.estimatedDaysMax === null ? null : Number(row.estimatedDaysMax),
    isActive: normalizeBoolean(row.isActive, true),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

async function loadSupportTickets(scope) {
  const rows = await executeRows(
    `
      SELECT
        dst.id,
        dst.subject,
        dst.message,
        dst.priority,
        dst.status,
        dst.admin_reply AS adminReply,
        dst.created_at AS createdAt,
        dst.updated_at AS updatedAt,
        dst.resolved_at AS resolvedAt,
        u.id AS createdByUserId,
        u.full_name AS createdByName,
        u.email AS createdByEmail
      FROM dealer_support_tickets dst
      INNER JOIN users u
        ON u.id = dst.created_by_user_id
      WHERE dst.dealer_id = ?
      ORDER BY dst.status <> 'resolved' DESC, dst.updated_at DESC, dst.id DESC
    `,
    [scope.dealerId]
  );

  return rows.map((row) => ({
    id: Number(row.id),
    subject: row.subject,
    message: row.message,
    priority: row.priority,
    status: row.status,
    adminReply: row.adminReply,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    createdBy: {
      id: Number(row.createdByUserId),
      fullName: row.createdByName,
      email: row.createdByEmail
    }
  }));
}

async function loadHelpArticles() {
  const rows = await executeRows(
    `
      SELECT
        id,
        category,
        title,
        summary,
        content,
        sort_order AS sortOrder
      FROM dealer_help_articles
      ORDER BY sort_order ASC, id ASC
    `
  );

  return rows.map((row) => ({
    id: Number(row.id),
    category: row.category,
    title: row.title,
    summary: row.summary,
    content: row.content,
    sortOrder: Number(row.sortOrder || 0)
  }));
}

async function loadFeedback(scope) {
  const rows = await executeRows(
    `
      SELECT
        dcf.id,
        dcf.complaint_type AS complaintType,
        dcf.rating,
        dcf.message,
        dcf.is_resolved AS isResolved,
        dcf.created_at AS createdAt,
        u.id AS userId,
        u.full_name AS userFullName,
        u.email AS userEmail,
        oi.id AS orderItemId,
        o.order_number AS orderNumber,
        p.name AS partName
      FROM dealer_customer_feedback dcf
      LEFT JOIN users u
        ON u.id = dcf.user_id
      LEFT JOIN order_items oi
        ON oi.id = dcf.order_item_id
      LEFT JOIN orders o
        ON o.id = oi.order_id
      LEFT JOIN parts p
        ON p.id = oi.part_id
      WHERE dcf.dealer_id = ?
      ORDER BY dcf.is_resolved ASC, dcf.created_at DESC, dcf.id DESC
    `,
    [scope.dealerId]
  );

  return rows.map((row) => ({
    id: Number(row.id),
    complaintType: row.complaintType,
    rating: row.rating === null ? null : Number(row.rating),
    message: row.message,
    isResolved: normalizeBoolean(row.isResolved, false),
    createdAt: row.createdAt,
    user: row.userId
      ? {
        id: Number(row.userId),
        fullName: row.userFullName,
        email: row.userEmail
      }
      : null,
    orderItemId: row.orderItemId ? Number(row.orderItemId) : null,
    orderNumber: row.orderNumber,
    partName: row.partName
  }));
}

async function loadStaff(scope) {
  const brandClause = buildInClause(scope.allowedBrandIds);
  const rows = await executeRows(
    `
      SELECT
        dba.id AS accessId,
        dba.user_id AS userId,
        dba.access_status AS accessStatus,
        dba.can_manage_inventory AS canManageInventory,
        dba.can_view_orders AS canViewOrders,
        dba.can_manage_verification AS canManageVerification,
        dba.can_view_analytics AS canViewAnalytics,
        dba.assigned_at AS assignedAt,
        u.username,
        u.full_name AS fullName,
        u.email,
        u.phone,
        u.role,
        u.account_status AS accountStatus,
        b.id AS brandId,
        b.brand_key AS brandKey,
        b.name AS brandName
      FROM dealer_brand_access dba
      INNER JOIN users u
        ON u.id = dba.user_id
      INNER JOIN brands b
        ON b.id = dba.brand_id
      WHERE dba.dealer_id = ?
        AND dba.brand_id IN ${brandClause.clause}
      ORDER BY u.full_name ASC, b.name ASC
    `,
    [scope.dealerId, ...brandClause.values]
  );

  const byUser = new Map();
  rows.forEach((row) => {
    const userId = Number(row.userId);
    if (!byUser.has(userId)) {
      byUser.set(userId, {
        userId,
        username: row.username,
        fullName: row.fullName,
        email: row.email,
        phone: row.phone,
        role: row.role,
        accountStatus: row.accountStatus,
        accessStatus: row.accessStatus,
        assignedAt: row.assignedAt,
        permissions: [],
        brands: [],
        accessIds: []
      });
    }

    const item = byUser.get(userId);
    item.accessIds.push(Number(row.accessId));
    item.brands.push({
      id: Number(row.brandId),
      key: row.brandKey,
      name: row.brandName
    });

    const permissionScope = [];
    if (normalizeBoolean(row.canManageInventory)) permissionScope.push("inventory");
    if (normalizeBoolean(row.canViewOrders)) permissionScope.push("orders");
    if (normalizeBoolean(row.canManageVerification)) permissionScope.push("verification");
    if (normalizeBoolean(row.canViewAnalytics)) permissionScope.push("analytics");
    item.permissions = uniqueBy(
      [...item.permissions, ...permissionScope].map((value) => ({ value })),
      (entry) => entry.value
    ).map((entry) => entry.value);
  });

  return Array.from(byUser.values());
}

async function loadAnalyticsRows(scope, periodDays = 30) {
  const brandClause = buildInClause(scope.allowedBrandIds);
  return executeRows(
    `
      SELECT
        metric_date AS metricDate,
        COALESCE(SUM(store_views), 0) AS storeViews,
        COALESCE(SUM(completed_sales), 0) AS completedSales,
        COALESCE(SUM(search_hits), 0) AS searchHits,
        COALESCE(SUM(low_stock_items), 0) AS lowStockItems,
        COALESCE(SUM(active_listings), 0) AS activeListings
      FROM dealer_analytics
      WHERE dealer_id = ?
        AND brand_id IN ${brandClause.clause}
        AND metric_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY metric_date
      ORDER BY metric_date ASC
    `,
    [scope.dealerId, ...brandClause.values, Number(periodDays)]
  );
}

function buildCustomers(orders, coupons) {
  const couponTargets = new Map();
  coupons.forEach((coupon) => {
    coupon.targets.forEach((target) => {
      if (!couponTargets.has(target.id)) {
        couponTargets.set(target.id, []);
      }
      couponTargets.get(target.id).push(coupon.code);
    });
  });

  const byCustomer = new Map();
  orders.forEach((order) => {
    const userId = Number(order.customer.id);
    if (!byCustomer.has(userId)) {
      byCustomer.set(userId, {
        id: userId,
        fullName: order.customer.fullName,
        email: order.customer.email,
        phone: order.customer.phone,
        city: order.customer.city,
        addressLine: order.customer.addressLine,
        orderCount: 0,
        totalSpent: 0,
        lastOrderAt: order.createdAt,
        orderNumbers: [],
        couponCodes: couponTargets.get(userId) || []
      });
    }

    const customer = byCustomer.get(userId);
    customer.orderCount += 1;
    customer.totalSpent += Number(order.totalAmount || 0);
    customer.lastOrderAt = customer.lastOrderAt > order.createdAt ? customer.lastOrderAt : order.createdAt;
    customer.orderNumbers.push(order.orderNumber);
  });

  return Array.from(byCustomer.values())
    .map((customer) => ({
      ...customer,
      totalSpent: Number(customer.totalSpent.toFixed(2))
    }))
    .sort((left, right) => right.totalSpent - left.totalSpent);
}

function buildOverview({ inventory, inventoryMovements, orders, offers, coupons, notifications, feedback, supportTickets, customers, analyticsRows }) {
  const activeListings = inventory.filter((item) => item.active).length;
  const archivedListings = inventory.filter((item) => !item.active).length;
  const stockUnits = inventory.reduce((sum, item) => sum + item.stockQuantity, 0);
  const lowStockItems = inventory.filter((item) => item.lowStock).length;
  const openOrders = orders.filter((order) => ["pending", "confirmed", "preparing"].includes(order.status)).length;
  const shippedOrders = orders.filter((order) => order.status === "shipped").length;
  const deliveredOrders = orders.filter((order) => ["delivered", "completed"].includes(order.status)).length;
  const cancelledOrders = orders.filter((order) => order.status === "cancelled").length;
  const revenue = orders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const unreadNotifications = notifications.filter((item) => !item.isRead).length;
  const unresolvedFeedback = feedback.filter((item) => !item.isResolved).length;
  const openTickets = supportTickets.filter((item) => item.status !== "resolved").length;
  const activeOffers = offers.filter((item) => item.isActive).length;
  const activeCoupons = coupons.filter((item) => item.isActive).length;
  const incomingStock = inventoryMovements
    .filter((item) => item.quantityDelta > 0)
    .reduce((sum, item) => sum + item.quantityDelta, 0);
  const soldUnits = inventoryMovements
    .filter((item) => item.movementType === "sale")
    .reduce((sum, item) => sum + Math.abs(item.quantityDelta), 0);
  const latestAnalytics = analyticsRows[analyticsRows.length - 1] || null;

  return {
    metrics: {
      activeListings,
      archivedListings,
      stockUnits,
      lowStockItems,
      incomingStock,
      soldUnits,
      revenue: Number(revenue.toFixed(2)),
      openOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      activeOffers,
      activeCoupons,
      customersCount: customers.length,
      unreadNotifications,
      unresolvedFeedback,
      openTickets,
      storeViews: latestAnalytics ? Number(latestAnalytics.storeViews || 0) : 0,
      searchHits: latestAnalytics ? Number(latestAnalytics.searchHits || 0) : 0
    }
  };
}

function buildAnalytics({ inventory, orders, analyticsRows }) {
  const topProductsMap = new Map();
  const hourMap = new Map();
  const categoryMap = new Map();

  orders.forEach((order) => {
    const orderHour = new Date(order.createdAt).getHours();
    hourMap.set(orderHour, (hourMap.get(orderHour) || 0) + 1);

    order.items.forEach((item) => {
      const current = topProductsMap.get(item.part.id) || {
        partId: item.part.id,
        name: item.part.name,
        slug: item.part.slug,
        unitsSold: 0,
        revenue: 0
      };
      current.unitsSold += Number(item.quantity || 0);
      current.revenue += Number(item.lineTotal || 0);
      topProductsMap.set(item.part.id, current);
    });
  });

  inventory.forEach((item) => {
    const categoryKey = item.category?.key || "uncategorized";
    if (!categoryMap.has(categoryKey)) {
      categoryMap.set(categoryKey, {
        categoryKey,
        categoryName: item.category?.name || "Uncategorized",
        listingCount: 0,
        stockUnits: 0
      });
    }
    const category = categoryMap.get(categoryKey);
    category.listingCount += 1;
    category.stockUnits += item.stockQuantity;
  });

  const trend = analyticsRows.map((row) => ({
    metricDate: row.metricDate,
    storeViews: Number(row.storeViews || 0),
    completedSales: Number(row.completedSales || 0),
    searchHits: Number(row.searchHits || 0),
    lowStockItems: Number(row.lowStockItems || 0),
    activeListings: Number(row.activeListings || 0)
  }));

  const topProducts = Array.from(topProductsMap.values())
    .sort((left, right) => right.unitsSold - left.unitsSold || right.revenue - left.revenue)
    .slice(0, 5)
    .map((item) => ({
      ...item,
      revenue: Number(item.revenue.toFixed(2))
    }));

  const orderPatterns = Array.from(hourMap.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([hour, count]) => ({
      hour,
      orders: count
    }));

  const categoryBreakdown = Array.from(categoryMap.values()).sort((left, right) => right.listingCount - left.listingCount);
  const stockAlerts = inventory.filter((item) => item.lowStock).slice(0, 8);

  return {
    trend,
    topProducts,
    orderPatterns,
    categoryBreakdown,
    stockAlerts
  };
}

async function loadDashboardSegment(label, loader) {
  try {
    return await loader();
  } catch (error) {
    const wrapped = createError(`Dealer dashboard segment failed: ${label}`, error.statusCode || 500);
    wrapped.cause = error;
    throw wrapped;
  }
}

async function buildDashboardBundle(scope) {
  const [categories, inventory, inventoryMovements, orders, offers, coupons, notifications, shippingMethods, supportTickets, helpArticles, feedback, staff, analyticsRows] = await Promise.all([
    loadDashboardSegment("categories", () => loadCatalogCategories(scope)),
    loadDashboardSegment("inventory", () => loadInventory(scope)),
    loadDashboardSegment("inventory movements", () => loadInventoryMovements(scope)),
    loadDashboardSegment("orders", () => loadOrders(scope)),
    loadDashboardSegment("offers", () => loadOffers(scope)),
    loadDashboardSegment("coupons", () => loadCoupons(scope)),
    loadDashboardSegment("notifications", () => loadNotifications(scope)),
    loadDashboardSegment("shipping methods", () => loadShippingMethods(scope)),
    loadDashboardSegment("support tickets", () => loadSupportTickets(scope)),
    loadDashboardSegment("help center", () => loadHelpArticles()),
    loadDashboardSegment("feedback", () => loadFeedback(scope)),
    loadDashboardSegment("staff", () => loadStaff(scope)),
    loadDashboardSegment("analytics", () => loadAnalyticsRows(scope))
  ]);

  const customers = buildCustomers(orders, coupons);
  const overview = buildOverview({
    inventory,
    inventoryMovements,
    orders,
    offers,
    coupons,
    notifications,
    feedback,
    supportTickets,
    customers,
    analyticsRows
  });
  const analytics = buildAnalytics({ inventory, orders, analyticsRows });

  return {
    viewer: scope.viewer,
    dealerViewMode: scope.dealerViewMode,
    selectedDealerId: scope.dealerId,
    accessibleDealers: scope.accessibleDealers,
    activeDealer: scope.activeDealer,
    permissions: scope.permissions,
    categories,
    overview,
    inventory,
    inventoryMovements,
    orders,
    offers,
    coupons,
    customers,
    notifications,
    shippingMethods,
    supportTickets,
    helpArticles,
    feedback,
    staff,
    analytics
  };
}

async function resolveBrandId(connection, brandKey) {
  const normalizedBrandKey = normalizeText(brandKey).toLowerCase();
  const [rows] = await connection.execute(
    `
      SELECT id, brand_key AS brandKey, name
      FROM brands
      WHERE brand_key = ?
      LIMIT 1
    `,
    [normalizedBrandKey]
  );

  return rows[0] || null;
}

async function resolveCategoryId(connection, categoryKey) {
  if (!normalizeText(categoryKey)) {
    return null;
  }

  const [rows] = await connection.execute(
    `
      SELECT id, category_key AS categoryKey, name
      FROM part_categories
      WHERE category_key = ?
      LIMIT 1
    `,
    [normalizeText(categoryKey).toLowerCase()]
  );

  return rows[0] || null;
}

async function resolveFitmentRows(connection, brandId, fitments) {
  const resolved = [];

  for (const fitment of fitments) {
    const [rows] = await connection.execute(
      `
        SELECT
          m.id AS modelId,
          m.model_key AS modelKey,
          m.name AS modelName,
          vy.id AS vehicleYearId,
          vy.year_value AS yearValue
        FROM models m
        INNER JOIN vehicle_years vy
          ON vy.model_id = m.id
        WHERE m.brand_id = ?
          AND m.model_key = ?
          AND vy.year_value = ?
        LIMIT 1
      `,
      [Number(brandId), fitment.modelKey, Number(fitment.year)]
    );

    if (!rows[0]) {
      throw createError(`Unsupported fitment: ${fitment.modelKey} ${fitment.year}`, 400);
    }

    resolved.push({
      modelId: Number(rows[0].modelId),
      modelKey: rows[0].modelKey,
      modelName: rows[0].modelName,
      vehicleYearId: Number(rows[0].vehicleYearId),
      yearValue: Number(rows[0].yearValue)
    });
  }

  return uniqueBy(resolved, (item) => item.vehicleYearId);
}

async function insertDealerNotification(connection, payload) {
  const [result] = await connection.execute(
    `
      INSERT INTO dealer_notifications (
        dealer_id,
        user_id,
        notification_type,
        title,
        message,
        reference_type,
        reference_id,
        is_read
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `,
    [
      Number(payload.dealerId),
      payload.userId ? Number(payload.userId) : null,
      payload.notificationType,
      payload.title,
      payload.message,
      payload.referenceType || null,
      payload.referenceId ? Number(payload.referenceId) : null
    ]
  );

  return Number(result.insertId || 0);
}

async function savePartImages(connection, partId, imageUrls) {
  await connection.execute("DELETE FROM part_images WHERE part_id = ?", [partId]);

  for (const [index, imageUrl] of imageUrls.entries()) {
    await connection.execute(
      `
        INSERT INTO part_images (part_id, image_url, is_primary)
        VALUES (?, ?, ?)
      `,
      [partId, imageUrl, index === 0 ? 1 : 0]
    );
  }
}

async function savePartFitments(connection, partId, brandId, fitments) {
  await connection.execute("DELETE FROM part_compatibility WHERE part_id = ?", [partId]);

  for (const fitment of fitments) {
    await connection.execute(
      `
        INSERT INTO part_compatibility (part_id, brand_id, model_id, vehicle_year_id)
        VALUES (?, ?, ?, ?)
      `,
      [partId, brandId, fitment.modelId, fitment.vehicleYearId]
    );
  }
}

async function upsertSerialRegistry(connection, { partId, dealerId, serialNumber, sellerName, notes }) {
  if (!normalizeText(serialNumber)) {
    return;
  }

  await connection.execute(
    `
      INSERT INTO serial_registry (
        part_id,
        dealer_id,
        serial_number,
        registry_status,
        seller_name,
        notes
      )
      VALUES (?, ?, ?, 'valid', ?, ?)
      ON DUPLICATE KEY UPDATE
        part_id = VALUES(part_id),
        dealer_id = VALUES(dealer_id),
        seller_name = VALUES(seller_name),
        notes = VALUES(notes),
        registry_status = 'valid'
    `,
    [partId, dealerId, serialNumber, sellerName, notes || null]
  );
}

async function createInventoryMovement(connection, payload) {
  await connection.execute(
    `
      INSERT INTO inventory_movements (
        dealer_id,
        part_id,
        movement_type,
        quantity_delta,
        unit_cost,
        note,
        created_by_user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      Number(payload.dealerId),
      Number(payload.partId),
      payload.movementType,
      Number(payload.quantityDelta),
      payload.unitCost !== undefined && payload.unitCost !== null ? Number(payload.unitCost) : null,
      payload.note || null,
      payload.createdByUserId ? Number(payload.createdByUserId) : null
    ]
  );
}

async function maybeCreateLowStockNotification(connection, { dealerId, partId, partName, stockQuantity }) {
  if (Number(stockQuantity) > LOW_STOCK_THRESHOLD) {
    return;
  }

  const [existing] = await connection.execute(
    `
      SELECT id
      FROM dealer_notifications
      WHERE dealer_id = ?
        AND notification_type = 'low_stock'
        AND reference_type = 'part'
        AND reference_id = ?
        AND is_read = 0
      LIMIT 1
    `,
    [dealerId, partId]
  );

  if (existing[0]) {
    return;
  }

  await insertDealerNotification(connection, {
    dealerId,
    notificationType: "low_stock",
    title: `Low stock alert: ${partName}`,
    message: `${partName} is down to ${stockQuantity} units. Schedule a refill to protect routed sales.`,
    referenceType: "part",
    referenceId: partId
  });
}

async function ensureScopedPart(connection, scope, partId) {
  const brandClause = buildInClause(scope.allowedBrandIds);
  const [rows] = await connection.execute(
    `
      SELECT
        p.id,
        p.name,
        p.slug,
        p.part_number AS partNumber,
        p.stock_quantity AS stockQuantity,
        p.price,
        p.brand_id AS brandId,
        p.serial_number AS serialNumber,
        b.brand_key AS brandKey
      FROM parts p
      INNER JOIN brands b
        ON b.id = p.brand_id
      WHERE p.id = ?
        AND p.dealer_id = ?
        AND p.brand_id IN ${brandClause.clause}
      LIMIT 1
    `,
    [Number(partId), Number(scope.dealerId), ...brandClause.values]
  );

  if (!rows[0]) {
    throw createError("Product is not available in this dealer scope", 404);
  }

  return rows[0];
}

async function syncOrderTotals(connection, orderId) {
  const [rows] = await connection.execute(
    `
      SELECT
        COALESCE(SUM(CASE WHEN oi.status <> 'cancelled' THEN oi.line_total ELSE 0 END), 0) AS subtotal,
        MAX(o.shipping_fee) AS shippingFee,
        MAX(o.discount_amount) AS discountAmount
      FROM order_items oi
      INNER JOIN orders o
        ON o.id = oi.order_id
      WHERE oi.order_id = ?
      GROUP BY oi.order_id
    `,
    [orderId]
  );

  const subtotal = rows[0] ? Number(rows[0].subtotal || 0) : 0;
  const shippingFee = rows[0] ? Number(rows[0].shippingFee || 0) : 0;
  const discountAmount = rows[0] ? Number(rows[0].discountAmount || 0) : 0;
  const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);

  await connection.execute(
    `
      UPDATE orders
      SET subtotal = ?,
          total_amount = ?
      WHERE id = ?
    `,
    [subtotal, totalAmount, orderId]
  );
}

async function syncOrderStatus(connection, orderId) {
  const [rows] = await connection.execute(
    `
      SELECT status
      FROM order_items
      WHERE order_id = ?
    `,
    [orderId]
  );

  if (!rows.length) {
    await connection.execute("UPDATE orders SET status = 'cancelled' WHERE id = ?", [orderId]);
    return;
  }

  const statuses = rows.map((row) => row.status);
  let nextStatus = "pending";

  if (statuses.every((status) => status === "cancelled")) {
    nextStatus = "cancelled";
  } else if (statuses.every((status) => ["delivered", "completed", "cancelled"].includes(status))) {
    nextStatus = statuses.some((status) => status === "completed") ? "completed" : "delivered";
  } else if (statuses.some((status) => status === "shipped")) {
    nextStatus = "shipped";
  } else if (statuses.some((status) => status === "preparing")) {
    nextStatus = "preparing";
  } else if (statuses.some((status) => ["pending", "confirmed", "new"].includes(status))) {
    nextStatus = "confirmed";
  }

  await connection.execute(
    `
      UPDATE orders
      SET status = ?
      WHERE id = ?
    `,
    [nextStatus, orderId]
  );
}

async function upsertDealerAccessRows(connection, { userId, dealerId, brandIds, status, permissions, assignedBy }) {
  await connection.execute(
    `
      DELETE FROM dealer_brand_access
      WHERE user_id = ?
        AND dealer_id = ?
    `,
    [userId, dealerId]
  );

  for (const brandId of brandIds) {
    await connection.execute(
      `
        INSERT INTO dealer_brand_access (
          user_id,
          dealer_id,
          brand_id,
          access_status,
          can_manage_inventory,
          can_view_orders,
          can_manage_verification,
          can_view_analytics,
          assigned_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        dealerId,
        brandId,
        status,
        permissions.inventory ? 1 : 0,
        permissions.orders ? 1 : 0,
        permissions.verification ? 1 : 0,
        permissions.analytics ? 1 : 0,
        assignedBy || null
      ]
    );
  }
}

router.get("/", async (_req, res, next) => {
  try {
    const data = await loadPublicDealers();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/access/request/me", requireAuth, async (req, res, next) => {
  try {
    const data = await loadMyDealerAccessRequest(req.auth.user.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/access/request", requireAuth, async (req, res, next) => {
  try {
    const dealerRef = normalizeText(req.body?.dealerId || req.body?.dealerSlug);
    if (!dealerRef) {
      throw createError("Dealer selection is required");
    }

    const publicDealer = (await loadPublicDealers({ onlyDealerRef: dealerRef }))[0];
    if (!publicDealer) {
      throw createError("Dealer not found", 404);
    }

    const requestedBrandKeys = uniqueBy(
      (Array.isArray(req.body?.brandKeys) ? req.body.brandKeys : []).map((value) => ({
        key: normalizeText(value).toLowerCase()
      })).filter((item) => item.key),
      (item) => item.key
    ).map((item) => item.key);

    const scopedBrandKeys = requestedBrandKeys.length
      ? requestedBrandKeys.filter((brandKey) => publicDealer.brands.some((brand) => brand.key === brandKey))
      : publicDealer.brands.map((brand) => brand.key);

    if (!scopedBrandKeys.length) {
      throw createError("Choose at least one supported brand for the request");
    }

    await withTransaction(async (connection) => {
      const [existingRows] = await connection.execute(
        `
          SELECT id
          FROM dealer_access_requests
          WHERE user_id = ?
            AND dealer_id = ?
            AND status = 'pending'
          LIMIT 1
        `,
        [req.auth.user.id, publicDealer.id]
      );

      if (existingRows[0]) {
        throw createError("A pending dealer access request already exists for this dealer");
      }

      const [requestResult] = await connection.execute(
        `
          INSERT INTO dealer_access_requests (user_id, dealer_id, note, status)
          VALUES (?, ?, ?, 'pending')
        `,
        [req.auth.user.id, publicDealer.id, normalizeText(req.body?.note) || null]
      );

      const requestId = Number(requestResult.insertId || 0);

      for (const brandKey of scopedBrandKeys) {
        const [brandRows] = await connection.execute(
          `
            SELECT id
            FROM brands
            WHERE brand_key = ?
            LIMIT 1
          `,
          [brandKey]
        );

        if (brandRows[0]) {
          await connection.execute(
            `
              INSERT INTO dealer_access_request_brands (request_id, brand_id)
              VALUES (?, ?)
            `,
            [requestId, Number(brandRows[0].id)]
          );
        }
      }
    });

    const data = await loadMyDealerAccessRequest(req.auth.user.id);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard/me", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    const data = await buildDashboardBundle(scope);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/inventory", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    assertScopePermission(scope, "inventory", "You do not have permission to add products");

    const payload = {
      name: normalizeText(req.body?.name),
      description: normalizeText(req.body?.description),
      imageUrls: normalizeImageUrls(req.body?.imageUrls),
      price: Math.max(0, toNumber(req.body?.price, 0)),
      brandKey: normalizeText(req.body?.brandKey).toLowerCase(),
      categoryKey: normalizeText(req.body?.categoryKey).toLowerCase(),
      manufacturerName: normalizeText(req.body?.manufacturerName),
      partNumber: normalizeText(req.body?.partNumber),
      partType: normalizeText(req.body?.partType || "original").toLowerCase(),
      warrantyMonths: toNumber(req.body?.warrantyMonths, 0),
      technicalSpecs: normalizeTechnicalSpecs(req.body?.technicalSpecs),
      fitments: normalizeFitments(req.body?.fitments),
      serialNumber: normalizeText(req.body?.serialNumber).toUpperCase(),
      initialStock: Math.max(0, toNumber(req.body?.initialStock, 0))
    };

    if (!payload.name || !payload.brandKey || !payload.partNumber) {
      throw createError("Product name, brand, and part number are required");
    }

    if (!["original", "aftermarket"].includes(payload.partType)) {
      throw createError("Invalid part type");
    }

    if (!payload.fitments.length) {
      throw createError("At least one compatible model/year is required");
    }

    let createdPartId = null;

    await withTransaction(async (connection) => {
      const brand = await resolveBrandId(connection, payload.brandKey);
      if (!brand || !scope.allowedBrandKeys.includes(brand.brandKey)) {
        throw createError("This brand is not allowed in the selected dealer scope", 403);
      }

      const category = await resolveCategoryId(connection, payload.categoryKey);
      const fitments = await resolveFitmentRows(connection, Number(brand.id), payload.fitments);
      const slugBase = slugify(`${payload.partNumber}-${payload.name}`) || `part-${Date.now()}`;
      const serialNumber = payload.serialNumber || buildSerialNumber({
        brandKey: brand.brandKey,
        modelKey: fitments[0]?.modelKey,
        year: fitments[0]?.yearValue,
        partNumber: payload.partNumber
      });

      const [partResult] = await connection.execute(
        `
          INSERT INTO parts (
            dealer_id,
            brand_id,
            category_id,
            name,
            slug,
            part_number,
            part_type,
            price,
            rating,
            stock_quantity,
            description,
            image_url,
            serial_number,
            active,
            manufacturer_name,
            warranty_months,
            technical_specs,
            archive_reason
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1, ?, ?, ?, NULL)
        `,
        [
          scope.dealerId,
          Number(brand.id),
          category ? Number(category.id) : null,
          payload.name,
          `${slugBase}-${Date.now()}`,
          payload.partNumber,
          payload.partType,
          payload.price,
          payload.initialStock,
          payload.description || null,
          payload.imageUrls[0] || "./pictures/autofix logo.png",
          serialNumber,
          payload.manufacturerName || null,
          payload.warrantyMonths || null,
          JSON.stringify(payload.technicalSpecs || {})
        ]
      );

      createdPartId = Number(partResult.insertId || 0);
      await savePartImages(connection, createdPartId, payload.imageUrls);
      await savePartFitments(connection, createdPartId, Number(brand.id), fitments);
      await upsertSerialRegistry(connection, {
        partId: createdPartId,
        dealerId: scope.dealerId,
        serialNumber,
        sellerName: scope.activeDealer.name,
        notes: `${payload.name} registered through dealer dashboard.`
      });

      if (payload.initialStock > 0) {
        await createInventoryMovement(connection, {
          dealerId: scope.dealerId,
          partId: createdPartId,
          movementType: "restock",
          quantityDelta: payload.initialStock,
          unitCost: payload.price ? payload.price * 0.6 : null,
          note: "Initial stock created from dealer dashboard.",
          createdByUserId: scope.viewer.id
        });
      }
    });

    const data = await buildDashboardBundle(scope);
    res.status(201).json({
      success: true,
      data: {
        createdPartId,
        dashboard: data
      }
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/inventory/:partId", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    assertScopePermission(scope, "inventory", "You do not have permission to edit products");

    const partId = Number(req.params.partId || 0);
    if (!partId) {
      throw createError("Invalid product id");
    }

    const payload = {
      name: normalizeText(req.body?.name),
      description: normalizeText(req.body?.description),
      imageUrls: normalizeImageUrls(req.body?.imageUrls),
      price: Math.max(0, toNumber(req.body?.price, 0)),
      brandKey: normalizeText(req.body?.brandKey).toLowerCase(),
      categoryKey: normalizeText(req.body?.categoryKey).toLowerCase(),
      manufacturerName: normalizeText(req.body?.manufacturerName),
      partNumber: normalizeText(req.body?.partNumber),
      partType: normalizeText(req.body?.partType || "original").toLowerCase(),
      warrantyMonths: toNumber(req.body?.warrantyMonths, 0),
      technicalSpecs: normalizeTechnicalSpecs(req.body?.technicalSpecs),
      fitments: normalizeFitments(req.body?.fitments),
      serialNumber: normalizeText(req.body?.serialNumber).toUpperCase(),
      active: req.body?.active === undefined ? undefined : normalizeBoolean(req.body?.active, true),
      archiveReason: normalizeText(req.body?.archiveReason)
    };

    await withTransaction(async (connection) => {
      const currentPart = await ensureScopedPart(connection, scope, partId);
      const brand = payload.brandKey ? await resolveBrandId(connection, payload.brandKey) : { id: currentPart.brandId, brandKey: currentPart.brandKey };
      if (!brand || !scope.allowedBrandKeys.includes(brand.brandKey)) {
        throw createError("This brand is not allowed in the selected dealer scope", 403);
      }

      const category = payload.categoryKey ? await resolveCategoryId(connection, payload.categoryKey) : null;
      const fitments = payload.fitments.length
        ? await resolveFitmentRows(connection, Number(brand.id), payload.fitments)
        : null;

      const imageUrls = payload.imageUrls.length ? payload.imageUrls : [currentPart.imageUrl || "./pictures/autofix logo.png"];
      const serialNumber = payload.serialNumber || currentPart.serialNumber || buildSerialNumber({
        brandKey: brand.brandKey,
        modelKey: fitments?.[0]?.modelKey,
        year: fitments?.[0]?.yearValue,
        partNumber: payload.partNumber || currentPart.partNumber
      });

      await connection.execute(
        `
          UPDATE parts
          SET brand_id = ?,
              category_id = ?,
              name = ?,
              part_number = ?,
              part_type = ?,
              price = ?,
              description = ?,
              image_url = ?,
              serial_number = ?,
              active = ?,
              manufacturer_name = ?,
              warranty_months = ?,
              technical_specs = ?,
              archive_reason = ?
          WHERE id = ?
        `,
        [
          Number(brand.id),
          category ? Number(category.id) : null,
          payload.name || currentPart.name,
          payload.partNumber || currentPart.partNumber,
          payload.partType,
          payload.price,
          payload.description || null,
          imageUrls[0] || "./pictures/autofix logo.png",
          serialNumber,
          payload.active === undefined ? 1 : (payload.active ? 1 : 0),
          payload.manufacturerName || null,
          payload.warrantyMonths || null,
          JSON.stringify(payload.technicalSpecs || {}),
          payload.active === false ? (payload.archiveReason || "Archived by dealer") : null,
          partId
        ]
      );

      await savePartImages(connection, partId, imageUrls);
      if (fitments) {
        await savePartFitments(connection, partId, Number(brand.id), fitments);
      }
      await upsertSerialRegistry(connection, {
        partId,
        dealerId: scope.dealerId,
        serialNumber,
        sellerName: scope.activeDealer.name,
        notes: `Listing ${payload.name || currentPart.name} updated from dealer dashboard.`
      });
    });

    const data = await buildDashboardBundle(scope);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.delete("/inventory/:partId", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    assertScopePermission(scope, "inventory", "You do not have permission to remove products");

    const partId = Number(req.params.partId || 0);
    const mode = normalizeText(req.query?.mode || req.body?.mode || "archive").toLowerCase();
    const archiveReason = normalizeText(req.query?.archiveReason || req.body?.archiveReason || "Archived by dealer");

    await withTransaction(async (connection) => {
      const currentPart = await ensureScopedPart(connection, scope, partId);
      const [usageRows] = await connection.execute(
        `
          SELECT COUNT(*) AS linkedOrders
          FROM order_items
          WHERE part_id = ?
        `,
        [partId]
      );

      const linkedOrders = Number(usageRows[0]?.linkedOrders || 0);
      if (mode === "delete" && linkedOrders === 0) {
        await connection.execute("DELETE FROM serial_registry WHERE part_id = ?", [partId]);
        await connection.execute("DELETE FROM part_images WHERE part_id = ?", [partId]);
        await connection.execute("DELETE FROM part_compatibility WHERE part_id = ?", [partId]);
        await connection.execute("DELETE FROM parts WHERE id = ?", [partId]);
      } else {
        await connection.execute(
          `
            UPDATE parts
            SET active = 0,
                archive_reason = ?
            WHERE id = ?
          `,
          [linkedOrders ? "Archived because linked orders exist" : archiveReason, partId]
        );

        await insertDealerNotification(connection, {
          dealerId: scope.dealerId,
          notificationType: "campaign",
          title: `Product archived: ${currentPart.name}`,
          message: linkedOrders
            ? `${currentPart.name} was archived instead of deleted because it is linked to previous orders.`
            : `${currentPart.name} was archived from the dealer inventory.`,
          referenceType: "part",
          referenceId: partId
        });
      }
    });

    const data = await buildDashboardBundle(scope);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/inventory/:partId/stock", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    assertScopePermission(scope, "inventory", "You do not have permission to adjust stock");

    const partId = Number(req.params.partId || 0);
    const movementType = normalizeText(req.body?.movementType || "manual_adjustment").toLowerCase();
    if (!MOVEMENT_TYPES.has(movementType)) {
      throw createError("Invalid inventory movement type");
    }

    await withTransaction(async (connection) => {
      const currentPart = await ensureScopedPart(connection, scope, partId);
      const quantityDelta = req.body?.newQuantity !== undefined
        ? Math.round(toNumber(req.body.newQuantity, currentPart.stockQuantity) - Number(currentPart.stockQuantity || 0))
        : Math.round(toNumber(req.body?.quantityDelta, 0));

      if (!quantityDelta) {
        throw createError("Stock adjustment cannot be zero");
      }

      const nextQuantity = Number(currentPart.stockQuantity || 0) + quantityDelta;
      if (nextQuantity < 0) {
        throw createError("Stock cannot go below zero");
      }

      await connection.execute(
        `
          UPDATE parts
          SET stock_quantity = ?
          WHERE id = ?
        `,
        [nextQuantity, partId]
      );

      await createInventoryMovement(connection, {
        dealerId: scope.dealerId,
        partId,
        movementType,
        quantityDelta,
        unitCost: req.body?.unitCost !== undefined ? Number(req.body.unitCost) : null,
        note: normalizeText(req.body?.note) || "Stock adjusted from dealer dashboard.",
        createdByUserId: scope.viewer.id
      });

      await maybeCreateLowStockNotification(connection, {
        dealerId: scope.dealerId,
        partId,
        partName: currentPart.name,
        stockQuantity: nextQuantity
      });
    });

    const data = await buildDashboardBundle(scope);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/inventory/import", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    assertScopePermission(scope, "inventory", "You do not have permission to import inventory");

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) {
      throw createError("Inventory import rows are required");
    }

    const summary = {
      updated: 0,
      failed: []
    };

    await withTransaction(async (connection) => {
      for (const [index, row] of rows.entries()) {
        try {
          const references = [row.partId ? Number(row.partId) : null, normalizeText(row.partSlug), normalizeText(row.partNumber)];
          const [matches] = await connection.execute(
            `
              SELECT
                p.id,
                p.name,
                p.stock_quantity AS stockQuantity
              FROM parts p
              WHERE p.dealer_id = ?
                AND (
                  (? IS NOT NULL AND p.id = ?)
                  OR (? <> '' AND p.slug = ?)
                  OR (? <> '' AND p.part_number = ?)
                )
              LIMIT 1
            `,
            [
              scope.dealerId,
              references[0],
              references[0],
              references[1],
              references[1],
              references[2],
              references[2]
            ]
          );

          if (!matches[0]) {
            throw new Error("Part was not found in this dealer scope");
          }

          const current = matches[0];
          const quantityDelta = req.body?.mode === "replace"
            ? Math.round(toNumber(row.quantity, current.stockQuantity) - Number(current.stockQuantity || 0))
            : Math.round(toNumber(row.quantityDelta ?? row.quantity, 0));

          const nextQuantity = Number(current.stockQuantity || 0) + quantityDelta;
          if (nextQuantity < 0) {
            throw new Error("Stock cannot go below zero");
          }

          await connection.execute(
            `
              UPDATE parts
              SET stock_quantity = ?
              WHERE id = ?
            `,
            [nextQuantity, Number(current.id)]
          );

          await createInventoryMovement(connection, {
            dealerId: scope.dealerId,
            partId: Number(current.id),
            movementType: "import",
            quantityDelta,
            unitCost: row.unitCost !== undefined ? Number(row.unitCost) : null,
            note: normalizeText(row.note) || `Bulk import row ${index + 1}`,
            createdByUserId: scope.viewer.id
          });

          await maybeCreateLowStockNotification(connection, {
            dealerId: scope.dealerId,
            partId: Number(current.id),
            partName: current.name,
            stockQuantity: nextQuantity
          });

          summary.updated += 1;
        } catch (error) {
          summary.failed.push({
            row: index + 1,
            message: error.message
          });
        }
      }
    });

    const data = await buildDashboardBundle(scope);
    res.json({
      success: true,
      data: {
        importSummary: summary,
        dashboard: data
      }
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/orders/:orderItemId", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    assertScopePermission(scope, "orders", "You do not have permission to manage orders");

    const orderItemId = Number(req.params.orderItemId || 0);
    if (!orderItemId) {
      throw createError("Invalid order line");
    }

    await withTransaction(async (connection) => {
      const brandClause = buildInClause(scope.allowedBrandIds);
      const [rows] = await connection.execute(
        `
          SELECT
            oi.id,
            oi.order_id AS orderId,
            oi.part_id AS partId,
            oi.quantity,
            oi.unit_price AS unitPrice,
            oi.line_total AS lineTotal,
            oi.status,
            oi.shipping_carrier AS shippingCarrier,
            oi.tracking_number AS trackingNumber,
            p.name AS partName,
            p.stock_quantity AS stockQuantity,
            p.brand_id AS brandId,
            o.user_id AS userId,
            o.order_number AS orderNumber
          FROM order_items oi
          INNER JOIN parts p
            ON p.id = oi.part_id
          INNER JOIN orders o
            ON o.id = oi.order_id
          WHERE oi.id = ?
            AND oi.dealer_id = ?
            AND p.brand_id IN ${brandClause.clause}
          LIMIT 1
        `,
        [orderItemId, scope.dealerId, ...brandClause.values]
      );

      if (!rows[0]) {
        throw createError("Order line not found in this dealer scope", 404);
      }

      const current = rows[0];
      const nextStatus = req.body?.status ? normalizeText(req.body.status).toLowerCase() : current.status;
      if (!ORDER_ITEM_STATUSES.has(nextStatus)) {
        throw createError("Invalid order status");
      }

      const requestedQuantity = req.body?.quantity !== undefined ? Math.max(1, Math.round(toNumber(req.body.quantity, current.quantity))) : Number(current.quantity || 1);
      let stockQuantity = Number(current.stockQuantity || 0);
      let quantityDelta = requestedQuantity - Number(current.quantity || 0);
      let shouldRestockCancelledItem = false;
      let shouldDeductReactivatedItem = false;

      if (quantityDelta && !ORDER_EDITABLE_STATUSES.has(current.status)) {
        throw createError("This order line can no longer be edited");
      }

      if (quantityDelta > 0) {
        if (stockQuantity < quantityDelta) {
          throw createError("Not enough stock to increase this order line");
        }
        stockQuantity -= quantityDelta;
      } else if (quantityDelta < 0) {
        stockQuantity += Math.abs(quantityDelta);
      }

      if (current.status !== "cancelled" && nextStatus === "cancelled") {
        stockQuantity += Number(current.quantity || 0);
        shouldRestockCancelledItem = true;
      } else if (current.status === "cancelled" && nextStatus !== "cancelled") {
        if (stockQuantity < Number(current.quantity || 0)) {
          throw createError("Not enough stock to reactivate this order line");
        }
        stockQuantity -= Number(current.quantity || 0);
        shouldDeductReactivatedItem = true;
      }

      if (stockQuantity < 0) {
        throw createError("Order update would drive stock below zero");
      }

      const statusNote = req.body?.statusNote !== undefined ? normalizeText(req.body.statusNote) : current.statusNote;
      const shippingCarrier = req.body?.shippingCarrier !== undefined ? normalizeText(req.body.shippingCarrier) : current.shippingCarrier;
      const trackingNumber = req.body?.trackingNumber !== undefined ? normalizeText(req.body.trackingNumber) : current.trackingNumber;
      const lineTotal = Number((requestedQuantity * Number(current.unitPrice || 0)).toFixed(2));

      await connection.execute(
        `
          UPDATE parts
          SET stock_quantity = ?
          WHERE id = ?
        `,
        [stockQuantity, Number(current.partId)]
      );

      await connection.execute(
        `
          UPDATE order_items
          SET quantity = ?,
              line_total = ?,
              status = ?,
              status_note = ?,
              shipping_carrier = ?,
              tracking_number = ?,
              shipped_at = CASE WHEN ? = 'shipped' THEN CURRENT_TIMESTAMP ELSE shipped_at END,
              delivered_at = CASE WHEN ? IN ('delivered', 'completed') THEN CURRENT_TIMESTAMP ELSE delivered_at END,
              cancelled_at = CASE WHEN ? = 'cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END
          WHERE id = ?
        `,
        [
          requestedQuantity,
          lineTotal,
          nextStatus,
          statusNote || null,
          shippingCarrier || null,
          trackingNumber || null,
          nextStatus,
          nextStatus,
          nextStatus,
          orderItemId
        ]
      );

      if (quantityDelta) {
        await createInventoryMovement(connection, {
          dealerId: scope.dealerId,
          partId: Number(current.partId),
          movementType: "correction",
          quantityDelta: -quantityDelta,
          note: `Order line ${current.orderNumber} quantity updated from ${current.quantity} to ${requestedQuantity}.`,
          createdByUserId: scope.viewer.id
        });
      }

      if (shouldRestockCancelledItem) {
        await createInventoryMovement(connection, {
          dealerId: scope.dealerId,
          partId: Number(current.partId),
          movementType: "correction",
          quantityDelta: Number(current.quantity || 0),
          note: `Order line ${current.orderNumber} was cancelled and stock was returned.`,
          createdByUserId: scope.viewer.id
        });
      }

      if (shouldDeductReactivatedItem) {
        await createInventoryMovement(connection, {
          dealerId: scope.dealerId,
          partId: Number(current.partId),
          movementType: "sale",
          quantityDelta: -Number(current.quantity || 0),
          note: `Cancelled order line ${current.orderNumber} was reactivated.`,
          createdByUserId: scope.viewer.id
        });
      }

      await maybeCreateLowStockNotification(connection, {
        dealerId: scope.dealerId,
        partId: Number(current.partId),
        partName: current.partName,
        stockQuantity
      });

      await syncOrderTotals(connection, Number(current.orderId));
      await syncOrderStatus(connection, Number(current.orderId));

      if (nextStatus !== current.status) {
        const statusMessages = {
          preparing: "Your order is now being prepared by the dealer.",
          shipped: `Your order is now shipped${shippingCarrier ? ` with ${shippingCarrier}` : ""}.`,
          delivered: "Your order has been delivered successfully.",
          completed: "Your order has been completed.",
          cancelled: "Your dealer cancelled this order line and the item was removed from shipment."
        };

        if (statusMessages[nextStatus]) {
          await insertDealerNotification(connection, {
            dealerId: scope.dealerId,
            userId: Number(current.userId),
            notificationType: "shipment_update",
            title: `Order update: ${current.orderNumber}`,
            message: `${current.partName}: ${statusMessages[nextStatus]}`,
            referenceType: "order_item",
            referenceId: orderItemId
          });
        }
      }
    });

    const data = await buildDashboardBundle(scope);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/offers", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    assertScopePermission(scope, "discounts", "You do not have permission to manage offers");

    const scopeType = normalizeText(req.body?.scopeType || "part").toLowerCase();
    if (!OFFER_SCOPE_TYPES.has(scopeType)) {
      throw createError("Invalid offer scope type");
    }

    await withTransaction(async (connection) => {
      let partId = null;
      let categoryId = null;

      if (scopeType === "part") {
        partId = Number(req.body?.partId || 0);
        if (!partId) {
          throw createError("Part selection is required for part offers");
        }
        await ensureScopedPart(connection, scope, partId);
      } else {
        const category = await resolveCategoryId(connection, req.body?.categoryKey);
        if (!category) {
          throw createError("Category is required for category offers");
        }
        categoryId = Number(category.id);
      }

      const discountType = normalizeText(req.body?.discountType || "percentage").toLowerCase();
      if (!DISCOUNT_TYPES.has(discountType)) {
        throw createError("Invalid discount type");
      }

      await connection.execute(
        `
          INSERT INTO dealer_offers (
            dealer_id,
            title,
            description,
            scope_type,
            part_id,
            category_id,
            discount_type,
            discount_value,
            starts_at,
            ends_at,
            is_active
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          scope.dealerId,
          normalizeText(req.body?.title),
          normalizeText(req.body?.description) || null,
          scopeType,
          partId || null,
          categoryId,
          discountType,
          Math.max(0, toNumber(req.body?.discountValue, 0)),
          normalizeText(req.body?.startsAt) || null,
          normalizeText(req.body?.endsAt) || null,
          normalizeBoolean(req.body?.isActive, true) ? 1 : 0
        ]
      );
    });

    const data = await buildDashboardBundle(scope);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch("/offers/:offerId", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    assertScopePermission(scope, "discounts", "You do not have permission to manage offers");

    const offerId = Number(req.params.offerId || 0);
    if (!offerId) {
      throw createError("Invalid offer id");
    }

    await withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        `
          SELECT id
          FROM dealer_offers
          WHERE id = ?
            AND dealer_id = ?
          LIMIT 1
        `,
        [offerId, scope.dealerId]
      );

      if (!rows[0]) {
        throw createError("Offer not found", 404);
      }

      await connection.execute(
        `
          UPDATE dealer_offers
          SET title = ?,
              description = ?,
              discount_type = ?,
              discount_value = ?,
              starts_at = ?,
              ends_at = ?,
              is_active = ?
          WHERE id = ?
        `,
        [
          normalizeText(req.body?.title),
          normalizeText(req.body?.description) || null,
          normalizeText(req.body?.discountType || "percentage").toLowerCase(),
          Math.max(0, toNumber(req.body?.discountValue, 0)),
          normalizeText(req.body?.startsAt) || null,
          normalizeText(req.body?.endsAt) || null,
          normalizeBoolean(req.body?.isActive, true) ? 1 : 0,
          offerId
        ]
      );
    });

    const data = await buildDashboardBundle(scope);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/coupons", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    assertScopePermission(scope, "discounts", "You do not have permission to manage coupons");

    const code = normalizeText(req.body?.code).toUpperCase();
    if (!code) {
      throw createError("Coupon code is required");
    }

    await withTransaction(async (connection) => {
      const [couponResult] = await connection.execute(
        `
          INSERT INTO dealer_coupons (
            dealer_id,
            code,
            title,
            description,
            discount_type,
            discount_value,
            minimum_order_value,
            usage_limit,
            starts_at,
            ends_at,
            is_active
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          scope.dealerId,
          code,
          normalizeText(req.body?.title),
          normalizeText(req.body?.description) || null,
          normalizeText(req.body?.discountType || "percentage").toLowerCase(),
          Math.max(0, toNumber(req.body?.discountValue, 0)),
          Math.max(0, toNumber(req.body?.minimumOrderValue, 0)),
          req.body?.usageLimit ? Math.max(1, toNumber(req.body.usageLimit, 1)) : null,
          normalizeText(req.body?.startsAt) || null,
          normalizeText(req.body?.endsAt) || null,
          normalizeBoolean(req.body?.isActive, true) ? 1 : 0
        ]
      );

      const couponId = Number(couponResult.insertId || 0);
      const targetEmails = uniqueBy(
        (Array.isArray(req.body?.targetEmails) ? req.body.targetEmails : []).map((value) => ({
          email: normalizeEmail(value)
        })).filter((item) => item.email),
        (item) => item.email
      );

      for (const target of targetEmails) {
        const [userRows] = await connection.execute(
          `
            SELECT id
            FROM users
            WHERE email = ?
            LIMIT 1
          `,
          [target.email]
        );

        if (!userRows[0]) {
          continue;
        }

        await connection.execute(
          `
            INSERT INTO dealer_coupon_targets (coupon_id, user_id)
            VALUES (?, ?)
          `,
          [couponId, Number(userRows[0].id)]
        );
      }
    });

    const data = await buildDashboardBundle(scope);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch("/coupons/:couponId", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    assertScopePermission(scope, "discounts", "You do not have permission to manage coupons");

    const couponId = Number(req.params.couponId || 0);
    if (!couponId) {
      throw createError("Invalid coupon id");
    }

    await withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        `
          SELECT id
          FROM dealer_coupons
          WHERE id = ?
            AND dealer_id = ?
          LIMIT 1
        `,
        [couponId, scope.dealerId]
      );

      if (!rows[0]) {
        throw createError("Coupon not found", 404);
      }

      await connection.execute(
        `
          UPDATE dealer_coupons
          SET title = ?,
              description = ?,
              discount_type = ?,
              discount_value = ?,
              minimum_order_value = ?,
              usage_limit = ?,
              starts_at = ?,
              ends_at = ?,
              is_active = ?
          WHERE id = ?
        `,
        [
          normalizeText(req.body?.title),
          normalizeText(req.body?.description) || null,
          normalizeText(req.body?.discountType || "percentage").toLowerCase(),
          Math.max(0, toNumber(req.body?.discountValue, 0)),
          Math.max(0, toNumber(req.body?.minimumOrderValue, 0)),
          req.body?.usageLimit ? Math.max(1, toNumber(req.body.usageLimit, 1)) : null,
          normalizeText(req.body?.startsAt) || null,
          normalizeText(req.body?.endsAt) || null,
          normalizeBoolean(req.body?.isActive, true) ? 1 : 0,
          couponId
        ]
      );

      if (Array.isArray(req.body?.targetEmails)) {
        await connection.execute("DELETE FROM dealer_coupon_targets WHERE coupon_id = ?", [couponId]);

        const targetEmails = uniqueBy(
          req.body.targetEmails.map((value) => ({ email: normalizeEmail(value) })).filter((item) => item.email),
          (item) => item.email
        );

        for (const target of targetEmails) {
          const [userRows] = await connection.execute(
            `
              SELECT id
              FROM users
              WHERE email = ?
              LIMIT 1
            `,
            [target.email]
          );

          if (!userRows[0]) {
            continue;
          }

          await connection.execute(
            `
              INSERT INTO dealer_coupon_targets (coupon_id, user_id)
              VALUES (?, ?)
            `,
            [couponId, Number(userRows[0].id)]
          );
        }
      }
    });

    const data = await buildDashboardBundle(scope);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/customers/notify", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    assertScopePermission(scope, "customers", "You do not have permission to contact customers");

    const title = normalizeText(req.body?.title);
    const message = normalizeText(req.body?.message);
    if (!title || !message) {
      throw createError("Notification title and message are required");
    }

    const customerIds = uniqueBy(
      (Array.isArray(req.body?.customerIds) ? req.body.customerIds : []).map((value) => ({
        id: Number(value)
      })).filter((item) => item.id > 0),
      (item) => item.id
    ).map((item) => item.id);

    if (!customerIds.length) {
      throw createError("Choose at least one customer");
    }

    await withTransaction(async (connection) => {
      for (const customerId of customerIds) {
        await insertDealerNotification(connection, {
          dealerId: scope.dealerId,
          userId: customerId,
          notificationType: "campaign",
          title,
          message,
          referenceType: "customer",
          referenceId: customerId
        });
      }
    });

    const data = await buildDashboardBundle(scope);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch("/notifications/:notificationId/read", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    const notificationId = Number(req.params.notificationId || 0);
    if (!notificationId) {
      throw createError("Invalid notification id");
    }

    await withTransaction(async (connection) => {
      await connection.execute(
        `
          UPDATE dealer_notifications
          SET is_read = ?
          WHERE id = ?
            AND dealer_id = ?
        `,
        [normalizeBoolean(req.body?.isRead, true) ? 1 : 0, notificationId, scope.dealerId]
      );
    });

    const data = await buildDashboardBundle(scope);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/profile", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    res.json({
      success: true,
      data: {
        dealer: scope.activeDealer,
        permissions: scope.permissions,
        viewer: scope.viewer
      }
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/profile", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    assertScopePermission(scope, "profile", "You do not have permission to update dealer profile");

    await withTransaction(async (connection) => {
      await connection.execute(
        `
          UPDATE dealers
          SET name = ?,
              description = ?,
              location = ?,
              contact_email = ?,
              contact_phone = ?
          WHERE id = ?
        `,
        [
          normalizeText(req.body?.name) || scope.activeDealer.name,
          normalizeText(req.body?.description) || null,
          normalizeText(req.body?.location) || null,
          normalizeEmail(req.body?.contactEmail) || null,
          normalizeText(req.body?.contactPhone) || null,
          scope.dealerId
        ]
      );
    });

    const refreshedViewer = await buildUserAccessProfileById(scope.viewer.id);
    req.auth.user = refreshedViewer;
    const refreshedScope = await resolveDealerScope({ ...req, auth: { ...req.auth, user: refreshedViewer } });
    const data = await buildDashboardBundle(refreshedScope);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/staff", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    const data = await loadStaff(scope);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/staff", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    assertScopePermission(scope, "staff", "You do not have permission to manage staff");

    const email = normalizeEmail(req.body?.email);
    const brandKeys = uniqueBy(
      (Array.isArray(req.body?.brandKeys) ? req.body.brandKeys : []).map((value) => ({
        key: normalizeText(value).toLowerCase()
      })).filter((item) => item.key && scope.allowedBrandKeys.includes(item.key)),
      (item) => item.key
    ).map((item) => item.key);

    if (!email || !brandKeys.length) {
      throw createError("Staff email and at least one allowed brand are required");
    }

    const requestedPermissions = {
      inventory: normalizeBoolean(req.body?.permissions?.inventory, true),
      orders: normalizeBoolean(req.body?.permissions?.orders, true),
      verification: normalizeBoolean(req.body?.permissions?.verification, true),
      analytics: normalizeBoolean(req.body?.permissions?.analytics, true)
    };

    await withTransaction(async (connection) => {
      const [userRows] = await connection.execute(
        `
          SELECT id, role
          FROM users
          WHERE email = ?
          LIMIT 1
        `,
        [email]
      );

      if (!userRows[0]) {
        throw createError("This email is not registered on AutoFix", 404);
      }

      const userId = Number(userRows[0].id);
      const brandIds = [];
      for (const brandKey of brandKeys) {
        const brand = await resolveBrandId(connection, brandKey);
        if (brand) {
          brandIds.push(Number(brand.id));
        }
      }

      await upsertDealerAccessRows(connection, {
        userId,
        dealerId: scope.dealerId,
        brandIds,
        status: normalizeText(req.body?.accessStatus || "active").toLowerCase() || "active",
        permissions: requestedPermissions,
        assignedBy: scope.viewer.id
      });

      await connection.execute(
        `
          UPDATE users
          SET role = CASE WHEN role = 'user' THEN 'dealer' ELSE role END
          WHERE id = ?
        `,
        [userId]
      );
    });

    const data = await buildDashboardBundle(scope);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch("/staff/:userId", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    assertScopePermission(scope, "staff", "You do not have permission to manage staff");

    const userId = Number(req.params.userId || 0);
    if (!userId) {
      throw createError("Invalid staff user");
    }

    const brandKeys = uniqueBy(
      (Array.isArray(req.body?.brandKeys) ? req.body.brandKeys : []).map((value) => ({
        key: normalizeText(value).toLowerCase()
      })).filter((item) => item.key && scope.allowedBrandKeys.includes(item.key)),
      (item) => item.key
    ).map((item) => item.key);

    if (!brandKeys.length) {
      throw createError("At least one brand must remain assigned");
    }

    const requestedPermissions = {
      inventory: normalizeBoolean(req.body?.permissions?.inventory, true),
      orders: normalizeBoolean(req.body?.permissions?.orders, true),
      verification: normalizeBoolean(req.body?.permissions?.verification, true),
      analytics: normalizeBoolean(req.body?.permissions?.analytics, true)
    };

    await withTransaction(async (connection) => {
      const [userRows] = await connection.execute(
        `
          SELECT id
          FROM users
          WHERE id = ?
          LIMIT 1
        `,
        [userId]
      );

      if (!userRows[0]) {
        throw createError("Staff user was not found", 404);
      }

      const brandIds = [];
      for (const brandKey of brandKeys) {
        const brand = await resolveBrandId(connection, brandKey);
        if (brand) {
          brandIds.push(Number(brand.id));
        }
      }

      await upsertDealerAccessRows(connection, {
        userId,
        dealerId: scope.dealerId,
        brandIds,
        status: normalizeText(req.body?.accessStatus || "active").toLowerCase() || "active",
        permissions: requestedPermissions,
        assignedBy: scope.viewer.id
      });
    });

    const data = await buildDashboardBundle(scope);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/shipping", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    const data = await loadShippingMethods(scope);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/shipping", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    assertScopePermission(scope, "shipping", "You do not have permission to manage shipping");

    await withTransaction(async (connection) => {
      await connection.execute(
        `
          INSERT INTO dealer_shipping_methods (
            dealer_id,
            carrier_name,
            region_name,
            base_fee,
            fee_per_item,
            estimated_days_min,
            estimated_days_max,
            is_active
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          scope.dealerId,
          normalizeText(req.body?.carrierName),
          normalizeText(req.body?.regionName),
          Math.max(0, toNumber(req.body?.baseFee, 0)),
          Math.max(0, toNumber(req.body?.feePerItem, 0)),
          req.body?.estimatedDaysMin ? Math.max(1, toNumber(req.body.estimatedDaysMin, 1)) : null,
          req.body?.estimatedDaysMax ? Math.max(1, toNumber(req.body.estimatedDaysMax, 1)) : null,
          normalizeBoolean(req.body?.isActive, true) ? 1 : 0
        ]
      );
    });

    const data = await buildDashboardBundle(scope);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch("/shipping/:shippingId", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    assertScopePermission(scope, "shipping", "You do not have permission to manage shipping");

    const shippingId = Number(req.params.shippingId || 0);
    if (!shippingId) {
      throw createError("Invalid shipping method");
    }

    await withTransaction(async (connection) => {
      await connection.execute(
        `
          UPDATE dealer_shipping_methods
          SET carrier_name = ?,
              region_name = ?,
              base_fee = ?,
              fee_per_item = ?,
              estimated_days_min = ?,
              estimated_days_max = ?,
              is_active = ?
          WHERE id = ?
            AND dealer_id = ?
        `,
        [
          normalizeText(req.body?.carrierName),
          normalizeText(req.body?.regionName),
          Math.max(0, toNumber(req.body?.baseFee, 0)),
          Math.max(0, toNumber(req.body?.feePerItem, 0)),
          req.body?.estimatedDaysMin ? Math.max(1, toNumber(req.body.estimatedDaysMin, 1)) : null,
          req.body?.estimatedDaysMax ? Math.max(1, toNumber(req.body.estimatedDaysMax, 1)) : null,
          normalizeBoolean(req.body?.isActive, true) ? 1 : 0,
          shippingId,
          scope.dealerId
        ]
      );
    });

    const data = await buildDashboardBundle(scope);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/shipping/estimate", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    const regionName = normalizeText(req.query?.regionName);
    const itemCount = Math.max(1, toNumber(req.query?.itemCount, 1));

    const methods = await loadShippingMethods(scope);
    const method = methods.find((item) => item.isActive && item.regionName.toLowerCase() === regionName.toLowerCase())
      || methods.find((item) => item.isActive && item.regionName.toLowerCase() === "nationwide");

    if (!method) {
      throw createError("No active shipping method is configured for this region", 404);
    }

    res.json({
      success: true,
      data: {
        method,
        estimatedFee: Number((method.baseFee + method.feePerItem * itemCount).toFixed(2))
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/support", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    const [tickets, helpArticles] = await Promise.all([
      loadSupportTickets(scope),
      loadHelpArticles()
    ]);
    res.json({
      success: true,
      data: {
        tickets,
        helpArticles
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/support", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    assertScopePermission(scope, "support", "You do not have permission to contact support");

    const subject = normalizeText(req.body?.subject);
    const message = normalizeText(req.body?.message);
    const priority = normalizeText(req.body?.priority || "normal").toLowerCase();

    if (!subject || !message) {
      throw createError("Support subject and message are required");
    }

    if (!SUPPORT_PRIORITIES.has(priority)) {
      throw createError("Invalid support priority");
    }

    await withTransaction(async (connection) => {
      await connection.execute(
        `
          INSERT INTO dealer_support_tickets (
            dealer_id,
            created_by_user_id,
            subject,
            message,
            priority,
            status,
            admin_reply
          )
          VALUES (?, ?, ?, ?, ?, 'open', NULL)
        `,
        [scope.dealerId, scope.viewer.id, subject, message, priority]
      );

      await insertDealerNotification(connection, {
        dealerId: scope.dealerId,
        notificationType: "support_reply",
        title: "Support ticket submitted",
        message: `Ticket "${subject}" was sent to AutoFix support and is waiting for review.`,
        referenceType: "support_ticket"
      });
    });

    const data = await buildDashboardBundle(scope);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch("/support/:ticketId", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    const ticketId = Number(req.params.ticketId || 0);
    if (!ticketId) {
      throw createError("Invalid support ticket");
    }

    const status = normalizeText(req.body?.status).toLowerCase();
    if (status && !SUPPORT_STATUSES.has(status)) {
      throw createError("Invalid support status");
    }

    await withTransaction(async (connection) => {
      await connection.execute(
        `
          UPDATE dealer_support_tickets
          SET status = COALESCE(NULLIF(?, ''), status),
              admin_reply = CASE
                WHEN ? <> '' THEN ?
                ELSE admin_reply
              END,
              resolved_at = CASE
                WHEN ? = 'resolved' THEN CURRENT_TIMESTAMP
                ELSE resolved_at
              END
          WHERE id = ?
            AND dealer_id = ?
        `,
        [
          status,
          normalizeText(req.body?.adminReply),
          normalizeText(req.body?.adminReply),
          status,
          ticketId,
          scope.dealerId
        ]
      );
    });

    const data = await buildDashboardBundle(scope);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/help", requireAuth, requireDealerOrAdmin, async (_req, res, next) => {
  try {
    const data = await loadHelpArticles();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/feedback", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    const data = await loadFeedback(scope);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch("/feedback/:feedbackId", requireAuth, requireDealerOrAdmin, async (req, res, next) => {
  try {
    const scope = await resolveDealerScope(req);
    const feedbackId = Number(req.params.feedbackId || 0);
    if (!feedbackId) {
      throw createError("Invalid feedback item");
    }

    await withTransaction(async (connection) => {
      await connection.execute(
        `
          UPDATE dealer_customer_feedback
          SET is_resolved = ?
          WHERE id = ?
            AND dealer_id = ?
        `,
        [normalizeBoolean(req.body?.isResolved, true) ? 1 : 0, feedbackId, scope.dealerId]
      );
    });

    const data = await buildDashboardBundle(scope);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/:dealerRef", async (req, res, next) => {
  try {
    const dealer = (await loadPublicDealers({ onlyDealerRef: req.params.dealerRef }))[0];
    if (!dealer) {
      throw createError("Dealer not found", 404);
    }

    const data = {
      ...dealer,
      metrics: {
        activeListings: dealer.activeListings,
        lowStockItems: dealer.lowStockItems,
        staffCount: dealer.staffCount
      }
    };

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
