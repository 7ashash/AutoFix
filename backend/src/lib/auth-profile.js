import { query } from "../config/database.js";

function mapSavedVehicleRow(row) {
  if (!row?.vehicleYearId) {
    return null;
  }

  return {
    vehicleYearId: Number(row.vehicleYearId),
    brandId: Number(row.brandId),
    brandKey: row.brandKey,
    brandName: row.brandName,
    modelId: Number(row.modelId),
    modelKey: row.modelKey,
    modelName: row.modelName,
    year: Number(row.yearValue),
    yearLabel: row.yearLabel,
    label: `${row.brandName} ${row.modelName} ${row.yearValue}`
  };
}

function toPermissionScope(accessRows) {
  const permissions = new Set();

  for (const row of accessRows) {
    if (row.canManageInventory) permissions.add("inventory");
    if (row.canViewOrders) permissions.add("orders");
    if (row.canManageVerification) permissions.add("verification");
    if (row.canViewAnalytics) permissions.add("analytics");
  }

  return Array.from(permissions);
}

function groupDealerAssignments(accessRows) {
  const byDealer = new Map();

  for (const row of accessRows) {
    const dealerId = Number(row.dealerId);
    if (!byDealer.has(dealerId)) {
      byDealer.set(dealerId, {
        dealerId,
        dealerName: row.dealerName,
        dealerSlug: row.dealerSlug,
        description: row.dealerDescription,
        location: row.dealerLocation,
        accessStatus: row.accessStatus,
        allowedBrands: [],
        allowedBrandKeys: [],
        permissionScope: []
      });
    }

    const dealer = byDealer.get(dealerId);
    if (!dealer.allowedBrandKeys.includes(row.brandKey)) {
      dealer.allowedBrandKeys.push(row.brandKey);
      dealer.allowedBrands.push({
        id: Number(row.brandId),
        key: row.brandKey,
        name: row.brandName
      });
    }
  }

  for (const dealer of byDealer.values()) {
    const relevantRows = accessRows.filter((row) => Number(row.dealerId) === dealer.dealerId);
    dealer.permissionScope = toPermissionScope(relevantRows);
  }

  return Array.from(byDealer.values());
}

async function loadAccessRows(userId, { activeOnly = false } = {}) {
  return query(
    `
      SELECT
        dba.id,
        dba.user_id AS userId,
        dba.dealer_id AS dealerId,
        dba.brand_id AS brandId,
        dba.access_status AS accessStatus,
        dba.can_manage_inventory AS canManageInventory,
        dba.can_view_orders AS canViewOrders,
        dba.can_manage_verification AS canManageVerification,
        dba.can_view_analytics AS canViewAnalytics,
        d.name AS dealerName,
        d.slug AS dealerSlug,
        d.description AS dealerDescription,
        d.location AS dealerLocation,
        b.brand_key AS brandKey,
        b.name AS brandName
      FROM dealer_brand_access dba
      INNER JOIN dealers d
        ON d.id = dba.dealer_id
      INNER JOIN brands b
        ON b.id = dba.brand_id
      WHERE dba.user_id = :userId
        ${activeOnly ? "AND dba.access_status = 'active'" : ""}
      ORDER BY d.name ASC, b.name ASC
    `,
    { userId }
  );
}

export async function resolveGarageVehicleSelection({ brandKey, modelKey, vehicleYearId } = {}) {
  const rows = await query(
    `
      SELECT
        vy.id AS vehicleYearId,
        vy.year_value AS yearValue,
        vy.year_label AS yearLabel,
        m.id AS modelId,
        m.model_key AS modelKey,
        m.name AS modelName,
        b.id AS brandId,
        b.brand_key AS brandKey,
        b.name AS brandName
      FROM vehicle_years vy
      INNER JOIN models m
        ON m.id = vy.model_id
      INNER JOIN brands b
        ON b.id = m.brand_id
      WHERE vy.id = :vehicleYearId
        AND b.brand_key = :brandKey
        AND m.model_key = :modelKey
      LIMIT 1
    `,
    {
      vehicleYearId: Number(vehicleYearId || 0),
      brandKey: String(brandKey || "").trim().toLowerCase(),
      modelKey: String(modelKey || "").trim().toLowerCase()
    }
  );

  return mapSavedVehicleRow(rows[0]);
}

export async function loadSavedVehicleByUserId(userId) {
  const rows = await query(
    `
      SELECT
        vy.id AS vehicleYearId,
        vy.year_value AS yearValue,
        vy.year_label AS yearLabel,
        m.id AS modelId,
        m.model_key AS modelKey,
        m.name AS modelName,
        b.id AS brandId,
        b.brand_key AS brandKey,
        b.name AS brandName
      FROM users u
      LEFT JOIN vehicle_years vy
        ON vy.id = u.garage_vehicle_year_id
      LEFT JOIN models m
        ON m.id = vy.model_id
      LEFT JOIN brands b
        ON b.id = m.brand_id
      WHERE u.id = :userId
      LIMIT 1
    `,
    { userId }
  );

  return mapSavedVehicleRow(rows[0]);
}

export async function findUserWithPasswordByEmail(email) {
  const rows = await query(
    `
      SELECT
        id,
        username,
        email,
        password_hash AS passwordHash,
        full_name AS fullName,
        phone,
        address_line AS addressLine,
        city,
        role,
        account_status AS accountStatus,
        created_at AS createdAt
      FROM users
      WHERE email = :email
      LIMIT 1
    `,
    { email: String(email || "").trim().toLowerCase() }
  );

  return rows[0] || null;
}

export async function findUserWithPasswordById(userId) {
  const rows = await query(
    `
      SELECT
        id,
        username,
        email,
        password_hash AS passwordHash,
        full_name AS fullName,
        phone,
        address_line AS addressLine,
        city,
        role,
        account_status AS accountStatus,
        created_at AS createdAt
      FROM users
      WHERE id = :userId
      LIMIT 1
    `,
    { userId }
  );

  return rows[0] || null;
}

export async function buildUserAccessProfileById(userId) {
  const user = await findUserWithPasswordById(userId);
  if (!user) return null;

  const [adminRows, allAccessRows, activeAccessRows, savedVehicle] = await Promise.all([
    query("SELECT id, super_admin AS superAdmin FROM admins WHERE user_id = :userId LIMIT 1", { userId }),
    loadAccessRows(userId),
    loadAccessRows(userId, { activeOnly: true }),
    loadSavedVehicleByUserId(userId)
  ]);

  const isAdmin = user.role === "admin" || Boolean(adminRows[0]);
  const dealerAssignments = groupDealerAssignments(allAccessRows);
  const activeDealerAssignments = groupDealerAssignments(activeAccessRows);
  const allowedBrands = activeDealerAssignments.flatMap((dealer) => dealer.allowedBrands);
  const allowedBrandKeys = Array.from(new Set(allowedBrands.map((brand) => brand.key)));
  const permissionScope = isAdmin
    ? ["inventory", "orders", "verification", "analytics"]
    : toPermissionScope(activeAccessRows);

  return {
    id: Number(user.id),
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    addressLine: user.addressLine,
    city: user.city,
    savedVehicle,
    role: user.role,
    accountStatus: user.accountStatus,
    dealerId: activeDealerAssignments[0]?.dealerId || null,
    dealerName: activeDealerAssignments[0]?.dealerName || null,
    dealerAssignments,
    allowedBrands,
    allowedBrandKeys,
    permissionScope,
    dashboardAccess: {
      admin: isAdmin,
      dealer: isAdmin || activeDealerAssignments.length > 0
    },
    createdAt: user.createdAt
  };
}

export async function listUserAccessProfiles() {
  const users = await query(
    `
      SELECT
        id,
        username,
        email,
        full_name AS fullName,
        phone,
        address_line AS addressLine,
        city,
        role,
        account_status AS accountStatus,
        created_at AS createdAt
      FROM users
      ORDER BY created_at ASC, id ASC
    `
  );

  const results = [];
  for (const user of users) {
    const profile = await buildUserAccessProfileById(user.id);
    if (profile) {
      results.push(profile);
    }
  }

  return results;
}
