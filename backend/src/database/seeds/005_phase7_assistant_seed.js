async function queryRows(connection, sql, params = []) {
  const [rows] = await connection.execute(sql, params);
  return rows;
}

async function insertIfMissing(connection, values) {
  const existing = await queryRows(
    connection,
    `
      SELECT id
      FROM assistant_logs
      WHERE user_id <=> ?
        AND session_type = ?
        AND locale_code = ?
        AND user_message = ?
      LIMIT 1
    `,
    [
      values.userId || null,
      values.sessionType,
      values.localeCode,
      values.userMessage
    ]
  );

  if (existing[0]) {
    return Number(existing[0].id);
  }

  const [result] = await connection.execute(
    `
      INSERT INTO assistant_logs (
        user_id,
        dealer_id,
        session_type,
        intent,
        user_message,
        assistant_response,
        status,
        locale_code,
        suggested_action,
        context_snapshot
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      values.userId || null,
      values.dealerId || null,
      values.sessionType,
      values.intent || null,
      values.userMessage,
      values.assistantResponse,
      values.status || "completed",
      values.localeCode || "en",
      values.suggestedAction || null,
      JSON.stringify(values.contextSnapshot || {})
    ]
  );

  return Number(result.insertId);
}

export async function runSeed(connection) {
  const [users, dealers] = await Promise.all([
    queryRows(
      connection,
      `
        SELECT id, email
        FROM users
        WHERE email IN ('user@autofix.com', 'dealer@autofix.com')
      `
    ),
    queryRows(
      connection,
      `
        SELECT id, slug
        FROM dealers
        WHERE slug IN ('al-mansour-automotive', 'toyota-egypt')
      `
    )
  ]);

  const userIdByEmail = Object.fromEntries(users.map((row) => [row.email, Number(row.id)]));
  const dealerIdBySlug = Object.fromEntries(dealers.map((row) => [row.slug, Number(row.id)]));

  await insertIfMissing(connection, {
    userId: userIdByEmail["user@autofix.com"],
    dealerId: dealerIdBySlug["toyota-egypt"] || null,
    sessionType: "parts_search",
    intent: "parts_search:brakepads",
    userMessage: "I need brake pads for Toyota Corolla 2025",
    assistantResponse: "I found fitment-ready brake pads for Toyota Corolla 2025. The original option is matched to Toyota Egypt and you can verify the serial before checkout.",
    status: "completed",
    localeCode: "en",
    suggestedAction: "show_results",
    contextSnapshot: {
      brandKey: "toyota",
      modelKey: "toyota-corolla",
      year: 2025
    }
  });

  await insertIfMissing(connection, {
    userId: userIdByEmail["user@autofix.com"],
    dealerId: dealerIdBySlug["al-mansour-automotive"] || null,
    sessionType: "fault_diagnosis",
    intent: "fault_diagnosis:starting_issue",
    userMessage: "العربية مش بتدور وفيه صوت تك تك",
    assistantResponse: "أقرب احتمال إن البطارية ضعيفة أو في مشكلة في التوصيلات أو المارش. لو العربية مش راضية تدور خالص، الأفضل تبدأ بفحص البطارية والشحن الأول، ولو الوضع زاد اطلب سحب أو فحص عند الوكيل.",
    status: "completed",
    localeCode: "ar-eg",
    suggestedAction: "book_inspection",
    contextSnapshot: {
      brandKey: "mg",
      modelKey: "mg-zs",
      year: 2025
    }
  });
}

export default runSeed;
