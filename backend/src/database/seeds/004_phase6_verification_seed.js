async function queryRows(connection, sql, params = []) {
  const [rows] = await connection.execute(sql, params);
  return rows;
}

async function executeOne(connection, sql, params = []) {
  await connection.execute(sql, params);
}

async function updateRegistryStatusBySlug(connection, slug, registryStatus, note) {
  await executeOne(
    connection,
    `
      UPDATE serial_registry sr
      INNER JOIN parts p
        ON p.id = sr.part_id
      SET sr.registry_status = ?,
          sr.notes = ?
      WHERE p.slug = ?
    `,
    [registryStatus, note, slug]
  );
}

async function ensureVerificationReport(connection, values) {
  const existing = await queryRows(
    connection,
    `
      SELECT id
      FROM verification_reports
      WHERE user_id <=> ?
        AND serial_number = ?
        AND report_status = ?
        AND COALESCE(note, '') = ?
      LIMIT 1
    `,
    [
      values.userId || null,
      values.serialNumber,
      values.reportStatus,
      values.note || ""
    ]
  );

  if (existing[0]) {
    return Number(existing[0].id);
  }

  const [result] = await connection.execute(
    `
      INSERT INTO verification_reports (
        user_id,
        part_id,
        dealer_id,
        serial_number,
        seller_name,
        report_status,
        note,
        action_status,
        reviewed_by,
        reviewed_at,
        resolution_note
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      values.userId || null,
      values.partId || null,
      values.dealerId || null,
      values.serialNumber,
      values.sellerName || null,
      values.reportStatus,
      values.note || null,
      values.actionStatus || "open",
      values.reviewedBy || null,
      values.reviewedAt || null,
      values.resolutionNote || null
    ]
  );

  return Number(result.insertId);
}

async function ensureVerificationCheck(connection, values) {
  const existing = await queryRows(
    connection,
    `
      SELECT id
      FROM verification_checks
      WHERE user_id <=> ?
        AND serial_number = ?
        AND result_status = ?
        AND request_source = ?
      LIMIT 1
    `,
    [
      values.userId || null,
      values.serialNumber,
      values.resultStatus,
      values.requestSource || "api"
    ]
  );

  if (existing[0]) {
    return Number(existing[0].id);
  }

  const [result] = await connection.execute(
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      values.userId || null,
      values.partId || null,
      values.dealerId || null,
      values.matchedRegistryId || null,
      values.serialNumber,
      values.resultStatus,
      values.requestSource || "api",
      values.recommendation || null
    ]
  );

  return Number(result.insertId);
}

export async function runSeed(connection) {
  await updateRegistryStatusBySlug(
    connection,
    "toyota-corolla-2024-oil-filter",
    "unverified",
    "Catalog sample flagged as unverified for verification workflow demos."
  );

  await updateRegistryStatusBySlug(
    connection,
    "nissan-qashqai-2024-wiper-blades",
    "suspicious",
    "Catalog sample flagged as suspicious for counterfeit-report workflow demos."
  );

  const [users, parts] = await Promise.all([
    queryRows(
      connection,
      `
        SELECT id, email
        FROM users
        WHERE email IN ('user@autofix.com', 'admin@autofix.com', 'dealer@autofix.com')
      `
    ),
    queryRows(
      connection,
      `
        SELECT
          p.id,
          p.slug,
          p.serial_number AS serialNumber,
          p.dealer_id AS dealerId,
          d.name AS dealerName,
          sr.id AS registryId,
          sr.registry_status AS registryStatus
        FROM parts p
        INNER JOIN dealers d
          ON d.id = p.dealer_id
        LEFT JOIN serial_registry sr
          ON sr.part_id = p.id
         AND sr.serial_number = p.serial_number
        WHERE p.slug IN ('mg-zs-2025-car-battery', 'toyota-corolla-2024-oil-filter', 'nissan-qashqai-2024-wiper-blades')
      `
    )
  ]);

  const userIdByEmail = Object.fromEntries(users.map((row) => [row.email, Number(row.id)]));
  const partBySlug = Object.fromEntries(parts.map((row) => [row.slug, row]));

  const suspiciousPart = partBySlug["nissan-qashqai-2024-wiper-blades"];
  const unverifiedPart = partBySlug["toyota-corolla-2024-oil-filter"];
  const validPart = partBySlug["mg-zs-2025-car-battery"];

  if (suspiciousPart) {
    await ensureVerificationReport(connection, {
      userId: userIdByEmail["user@autofix.com"],
      partId: Number(suspiciousPart.id),
      dealerId: Number(suspiciousPart.dealerId),
      serialNumber: suspiciousPart.serialNumber,
      sellerName: suspiciousPart.dealerName,
      reportStatus: "suspicious",
      note: "Packaging print quality and registry status looked suspicious during graduation demo seeding.",
      actionStatus: "open"
    });
  }

  if (unverifiedPart) {
    await ensureVerificationReport(connection, {
      userId: userIdByEmail["user@autofix.com"],
      partId: Number(unverifiedPart.id),
      dealerId: Number(unverifiedPart.dealerId),
      serialNumber: unverifiedPart.serialNumber,
      sellerName: unverifiedPart.dealerName,
      reportStatus: "unverified",
      note: "User asked the seller for invoice proof after the serial returned unverified.",
      actionStatus: "reviewing",
      reviewedBy: userIdByEmail["admin@autofix.com"] || null,
      reviewedAt: "2026-04-20 10:15:00",
      resolutionNote: "Support team requested extra source documents from the dealer."
    });
  }

  if (validPart) {
    await ensureVerificationCheck(connection, {
      userId: userIdByEmail["user@autofix.com"],
      partId: Number(validPart.id),
      dealerId: Number(validPart.dealerId),
      matchedRegistryId: validPart.registryId ? Number(validPart.registryId) : null,
      serialNumber: validPart.serialNumber,
      resultStatus: "valid",
      requestSource: "verify_page",
      recommendation: "Keep the invoice and proceed with confidence."
    });
  }

  if (unverifiedPart) {
    await ensureVerificationCheck(connection, {
      userId: userIdByEmail["user@autofix.com"],
      partId: Number(unverifiedPart.id),
      dealerId: Number(unverifiedPart.dealerId),
      matchedRegistryId: unverifiedPart.registryId ? Number(unverifiedPart.registryId) : null,
      serialNumber: unverifiedPart.serialNumber,
      resultStatus: "unverified",
      requestSource: "verify_page",
      recommendation: "Ask for invoice proof before purchase."
    });
  }

  if (suspiciousPart) {
    await ensureVerificationCheck(connection, {
      userId: userIdByEmail["user@autofix.com"],
      partId: Number(suspiciousPart.id),
      dealerId: Number(suspiciousPart.dealerId),
      matchedRegistryId: suspiciousPart.registryId ? Number(suspiciousPart.registryId) : null,
      serialNumber: suspiciousPart.serialNumber,
      resultStatus: "suspicious",
      requestSource: "api",
      recommendation: "Do not proceed before the seller is reviewed."
    });
  }
}

export default runSeed;
