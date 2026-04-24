import { Router } from "express";
import { query, withTransaction } from "../config/database.js";
import { requireAuth } from "../middleware/authenticate.js";
import { requireAdmin } from "../middleware/authorize.js";
import { buildUserAccessProfileById, listUserAccessProfiles } from "../lib/auth-profile.js";

const router = Router();

const LOW_STOCK_THRESHOLD = 5;
const ORDER_STATUSES = new Set(["pending", "confirmed", "preparing", "shipped", "delivered", "completed", "cancelled"]);
const ORDER_ITEM_STATUSES = new Set(["new", "pending", "preparing", "shipped", "delivered", "completed", "cancelled"]);
const PERMISSION_KEYS = ["inventory", "orders", "verification", "analytics"];

router.use(requireAuth, requireAdmin);

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => normalizeText(value).toLowerCase())
        .filter(Boolean)
    )
  );
}

function normalizePermissionScope(values = []) {
  return uniqueStrings(values).filter((item) => PERMISSION_KEYS.includes(item));
}

function buildPermissionFlags(permissionScope = []) {
  const scope = new Set(normalizePermissionScope(permissionScope));
  return {
    inventory: scope.has("inventory") ? 1 : 0,
    orders: scope.has("orders") ? 1 : 0,
    verification: scope.has("verification") ? 1 : 0,
    analytics: scope.has("analytics") ? 1 : 0
  };
}

function buildInClause(values = []) {
  const normalized = values.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);
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

async function getBrandsCatalog() {
  const rows = await query(
    `
      SELECT
        b.id,
        b.brand_key AS brandKey,
        b.name,
        m.id AS modelId,
        m.model_key AS modelKey,
        m.name AS modelName
      FROM brands b
      LEFT JOIN models m
        ON m.brand_id = b.id
      ORDER BY b.name ASC, m.name ASC
    `
  );

  const byBrand = new Map();

  for (const row of rows) {
    if (!byBrand.has(row.id)) {
      byBrand.set(row.id, {
        id: Number(row.id),
        key: row.brandKey,
        name: row.name,
        models: []
      });
    }

    if (row.modelId) {
      byBrand.get(row.id).models.push({
        id: Number(row.modelId),
        key: row.modelKey,
        name: row.modelName
      });
    }
  }

  return Array.from(byBrand.values());
}

async function getDealerCoverage() {
  const rows = await query(
    `
      SELECT
        d.id,
        d.name,
        d.slug,
        d.description,
        d.location,
        d.contact_email AS contactEmail,
        d.contact_phone AS contactPhone,
        d.is_active AS isActive,
        b.id AS brandId,
        b.brand_key AS brandKey,
        b.name AS brandName,
        (
          SELECT COUNT(DISTINCT dba.user_id)
          FROM dealer_brand_access dba
          WHERE dba.dealer_id = d.id
            AND dba.access_status = 'active'
        ) AS assignedAccounts,
        (
          SELECT COUNT(*)
          FROM parts p
          WHERE p.dealer_id = d.id
        ) AS totalProducts,
        (
          SELECT COUNT(*)
          FROM parts p
          WHERE p.dealer_id = d.id
            AND p.active = 1
            AND p.stock_quantity <= :threshold
        ) AS lowStockItems
      FROM dealers d
      LEFT JOIN dealer_supported_brands dsb
        ON dsb.dealer_id = d.id
      LEFT JOIN brands b
        ON b.id = dsb.brand_id
      ORDER BY d.name ASC, b.name ASC
    `,
    { threshold: LOW_STOCK_THRESHOLD }
  );

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, {
        id: Number(row.id),
        name: row.name,
        slug: row.slug,
        description: row.description,
        location: row.location,
        contactEmail: row.contactEmail,
        contactPhone: row.contactPhone,
        isActive: Boolean(row.isActive),
        assignedAccounts: Number(row.assignedAccounts || 0),
        totalProducts: Number(row.totalProducts || 0),
        lowStockItems: Number(row.lowStockItems || 0),
        brands: []
      });
    }

    if (row.brandId) {
      map.get(row.id).brands.push({
        id: Number(row.brandId),
        key: row.brandKey,
        name: row.brandName
      });
    }
  }

  return Array.from(map.values());
}

async function getPendingRequests() {
  const rows = await query(
    `
      SELECT
        dar.id,
        dar.status,
        dar.note,
        dar.created_at AS createdAt,
        u.id AS requesterId,
        u.email AS requesterEmail,
        u.full_name AS requesterFullName,
        d.id AS dealerId,
        d.name AS dealerName,
        b.id AS brandId,
        b.brand_key AS brandKey,
        b.name AS brandName
      FROM dealer_access_requests dar
      INNER JOIN users u
        ON u.id = dar.user_id
      INNER JOIN dealers d
        ON d.id = dar.dealer_id
      LEFT JOIN dealer_access_request_brands darb
        ON darb.request_id = dar.id
      LEFT JOIN brands b
        ON b.id = darb.brand_id
      WHERE dar.status = 'pending'
      ORDER BY dar.created_at DESC, b.name ASC
    `
  );

  const byRequest = new Map();

  for (const row of rows) {
    if (!byRequest.has(row.id)) {
      byRequest.set(row.id, {
        id: Number(row.id),
        status: row.status,
        note: row.note,
        createdAt: row.createdAt,
        requester: {
          id: Number(row.requesterId),
          email: row.requesterEmail,
          fullName: row.requesterFullName
        },
        dealer: {
          id: Number(row.dealerId),
          name: row.dealerName
        },
        requestedBrands: []
      });
    }

    if (row.brandId) {
      byRequest.get(row.id).requestedBrands.push({
        id: Number(row.brandId),
        key: row.brandKey,
        name: row.brandName
      });
    }
  }

  return Array.from(byRequest.values());
}

async function getRequestById(requestId) {
  const rows = await query(
    `
      SELECT
        dar.id,
        dar.status,
        dar.note,
        dar.created_at AS createdAt,
        u.id AS requesterId,
        u.email AS requesterEmail,
        u.full_name AS requesterFullName,
        d.id AS dealerId,
        d.name AS dealerName,
        b.id AS brandId,
        b.brand_key AS brandKey,
        b.name AS brandName
      FROM dealer_access_requests dar
      INNER JOIN users u
        ON u.id = dar.user_id
      INNER JOIN dealers d
        ON d.id = dar.dealer_id
      LEFT JOIN dealer_access_request_brands darb
        ON darb.request_id = dar.id
      LEFT JOIN brands b
        ON b.id = darb.brand_id
      WHERE dar.id = :requestId
      ORDER BY b.name ASC
    `,
    { requestId }
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
    requester: {
      id: Number(first.requesterId),
      email: first.requesterEmail,
      fullName: first.requesterFullName
    },
    dealer: {
      id: Number(first.dealerId),
      name: first.dealerName
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

async function getRecentActivity() {
  return query(
    `
      SELECT
        id,
        activity_message AS message,
        created_at AS createdAt
      FROM admin_activity_logs
      ORDER BY created_at DESC
      LIMIT 14
    `
  );
}

async function getProductsAudit() {
  return query(
    `
      SELECT
        p.id,
        p.name,
        p.slug,
        p.part_number AS partNumber,
        p.serial_number AS serialNumber,
        p.part_type AS partType,
        p.price,
        p.stock_quantity AS stockQuantity,
        p.active,
        p.manufacturer_name AS manufacturerName,
        p.warranty_months AS warrantyMonths,
        p.updated_at AS updatedAt,
        d.id AS dealerId,
        d.name AS dealerName,
        b.id AS brandId,
        b.brand_key AS brandKey,
        b.name AS brandName,
        pc.id AS categoryId,
        pc.category_key AS categoryKey,
        pc.name AS categoryName,
        GROUP_CONCAT(DISTINCT CONCAT(m.name, ' ', vy.year_value) ORDER BY vy.year_value SEPARATOR ' · ') AS fitmentLabel
      FROM parts p
      INNER JOIN dealers d
        ON d.id = p.dealer_id
      INNER JOIN brands b
        ON b.id = p.brand_id
      LEFT JOIN part_categories pc
        ON pc.id = p.category_id
      LEFT JOIN part_compatibility compatibility
        ON compatibility.part_id = p.id
      LEFT JOIN vehicle_years vy
        ON vy.id = compatibility.vehicle_year_id
      LEFT JOIN models m
        ON m.id = vy.model_id
      GROUP BY p.id
      ORDER BY p.updated_at DESC, p.id DESC
      LIMIT 240
    `
  );
}

async function getOrdersAudit() {
  return query(
    `
      SELECT
        o.id,
        o.order_number AS orderNumber,
        o.status,
        o.customer_full_name AS customerFullName,
        o.phone,
        o.address_line AS addressLine,
        o.city,
        o.fulfillment_method AS fulfillmentMethod,
        o.payment_method AS paymentMethod,
        o.subtotal,
        o.shipping_fee AS shippingFee,
        o.discount_amount AS discountAmount,
        o.total_amount AS totalAmount,
        o.created_at AS createdAt,
        u.id AS userId,
        u.email AS userEmail,
        COUNT(DISTINCT oi.id) AS lineItems,
        GROUP_CONCAT(DISTINCT d.name ORDER BY d.name SEPARATOR ' · ') AS dealerNames
      FROM orders o
      INNER JOIN users u
        ON u.id = o.user_id
      LEFT JOIN order_items oi
        ON oi.order_id = o.id
      LEFT JOIN dealers d
        ON d.id = oi.dealer_id
      GROUP BY o.id
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT 180
    `
  );
}

async function getLowStockAudit() {
  return query(
    `
      SELECT
        p.id,
        p.name,
        p.part_number AS partNumber,
        p.stock_quantity AS stockQuantity,
        p.updated_at AS updatedAt,
        d.id AS dealerId,
        d.name AS dealerName,
        b.brand_key AS brandKey,
        b.name AS brandName
      FROM parts p
      INNER JOIN dealers d
        ON d.id = p.dealer_id
      INNER JOIN brands b
        ON b.id = p.brand_id
      WHERE p.active = 1
        AND p.stock_quantity <= :threshold
      ORDER BY p.stock_quantity ASC, p.updated_at DESC
      LIMIT 80
    `,
    { threshold: LOW_STOCK_THRESHOLD }
  );
}

function buildAdminNotifications({ pendingRequests, lowStockItems, recentOrders, dealerCoverage }) {
  const notifications = [];

  for (const request of pendingRequests.slice(0, 4)) {
    notifications.push({
      type: "dealer_request",
      title: "New dealer access request",
      message: `${request.requester.fullName} requested dealer access for ${request.dealer.name}.`,
      createdAt: request.createdAt
    });
  }

  for (const item of lowStockItems.slice(0, 4)) {
    notifications.push({
      type: "low_stock",
      title: "Low stock alert",
      message: `${item.name} at ${item.dealerName} is down to ${item.stockQuantity} units.`,
      createdAt: item.updatedAt
    });
  }

  for (const order of recentOrders.filter((order) => order.status === "pending").slice(0, 4)) {
    notifications.push({
      type: "new_order",
      title: "New order placed",
      message: `${order.orderNumber} was created for ${order.customerFullName}.`,
      createdAt: order.createdAt
    });
  }

  if (!notifications.length && dealerCoverage.length) {
    notifications.push({
      type: "system",
      title: "Platform is stable",
      message: "No urgent admin alerts right now.",
      createdAt: new Date().toISOString()
    });
  }

  return notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 12);
}

async function buildAdminDashboardData() {
  const [assignments, dealerCoverage, pendingRequests, recentActivity, brands, products, orders, lowStock] = await Promise.all([
    listUserAccessProfiles(),
    getDealerCoverage(),
    getPendingRequests(),
    getRecentActivity(),
    getBrandsCatalog(),
    getProductsAudit(),
    getOrdersAudit(),
    getLowStockAudit()
  ]);

  const dealerAccounts = assignments.filter((user) => user.dashboardAccess?.dealer && !user.dashboardAccess?.admin).length;
  const notifications = buildAdminNotifications({
    pendingRequests,
    lowStockItems: lowStock,
    recentOrders: orders,
    dealerCoverage
  });

  return {
    kpis: {
      totalAccounts: assignments.length,
      dealerAccounts,
      dealerNetworks: dealerCoverage.length,
      pendingApprovals: pendingRequests.length,
      totalOrders: orders.length,
      totalProducts: products.length,
      lowStockItems: lowStock.length
    },
    assignments,
    brands,
    dealerCoverage,
    pendingRequests,
    recentActivity,
    products,
    orders,
    lowStock,
    notifications
  };
}

async function normalizeDealerAssignments(rawAssignments, coverage) {
  const assignments = Array.isArray(rawAssignments) ? rawAssignments : [];
  const normalizedAssignments = [];

  for (const entry of assignments) {
    const dealerId = Number(entry?.dealerId || 0);
    const accessStatus = normalizeText(entry?.accessStatus || "active").toLowerCase() || "active";
    const brandKeys = uniqueStrings(entry?.brandKeys || []);
    const permissionScope = normalizePermissionScope(entry?.permissionScope || []);

    if (!dealerId || !brandKeys.length) {
      continue;
    }

    const dealer = coverage.find((item) => item.id === dealerId);
    if (!dealer) {
      throw createError("Choose a valid dealer network");
    }

    const supportedBrandKeys = new Set(dealer.brands.map((brand) => brand.key));
    for (const brandKey of brandKeys) {
      if (!supportedBrandKeys.has(brandKey)) {
        throw createError(`Brand "${brandKey}" is not covered by ${dealer.name}`);
      }
    }

    normalizedAssignments.push({
      dealerId,
      accessStatus,
      brandKeys,
      permissionScope
    });
  }

  return normalizedAssignments;
}

async function saveUserAccess({
  adminUserId,
  email,
  role,
  accessStatus,
  permissionScope,
  dealerId,
  brandKeys,
  assignments
}) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedRole = normalizeText(role || "user").toLowerCase() || "user";
  const normalizedStatus = normalizeText(accessStatus || "active").toLowerCase() || "active";
  const coverage = await getDealerCoverage();

  const userRows = await query(
    `
      SELECT id, email, full_name AS fullName
      FROM users
      WHERE email = :email
      LIMIT 1
    `,
    { email: normalizedEmail }
  );

  const user = userRows[0];
  if (!user) {
    throw createError("This email is not registered in AutoFix", 404);
  }

  let normalizedAssignments;

  if (Array.isArray(assignments) && assignments.length) {
    normalizedAssignments = await normalizeDealerAssignments(assignments, coverage);
  } else if (normalizedRole === "dealer") {
    normalizedAssignments = await normalizeDealerAssignments([{
      dealerId,
      accessStatus: normalizedStatus,
      brandKeys,
      permissionScope
    }], coverage);
  } else {
    normalizedAssignments = [];
  }

  if (normalizedRole === "dealer" && !normalizedAssignments.length) {
    throw createError("Choose at least one dealer network and brand scope for this dealer");
  }

  await withTransaction(async (connection) => {
    await connection.execute(
      `
        UPDATE users
        SET role = ?, account_status = ?
        WHERE id = ?
      `,
      [normalizedRole, normalizedStatus, user.id]
    );

    if (normalizedRole === "admin") {
      await connection.execute(
        `
          INSERT INTO admins (user_id, super_admin)
          VALUES (?, 1)
          ON DUPLICATE KEY UPDATE super_admin = VALUES(super_admin)
        `,
        [user.id]
      );
    } else {
      await connection.execute("DELETE FROM admins WHERE user_id = ?", [user.id]);
    }

    await connection.execute("DELETE FROM dealer_brand_access WHERE user_id = ?", [user.id]);

    for (const assignment of normalizedAssignments) {
      const dealer = coverage.find((item) => item.id === assignment.dealerId);
      const scopeFlags = buildPermissionFlags(assignment.permissionScope);

      const supportedBrandRows = await connection.execute(
        `
          SELECT b.id, b.brand_key AS brandKey
          FROM dealer_supported_brands dsb
          INNER JOIN brands b
            ON b.id = dsb.brand_id
          WHERE dsb.dealer_id = ?
        `,
        [assignment.dealerId]
      );

      const supportedBrands = supportedBrandRows[0].filter((row) => assignment.brandKeys.includes(row.brandKey));

      for (const brand of supportedBrands) {
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
            user.id,
            assignment.dealerId,
            brand.id,
            assignment.accessStatus,
            scopeFlags.inventory,
            scopeFlags.orders,
            scopeFlags.verification,
            scopeFlags.analytics,
            adminUserId
          ]
        );
      }

      await connection.execute(
        `
          UPDATE dealer_access_requests
          SET status = 'approved', reviewed_by = ?, reviewed_at = NOW()
          WHERE user_id = ?
            AND dealer_id = ?
            AND status = 'pending'
        `,
        [adminUserId, user.id, dealer.id]
      );
    }

    await connection.execute(
      `
        INSERT INTO admin_activity_logs (admin_user_id, activity_message)
        VALUES (?, ?)
      `,
      [
        adminUserId,
        normalizedRole === "dealer"
          ? `Updated dealer access for ${user.email} across ${normalizedAssignments.length} dealer scope(s)`
          : `Updated ${user.email} role to ${normalizedRole}`
      ]
    );
  });

  return buildUserAccessProfileById(user.id);
}

async function reviewDealerAccessRequest({ requestId, adminUserId, decision }) {
  const request = await getRequestById(requestId);
  if (!request) {
    throw createError("Dealer access request not found", 404);
  }

  if (request.status !== "pending") {
    throw createError("This request has already been reviewed");
  }

  if (decision === "approve") {
    const user = await saveUserAccess({
      adminUserId,
      email: request.requester.email,
      role: "dealer",
      accessStatus: "active",
      assignments: [{
        dealerId: request.dealer.id,
        accessStatus: "active",
        brandKeys: request.requestedBrands.map((brand) => brand.key),
        permissionScope: ["inventory", "orders", "verification", "analytics"]
      }]
    });

    return {
      user,
      dashboard: await buildAdminDashboardData()
    };
  }

  if (decision === "reject") {
    await withTransaction(async (connection) => {
      await connection.execute(
        `
          UPDATE dealer_access_requests
          SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW()
          WHERE id = ?
            AND status = 'pending'
        `,
        [adminUserId, request.id]
      );

      await connection.execute(
        `
          INSERT INTO admin_activity_logs (admin_user_id, activity_message)
          VALUES (?, ?)
        `,
        [adminUserId, `Rejected dealer access request from ${request.requester.email} for ${request.dealer.name}`]
      );
    });

    return {
      user: await buildUserAccessProfileById(request.requester.id),
      dashboard: await buildAdminDashboardData()
    };
  }

  throw createError("Unsupported review decision");
}

async function saveDealerNetwork({ adminUserId, dealerId = null, name, slug, description, location, contactEmail, contactPhone, isActive = true, brandKeys = [] }) {
  const normalizedName = normalizeText(name);
  if (!normalizedName) {
    throw createError("Dealer name is required");
  }

  const normalizedSlug = slugify(slug || name);
  if (!normalizedSlug) {
    throw createError("Dealer slug is invalid");
  }

  const normalizedBrandKeys = uniqueStrings(brandKeys);
  if (!normalizedBrandKeys.length) {
    throw createError("Choose at least one brand for this dealer network");
  }

  const brands = await getBrandsCatalog();
  const selectedBrands = brands.filter((brand) => normalizedBrandKeys.includes(brand.key));
  if (selectedBrands.length !== normalizedBrandKeys.length) {
    throw createError("One or more selected brands do not exist");
  }

  let finalDealerId = dealerId ? Number(dealerId) : null;

  await withTransaction(async (connection) => {
    if (finalDealerId) {
      await connection.execute(
        `
          UPDATE dealers
          SET
            name = ?,
            slug = ?,
            description = ?,
            location = ?,
            contact_email = ?,
            contact_phone = ?,
            is_active = ?
          WHERE id = ?
        `,
        [
          normalizedName,
          normalizedSlug,
          normalizeText(description),
          normalizeText(location),
          normalizeEmail(contactEmail),
          normalizeText(contactPhone),
          normalizeBoolean(isActive, true) ? 1 : 0,
          finalDealerId
        ]
      );

      await connection.execute("DELETE FROM dealer_supported_brands WHERE dealer_id = ?", [finalDealerId]);
    } else {
      const [result] = await connection.execute(
        `
          INSERT INTO dealers (
            name,
            slug,
            description,
            location,
            contact_email,
            contact_phone,
            is_active
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          normalizedName,
          normalizedSlug,
          normalizeText(description),
          normalizeText(location),
          normalizeEmail(contactEmail),
          normalizeText(contactPhone),
          normalizeBoolean(isActive, true) ? 1 : 0
        ]
      );

      finalDealerId = Number(result.insertId);
    }

    for (const brand of selectedBrands) {
      await connection.execute(
        `
          INSERT INTO dealer_supported_brands (dealer_id, brand_id)
          VALUES (?, ?)
        `,
        [finalDealerId, brand.id]
      );
    }

    await connection.execute(
      `
        INSERT INTO admin_activity_logs (admin_user_id, activity_message)
        VALUES (?, ?)
      `,
      [
        adminUserId,
        dealerId
          ? `Updated dealer network ${normalizedName}`
          : `Created dealer network ${normalizedName}`
      ]
    );
  });

  const coverage = await getDealerCoverage();
  return coverage.find((dealer) => dealer.id === finalDealerId) || null;
}

async function deleteDealerNetwork({ adminUserId, dealerId }) {
  const existingRows = await query(
    `
      SELECT id, name
      FROM dealers
      WHERE id = :dealerId
      LIMIT 1
    `,
    { dealerId }
  );

  const dealer = existingRows[0];
  if (!dealer) {
    throw createError("Dealer network not found", 404);
  }

  const relatedRows = await query(
    `
      SELECT
        (SELECT COUNT(*) FROM parts WHERE dealer_id = :dealerId) AS productCount,
        (SELECT COUNT(*) FROM dealer_brand_access WHERE dealer_id = :dealerId) AS assignmentCount,
        (SELECT COUNT(*) FROM order_items WHERE dealer_id = :dealerId) AS orderCount
    `,
    { dealerId }
  );

  const related = relatedRows[0];
  const hasRelations = Number(related.productCount || 0) > 0 || Number(related.assignmentCount || 0) > 0 || Number(related.orderCount || 0) > 0;

  await withTransaction(async (connection) => {
    if (hasRelations) {
      await connection.execute("UPDATE dealers SET is_active = 0 WHERE id = ?", [dealerId]);
    } else {
      await connection.execute("DELETE FROM dealers WHERE id = ?", [dealerId]);
    }

    await connection.execute(
      `
        INSERT INTO admin_activity_logs (admin_user_id, activity_message)
        VALUES (?, ?)
      `,
      [
        adminUserId,
        hasRelations
          ? `Archived dealer network ${dealer.name}`
          : `Deleted dealer network ${dealer.name}`
      ]
    );
  });

  return { archived: hasRelations };
}

async function updateProductByAdmin({ adminUserId, partId, body }) {
  const existingRows = await query(
    `
      SELECT id, name
      FROM parts
      WHERE id = :partId
      LIMIT 1
    `,
    { partId }
  );

  const existing = existingRows[0];
  if (!existing) {
    throw createError("Product not found", 404);
  }

  const categoryId = body?.categoryId ? Number(body.categoryId) : null;

  await withTransaction(async (connection) => {
    await connection.execute(
      `
        UPDATE parts
        SET
          name = ?,
          part_number = ?,
          serial_number = ?,
          part_type = ?,
          price = ?,
          stock_quantity = ?,
          manufacturer_name = ?,
          warranty_months = ?,
          description = ?,
          category_id = ?,
          active = ?
        WHERE id = ?
      `,
      [
        normalizeText(body?.name),
        normalizeText(body?.partNumber),
        normalizeText(body?.serialNumber),
        normalizeText(body?.partType || "original"),
        toNumber(body?.price, 0),
        Math.max(0, toNumber(body?.stockQuantity, 0)),
        normalizeText(body?.manufacturerName),
        Math.max(0, toNumber(body?.warrantyMonths, 0)),
        normalizeText(body?.description),
        categoryId || null,
        normalizeBoolean(body?.active, true) ? 1 : 0,
        partId
      ]
    );

    await connection.execute(
      `
        INSERT INTO admin_activity_logs (admin_user_id, activity_message)
        VALUES (?, ?)
      `,
      [adminUserId, `Updated product ${normalizeText(body?.name || existing.name)}`]
    );
  });
}

async function deleteProductByAdmin({ adminUserId, partId }) {
  const rows = await query(
    `
      SELECT id, name
      FROM parts
      WHERE id = :partId
      LIMIT 1
    `,
    { partId }
  );

  const product = rows[0];
  if (!product) {
    throw createError("Product not found", 404);
  }

  const relationRows = await query(
    `
      SELECT
        (SELECT COUNT(*) FROM order_items WHERE part_id = :partId) AS orderItems,
        (SELECT COUNT(*) FROM serial_registry WHERE part_id = :partId) AS serials,
        (SELECT COUNT(*) FROM cart_items WHERE part_id = :partId) AS cartItems
    `,
    { partId }
  );

  const related = relationRows[0] || {};
  const hasRelations = Number(related.orderItems || 0) > 0 || Number(related.serials || 0) > 0 || Number(related.cartItems || 0) > 0;

  await withTransaction(async (connection) => {
    if (hasRelations) {
      await connection.execute(
        `
          UPDATE parts
          SET active = 0,
              archive_reason = ?
          WHERE id = ?
        `,
        ["Archived by admin to preserve order / serial history", partId]
      );
    } else {
      await connection.execute("DELETE FROM parts WHERE id = ?", [partId]);
    }

    await connection.execute(
      `
        INSERT INTO admin_activity_logs (admin_user_id, activity_message)
        VALUES (?, ?)
      `,
      [adminUserId, `${hasRelations ? "Archived" : "Deleted"} product ${product.name}`]
    );
  });
}

async function updateOrderByAdmin({ adminUserId, orderId, status }) {
  const normalizedStatus = normalizeText(status).toLowerCase();
  if (!ORDER_STATUSES.has(normalizedStatus)) {
    throw createError("Unsupported order status");
  }

  const rows = await query(
    `
      SELECT id, order_number AS orderNumber
      FROM orders
      WHERE id = :orderId
      LIMIT 1
    `,
    { orderId }
  );

  const order = rows[0];
  if (!order) {
    throw createError("Order not found", 404);
  }

  await withTransaction(async (connection) => {
    await connection.execute(
      `
        UPDATE orders
        SET status = ?
        WHERE id = ?
      `,
      [normalizedStatus, orderId]
    );

    const itemStatus = normalizedStatus === "confirmed" ? "pending" : normalizedStatus;
    if (ORDER_ITEM_STATUSES.has(itemStatus)) {
      await connection.execute(
        `
          UPDATE order_items
          SET status = ?
          WHERE order_id = ?
        `,
        [itemStatus, orderId]
      );
    }

    await connection.execute(
      `
        INSERT INTO admin_activity_logs (admin_user_id, activity_message)
        VALUES (?, ?)
      `,
      [adminUserId, `Updated order ${order.orderNumber} to ${normalizedStatus}`]
    );
  });
}

async function adjustInventoryByAdmin({ adminUserId, partId, quantityDelta, replaceQuantity, note }) {
  const rows = await query(
    `
      SELECT id, name, dealer_id AS dealerId, stock_quantity AS stockQuantity
      FROM parts
      WHERE id = :partId
      LIMIT 1
    `,
    { partId }
  );

  const part = rows[0];
  if (!part) {
    throw createError("Product not found", 404);
  }

  const delta = toNumber(quantityDelta, 0);
  const replaceWith = replaceQuantity !== undefined && replaceQuantity !== null && replaceQuantity !== "" ? toNumber(replaceQuantity, null) : null;
  let nextQuantity = replaceWith !== null ? Math.max(0, replaceWith) : Math.max(0, Number(part.stockQuantity) + delta);
  const appliedDelta = nextQuantity - Number(part.stockQuantity);

  await withTransaction(async (connection) => {
    await connection.execute(
      `
        UPDATE parts
        SET stock_quantity = ?
        WHERE id = ?
      `,
      [nextQuantity, partId]
    );

    await connection.execute(
      `
        INSERT INTO inventory_movements (
          dealer_id,
          part_id,
          movement_type,
          quantity_delta,
          note,
          created_by_user_id
        )
        VALUES (?, ?, 'manual_adjustment', ?, ?, ?)
      `,
      [part.dealerId, partId, appliedDelta, normalizeText(note, "Admin adjustment"), adminUserId]
    );

    await connection.execute(
      `
        INSERT INTO admin_activity_logs (admin_user_id, activity_message)
        VALUES (?, ?)
      `,
      [adminUserId, `Adjusted stock for ${part.name} by ${appliedDelta}`]
    );
  });
}

async function deleteUserAccount({ adminUserId, targetUserId }) {
  const rows = await query(
    `
      SELECT id, email, role
      FROM users
      WHERE id = :targetUserId
      LIMIT 1
    `,
    { targetUserId }
  );

  const user = rows[0];
  if (!user) {
    throw createError("User not found", 404);
  }

  if (Number(targetUserId) === Number(adminUserId)) {
    throw createError("You cannot delete your own admin account");
  }

  const relationRows = await query(
    `
      SELECT
        (SELECT COUNT(*) FROM orders WHERE user_id = :targetUserId) AS ordersCount,
        (SELECT COUNT(*) FROM assistant_logs WHERE user_id = :targetUserId) AS assistantCount,
        (SELECT COUNT(*) FROM dealer_brand_access WHERE user_id = :targetUserId) AS accessCount,
        (SELECT COUNT(*) FROM dealer_access_requests WHERE user_id = :targetUserId) AS requestCount
    `,
    { targetUserId }
  );

  const related = relationRows[0] || {};
  const hasRelations =
    Number(related.ordersCount || 0) > 0 ||
    Number(related.assistantCount || 0) > 0 ||
    Number(related.accessCount || 0) > 0 ||
    Number(related.requestCount || 0) > 0;

  await withTransaction(async (connection) => {
    if (hasRelations) {
      await connection.execute("DELETE FROM admins WHERE user_id = ?", [targetUserId]);
      await connection.execute("DELETE FROM dealer_brand_access WHERE user_id = ?", [targetUserId]);
      await connection.execute(
        `
          UPDATE users
          SET role = 'user',
              account_status = 'suspended'
          WHERE id = ?
        `,
        [targetUserId]
      );
    } else {
      await connection.execute("DELETE FROM users WHERE id = ?", [targetUserId]);
    }

    await connection.execute(
      `
        INSERT INTO admin_activity_logs (admin_user_id, activity_message)
        VALUES (?, ?)
      `,
      [adminUserId, `${hasRelations ? "Archived" : "Deleted"} account ${user.email}`]
    );
  });
}

router.get("/dashboard", async (_req, res, next) => {
  try {
    const data = await buildAdminDashboardData();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/users", async (_req, res, next) => {
  try {
    const data = await listUserAccessProfiles();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/dealers", async (_req, res, next) => {
  try {
    const data = await getDealerCoverage();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/brands", async (_req, res, next) => {
  try {
    const data = await getBrandsCatalog();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/products", async (_req, res, next) => {
  try {
    const data = await getProductsAudit();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/orders", async (_req, res, next) => {
  try {
    const data = await getOrdersAudit();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/inventory", async (_req, res, next) => {
  try {
    const data = await getLowStockAudit();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/dealer-access/assign", async (req, res, next) => {
  try {
    const user = await saveUserAccess({
      adminUserId: req.auth.user.id,
      email: req.body?.email,
      role: req.body?.role,
      accessStatus: req.body?.accessStatus,
      permissionScope: req.body?.permissionScope,
      dealerId: req.body?.dealerId,
      brandKeys: req.body?.brandKeys,
      assignments: req.body?.assignments
    });

    const dashboard = await buildAdminDashboardData();
    res.json({ success: true, data: { user, dashboard } });
  } catch (error) {
    next(error);
  }
});

router.post("/dealer-access/requests/:requestId/review", async (req, res, next) => {
  try {
    const data = await reviewDealerAccessRequest({
      requestId: Number(req.params.requestId),
      adminUserId: req.auth.user.id,
      decision: normalizeText(req.body?.decision).toLowerCase()
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:userId/access", async (req, res, next) => {
  try {
    const targetUser = await buildUserAccessProfileById(req.params.userId);
    if (!targetUser) {
      throw createError("User not found", 404);
    }

    const user = await saveUserAccess({
      adminUserId: req.auth.user.id,
      email: targetUser.email,
      role: req.body?.role,
      accessStatus: req.body?.accessStatus,
      permissionScope: req.body?.permissionScope,
      dealerId: req.body?.dealerId,
      brandKeys: req.body?.brandKeys,
      assignments: req.body?.assignments
    });

    const dashboard = await buildAdminDashboardData();
    res.json({ success: true, data: { user, dashboard } });
  } catch (error) {
    next(error);
  }
});

router.delete("/users/:userId", async (req, res, next) => {
  try {
    await deleteUserAccount({
      adminUserId: req.auth.user.id,
      targetUserId: Number(req.params.userId)
    });

    const dashboard = await buildAdminDashboardData();
    res.json({ success: true, data: { dashboard } });
  } catch (error) {
    next(error);
  }
});

router.post("/dealers", async (req, res, next) => {
  try {
    const dealer = await saveDealerNetwork({
      adminUserId: req.auth.user.id,
      name: req.body?.name,
      slug: req.body?.slug,
      description: req.body?.description,
      location: req.body?.location,
      contactEmail: req.body?.contactEmail,
      contactPhone: req.body?.contactPhone,
      isActive: req.body?.isActive,
      brandKeys: req.body?.brandKeys
    });

    const dashboard = await buildAdminDashboardData();
    res.json({ success: true, data: { dealer, dashboard } });
  } catch (error) {
    next(error);
  }
});

router.patch("/dealers/:dealerId", async (req, res, next) => {
  try {
    const dealer = await saveDealerNetwork({
      adminUserId: req.auth.user.id,
      dealerId: Number(req.params.dealerId),
      name: req.body?.name,
      slug: req.body?.slug,
      description: req.body?.description,
      location: req.body?.location,
      contactEmail: req.body?.contactEmail,
      contactPhone: req.body?.contactPhone,
      isActive: req.body?.isActive,
      brandKeys: req.body?.brandKeys
    });

    const dashboard = await buildAdminDashboardData();
    res.json({ success: true, data: { dealer, dashboard } });
  } catch (error) {
    next(error);
  }
});

router.delete("/dealers/:dealerId", async (req, res, next) => {
  try {
    const result = await deleteDealerNetwork({
      adminUserId: req.auth.user.id,
      dealerId: Number(req.params.dealerId)
    });

    const dashboard = await buildAdminDashboardData();
    res.json({ success: true, data: { result, dashboard } });
  } catch (error) {
    next(error);
  }
});

router.patch("/products/:partId", async (req, res, next) => {
  try {
    await updateProductByAdmin({
      adminUserId: req.auth.user.id,
      partId: Number(req.params.partId),
      body: req.body
    });

    const dashboard = await buildAdminDashboardData();
    res.json({ success: true, data: { dashboard } });
  } catch (error) {
    next(error);
  }
});

router.delete("/products/:partId", async (req, res, next) => {
  try {
    await deleteProductByAdmin({
      adminUserId: req.auth.user.id,
      partId: Number(req.params.partId)
    });

    const dashboard = await buildAdminDashboardData();
    res.json({ success: true, data: { dashboard } });
  } catch (error) {
    next(error);
  }
});

router.patch("/orders/:orderId", async (req, res, next) => {
  try {
    await updateOrderByAdmin({
      adminUserId: req.auth.user.id,
      orderId: Number(req.params.orderId),
      status: req.body?.status
    });

    const dashboard = await buildAdminDashboardData();
    res.json({ success: true, data: { dashboard } });
  } catch (error) {
    next(error);
  }
});

router.post("/inventory/adjust", async (req, res, next) => {
  try {
    await adjustInventoryByAdmin({
      adminUserId: req.auth.user.id,
      partId: Number(req.body?.partId),
      quantityDelta: req.body?.quantityDelta,
      replaceQuantity: req.body?.replaceQuantity,
      note: req.body?.note
    });

    const dashboard = await buildAdminDashboardData();
    res.json({ success: true, data: { dashboard } });
  } catch (error) {
    next(error);
  }
});

export default router;
