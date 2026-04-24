import { createConnection } from "./db-utils.js";
import { hashPassword } from "../lib/passwords.js";

const productionAccounts = [
  {
    username: "admin",
    email: "admin@autofix.com",
    password: "Admin@123",
    fullName: "AutoFix Admin",
    phone: "+20 100 111 0001",
    role: "admin"
  },
  {
    username: "dealer",
    email: "dealer@autofix.com",
    password: "Dealer@123",
    fullName: "Al-Mansour Dealer",
    phone: "+20 100 111 0002",
    role: "dealer"
  },
  {
    username: "premium",
    email: "premium@autofix.com",
    password: "Premium@123",
    fullName: "Bavarian Dealer Manager",
    phone: "+20 100 111 0003",
    role: "dealer"
  },
  {
    username: "toyota",
    email: "toyota@autofix.com",
    password: "Toyota@123",
    fullName: "Toyota Dealer Manager",
    phone: "+20 100 111 0004",
    role: "dealer"
  },
  {
    username: "nissan",
    email: "nissan@autofix.com",
    password: "Nissan@123",
    fullName: "Nissan Dealer Manager",
    phone: "+20 100 111 0006",
    role: "dealer"
  },
  {
    username: "hyundai",
    email: "hyundai@autofix.com",
    password: "Hyundai@123",
    fullName: "Hyundai Dealer Manager",
    phone: "+20 100 111 0007",
    role: "dealer"
  },
  {
    username: "user",
    email: "user@autofix.com",
    password: "User@123",
    fullName: "Normal Customer",
    phone: "+20 100 111 0005",
    role: "user"
  }
];

const dealerScopes = [
  {
    email: "dealer@autofix.com",
    dealerSlug: "al-mansour-automotive",
    dealerEmail: "dealer@autofix.com",
    brandKeys: ["mg", "peugeot"]
  },
  {
    email: "toyota@autofix.com",
    dealerSlug: "toyota-egypt",
    dealerEmail: "toyota@autofix.com",
    brandKeys: ["toyota"]
  },
  {
    email: "premium@autofix.com",
    dealerSlug: "bavarian-auto-group",
    dealerEmail: "premium@autofix.com",
    brandKeys: ["bmw", "mercedes"]
  },
  {
    email: "nissan@autofix.com",
    dealerSlug: "nissan-egypt",
    dealerEmail: "nissan@autofix.com",
    brandKeys: ["nissan"]
  },
  {
    email: "hyundai@autofix.com",
    dealerSlug: "gb-auto-hyundai",
    dealerEmail: "hyundai@autofix.com",
    brandKeys: ["hyundai"]
  }
];

const transientTables = [
  "dealer_coupon_targets",
  "dealer_customer_feedback",
  "dealer_support_tickets",
  "dealer_notifications",
  "verification_checks",
  "verification_reports",
  "assistant_logs",
  "cart_items",
  "carts",
  "order_items",
  "orders",
  "dealer_access_request_brands",
  "dealer_access_requests",
  "admin_activity_logs"
];

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
    `,
    [tableName]
  );

  return Number(rows[0]?.count || 0) > 0;
}

async function clearTable(connection, tableName) {
  if (!(await tableExists(connection, tableName))) {
    return false;
  }

  await connection.query(`DELETE FROM \`${tableName}\``);
  await connection.query(`ALTER TABLE \`${tableName}\` AUTO_INCREMENT = 1`);
  return true;
}

async function ensureAccount(connection, account) {
  const passwordHash = await hashPassword(account.password);
  await connection.query(
    `
      INSERT INTO users (
        username,
        email,
        password_hash,
        full_name,
        phone,
        role,
        account_status
      )
      VALUES (?, ?, ?, ?, ?, ?, 'active')
      ON DUPLICATE KEY UPDATE
        username = VALUES(username),
        password_hash = VALUES(password_hash),
        full_name = VALUES(full_name),
        phone = VALUES(phone),
        role = VALUES(role),
        account_status = 'active'
    `,
    [
      account.username,
      account.email,
      passwordHash,
      account.fullName,
      account.phone,
      account.role
    ]
  );
}

async function getUserId(connection, email) {
  const [rows] = await connection.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  return Number(rows[0]?.id || 0);
}

async function assignDealerScope(connection, scope, adminUserId) {
  await connection.query(
    "UPDATE dealers SET contact_email = ?, is_active = 1 WHERE slug = ?",
    [scope.dealerEmail, scope.dealerSlug]
  );

  for (const brandKey of scope.brandKeys) {
    await connection.query(
      `
        INSERT IGNORE INTO dealer_supported_brands (dealer_id, brand_id)
        SELECT d.id, b.id
        FROM dealers d
        JOIN brands b ON b.brand_key = ?
        WHERE d.slug = ?
      `,
      [brandKey, scope.dealerSlug]
    );

    await connection.query(
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
        SELECT
          u.id,
          d.id,
          b.id,
          'active',
          1,
          1,
          1,
          1,
          ?
        FROM users u
        JOIN dealers d ON d.slug = ?
        JOIN brands b ON b.brand_key = ?
        WHERE u.email = ?
        ON DUPLICATE KEY UPDATE
          access_status = 'active',
          can_manage_inventory = 1,
          can_view_orders = 1,
          can_manage_verification = 1,
          can_view_analytics = 1,
          assigned_by = VALUES(assigned_by)
      `,
      [adminUserId || null, scope.dealerSlug, brandKey, scope.email]
    );
  }
}

async function setDefaultSavedVehicle(connection) {
  await connection.query(
    `
      UPDATE users u
      JOIN vehicle_years vy
      JOIN models m ON m.id = vy.model_id
      SET u.garage_vehicle_year_id = vy.id
      WHERE u.email = 'user@autofix.com'
        AND m.model_key = 'toyota-corolla'
        AND vy.year_value = 2020
    `
  );
}

async function summarize(connection) {
  const [users] = await connection.query(
    `
      SELECT
        u.email,
        u.full_name AS fullName,
        u.role,
        u.account_status AS accountStatus,
        COALESCE(
          GROUP_CONCAT(DISTINCT CONCAT(d.name, ' / ', b.name) ORDER BY d.name, b.name SEPARATOR ', '),
          ''
        ) AS access
      FROM users u
      LEFT JOIN dealer_brand_access dba ON dba.user_id = u.id
      LEFT JOIN dealers d ON d.id = dba.dealer_id
      LEFT JOIN brands b ON b.id = dba.brand_id
      GROUP BY u.id
      ORDER BY FIELD(u.role, 'admin', 'dealer', 'user'), u.email
    `
  );

  const [countsRows] = await connection.query(
    `
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM assistant_logs) AS assistantLogs,
        (SELECT COUNT(*) FROM orders) AS orders,
        (SELECT COUNT(*) FROM carts) AS carts,
        (SELECT COUNT(*) FROM verification_reports) AS verificationReports,
        (SELECT COUNT(*) FROM dealer_access_requests) AS dealerAccessRequests
    `
  );

  return {
    counts: countsRows[0],
    users
  };
}

async function main() {
  const connection = await createConnection();
  const preservedEmails = productionAccounts.map((account) => account.email);
  const cleanedTables = [];

  try {
    await connection.beginTransaction();

    for (const tableName of transientTables) {
      if (await clearTable(connection, tableName)) {
        cleanedTables.push(tableName);
      }
    }

    await connection.query("DELETE FROM dealer_brand_access");

    for (const account of productionAccounts) {
      await ensureAccount(connection, account);
    }

    await connection.query(
      `DELETE FROM users WHERE email NOT IN (${preservedEmails.map(() => "?").join(", ")})`,
      preservedEmails
    );

    const adminUserId = await getUserId(connection, "admin@autofix.com");
    await connection.query("DELETE FROM admins WHERE user_id <> ?", [adminUserId]);
    await connection.query(
      "INSERT IGNORE INTO admins (user_id, super_admin) VALUES (?, 1)",
      [adminUserId]
    );

    for (const scope of dealerScopes) {
      await assignDealerScope(connection, scope, adminUserId);
    }

    await setDefaultSavedVehicle(connection);

    await connection.query(
      "INSERT INTO admin_activity_logs (admin_user_id, activity_message) VALUES (?, ?)",
      [adminUserId, "Prepared clean production demo data for deployment."]
    );

    await connection.commit();

    const summary = await summarize(connection);
    console.log(JSON.stringify({ cleanedTables, ...summary }, null, 2));
  } catch (error) {
    await connection.rollback();
    console.error(error);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main();
