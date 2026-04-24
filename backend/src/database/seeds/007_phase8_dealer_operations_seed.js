async function queryRows(connection, sql, params = []) {
  const [rows] = await connection.execute(sql, params);
  return rows;
}

async function executeOne(connection, sql, params = []) {
  await connection.execute(sql, params);
}

async function insertIgnore(connection, sql, params = []) {
  const [result] = await connection.execute(sql, params);
  return Number(result.insertId || 0);
}

function toJson(value) {
  return JSON.stringify(value || {});
}

async function findIdByUnique(connection, table, column, value) {
  const rows = await queryRows(
    connection,
    `SELECT id FROM ${table} WHERE ${column} = ? LIMIT 1`,
    [value]
  );

  return rows[0] ? Number(rows[0].id) : null;
}

export async function runSeed(connection) {
  const [dealers, users, categories, parts, orders, orderItems, accessRows] = await Promise.all([
    queryRows(connection, "SELECT id, slug, name FROM dealers"),
    queryRows(connection, "SELECT id, email, full_name AS fullName FROM users"),
    queryRows(connection, "SELECT id, category_key AS categoryKey, name FROM part_categories"),
    queryRows(
      connection,
      `
        SELECT
          p.id,
          p.slug,
          p.name,
          p.dealer_id AS dealerId,
          p.category_id AS categoryId,
          p.price,
          p.stock_quantity AS stockQuantity
        FROM parts p
      `
    ),
    queryRows(
      connection,
      `
        SELECT
          id,
          order_number AS orderNumber,
          city,
          customer_full_name AS customerFullName
        FROM orders
      `
    ),
    queryRows(
      connection,
      `
        SELECT
          oi.id,
          oi.order_id AS orderId,
          oi.dealer_id AS dealerId,
          oi.part_id AS partId,
          oi.quantity,
          oi.unit_price AS unitPrice,
          oi.status
        FROM order_items oi
      `
    ),
    queryRows(
      connection,
      `
        SELECT
          id,
          user_id AS userId,
          dealer_id AS dealerId,
          brand_id AS brandId,
          can_manage_inventory AS canManageInventory,
          can_view_orders AS canViewOrders,
          can_manage_verification AS canManageVerification,
          can_view_analytics AS canViewAnalytics
        FROM dealer_brand_access
      `
    )
  ]);

  const dealerIdBySlug = Object.fromEntries(dealers.map((row) => [row.slug, Number(row.id)]));
  const userIdByEmail = Object.fromEntries(users.map((row) => [row.email, Number(row.id)]));
  const categoryIdByKey = Object.fromEntries(categories.map((row) => [row.categoryKey, Number(row.id)]));
  const partsByDealer = parts.reduce((result, row) => {
    const dealerId = Number(row.dealerId);
    result[dealerId] = result[dealerId] || [];
    result[dealerId].push(row);
    return result;
  }, {});

  const adminId = userIdByEmail["admin@autofix.com"] || null;
  const normalUserId = userIdByEmail["user@autofix.com"] || null;
  const alMansourId = dealerIdBySlug["al-mansour-automotive"] || null;
  const bavarianId = dealerIdBySlug["bavarian-auto-group"] || null;
  const toyotaEgyptId = dealerIdBySlug["toyota-egypt"] || null;

  const featuredDealerIds = [alMansourId, bavarianId, toyotaEgyptId].filter(Boolean);

  for (const dealerId of featuredDealerIds) {
    const scopedParts = partsByDealer[dealerId] || [];
    for (const [index, part] of scopedParts.slice(0, 6).entries()) {
      const manufacturerName = part.name.toLowerCase().includes("battery")
        ? "Bosch"
        : part.name.toLowerCase().includes("brake")
          ? "Brembo"
          : "AutoFix Certified Supplier";
      const warrantyMonths = part.name.toLowerCase().includes("battery") ? 18 : 12;
      const technicalSpecs = {
        sku: part.slug.toUpperCase(),
        fitmentApproved: true,
        stockBand: Number(part.stockQuantity) <= 5 ? "low" : "healthy",
        serviceWindowMonths: 12 + index
      };

      await executeOne(
        connection,
        `
          UPDATE parts
          SET manufacturer_name = ?,
              warranty_months = ?,
              technical_specs = ?,
              archive_reason = NULL
          WHERE id = ?
        `,
        [manufacturerName, warrantyMonths, toJson(technicalSpecs), Number(part.id)]
      );
    }
  }

  const helpArticles = [
    {
      category: "Inventory",
      title: "How to add a fitment-ready spare part",
      summary: "Create a listing with clean pricing, category, part number, and compatibility coverage.",
      content: "To add a listing, choose the correct category, set the official part number, upload clear images, then attach every supported model year before saving the product."
    },
    {
      category: "Orders",
      title: "How to handle routed customer orders",
      summary: "Update order status in sequence and add tracking details when shipping starts.",
      content: "AutoFix routes order lines to the correct dealer. Use the order board to confirm the request, move it to preparing, then ship with carrier and tracking number."
    },
    {
      category: "Support",
      title: "How to request platform support",
      summary: "Open a support ticket for payout, verification, or shipping issues.",
      content: "If a verification result, shipping mapping, or listing issue needs platform help, open a high-priority ticket and attach the order number or part number."
    }
  ];

  for (const [index, article] of helpArticles.entries()) {
    await executeOne(
      connection,
      `
        INSERT INTO dealer_help_articles (category, title, summary, content, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `,
      [article.category, article.title, article.summary, article.content, index + 1]
    );
  }

  const shippingSeeds = [
    {
      dealerId: alMansourId,
      carrierName: "Bosta",
      regionName: "Cairo",
      baseFee: 35,
      feePerItem: 10,
      minDays: 1,
      maxDays: 2
    },
    {
      dealerId: alMansourId,
      carrierName: "Aramex",
      regionName: "Giza",
      baseFee: 42,
      feePerItem: 12,
      minDays: 1,
      maxDays: 3
    },
    {
      dealerId: bavarianId,
      carrierName: "DHL",
      regionName: "Nationwide",
      baseFee: 60,
      feePerItem: 15,
      minDays: 2,
      maxDays: 4
    },
    {
      dealerId: toyotaEgyptId,
      carrierName: "Bosta",
      regionName: "Alexandria",
      baseFee: 38,
      feePerItem: 9,
      minDays: 1,
      maxDays: 2
    }
  ].filter((item) => item.dealerId);

  for (const method of shippingSeeds) {
    await executeOne(
      connection,
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
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [
        method.dealerId,
        method.carrierName,
        method.regionName,
        method.baseFee,
        method.feePerItem,
        method.minDays,
        method.maxDays
      ]
    );
  }

  for (const dealerId of featuredDealerIds) {
    const scopedParts = (partsByDealer[dealerId] || []).slice(0, 4);
    for (const [index, part] of scopedParts.entries()) {
      await executeOne(
        connection,
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
          VALUES (?, ?, 'restock', ?, ?, ?, ?)
        `,
        [
          dealerId,
          Number(part.id),
          12 + index,
          Math.max(40, Number(part.price) * 0.56),
          `Initial warehouse refill for ${part.name}.`,
          adminId
        ]
      );

      await executeOne(
        connection,
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
          VALUES (?, ?, 'correction', ?, NULL, ?, ?)
        `,
        [
          dealerId,
          Number(part.id),
          -1,
          "Cycle count alignment after shelf review.",
          adminId
        ]
      );
    }
  }

  for (const orderItem of orderItems) {
    await executeOne(
      connection,
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
        VALUES (?, ?, 'sale', ?, NULL, ?, NULL)
      `,
      [
        Number(orderItem.dealerId),
        Number(orderItem.partId),
        -Math.max(1, Number(orderItem.quantity || 1)),
        `Order line ${orderItem.id} reduced stock through checkout.`
      ]
    );
  }

  const offerSeeds = [
    {
      dealerId: alMansourId,
      title: "Weekend battery campaign",
      description: "Push MG battery sales with an AutoFix-backed weekend reduction.",
      scopeType: "part",
      partId: (partsByDealer[alMansourId] || []).find((item) => item.slug.includes("car-battery"))?.id || null,
      categoryId: null,
      discountType: "percentage",
      discountValue: 8,
      startsAt: "2026-04-20 00:00:00",
      endsAt: "2026-04-30 23:59:59",
      isActive: 1
    },
    {
      dealerId: bavarianId,
      title: "Brake service campaign",
      description: "Lower-priced brake parts for BMW and Mercedes demand peaks.",
      scopeType: "category",
      partId: null,
      categoryId: categoryIdByKey["brakes"] || null,
      discountType: "percentage",
      discountValue: 12,
      startsAt: "2026-04-18 00:00:00",
      endsAt: "2026-05-10 23:59:59",
      isActive: 1
    }
  ].filter((offer) => offer.dealerId && (offer.partId || offer.categoryId));

  for (const offer of offerSeeds) {
    await executeOne(
      connection,
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
        offer.dealerId,
        offer.title,
        offer.description,
        offer.scopeType,
        offer.partId,
        offer.categoryId,
        offer.discountType,
        offer.discountValue,
        offer.startsAt,
        offer.endsAt,
        offer.isActive
      ]
    );
  }

  const couponSeeds = [
    {
      dealerId: alMansourId,
      code: "MGVIP10",
      title: "MG VIP loyalty",
      description: "Targeted coupon for repeat MG buyers.",
      discountType: "percentage",
      discountValue: 10,
      minimumOrderValue: 1200,
      usageLimit: 50,
      targetUserId: normalUserId
    },
    {
      dealerId: toyotaEgyptId,
      code: "TOYOTA150",
      title: "Toyota direct discount",
      description: "Flat discount for selected Toyota customers.",
      discountType: "fixed",
      discountValue: 150,
      minimumOrderValue: 1800,
      usageLimit: 20,
      targetUserId: normalUserId
    }
  ].filter((coupon) => coupon.dealerId);

  for (const coupon of couponSeeds) {
    const couponId = await insertIgnore(
      connection,
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026-04-20 00:00:00', '2026-05-20 23:59:59', 1)
      `,
      [
        coupon.dealerId,
        coupon.code,
        coupon.title,
        coupon.description,
        coupon.discountType,
        coupon.discountValue,
        coupon.minimumOrderValue,
        coupon.usageLimit
      ]
    );

    const resolvedCouponId = couponId || await findIdByUnique(connection, "dealer_coupons", "code", coupon.code);
    if (resolvedCouponId && coupon.targetUserId) {
      await executeOne(
        connection,
        `
          INSERT INTO dealer_coupon_targets (coupon_id, user_id)
          VALUES (?, ?)
        `,
        [resolvedCouponId, coupon.targetUserId]
      );
    }
  }

  for (const order of orders) {
    const relatedItems = orderItems.filter((item) => Number(item.orderId) === Number(order.id));
    for (const orderItem of relatedItems) {
      await executeOne(
        connection,
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
          VALUES (?, ?, 'new_order', ?, ?, 'order_item', ?, 0)
        `,
        [
          Number(orderItem.dealerId),
          normalUserId,
          `New order routed: ${order.orderNumber}`,
          `${order.customerFullName} placed an order for line ${orderItem.id}. Review preparation and shipping details.`,
          Number(orderItem.id)
        ]
      );
    }
  }

  for (const dealerId of featuredDealerIds) {
    const lowStockParts = (partsByDealer[dealerId] || []).filter((part) => Number(part.stockQuantity) <= 6).slice(0, 2);
    for (const part of lowStockParts) {
      await executeOne(
        connection,
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
          VALUES (?, NULL, 'low_stock', ?, ?, 'part', ?, 0)
        `,
        [
          dealerId,
          `Low stock alert: ${part.name}`,
          `${part.name} is down to ${part.stockQuantity} units. Plan a restock to avoid missing routed orders.`,
          Number(part.id)
        ]
      );
    }
  }

  const firstOrderItem = orderItems[0] ? Number(orderItems[0].id) : null;
  const firstOrderDealerId = orderItems[0] ? Number(orderItems[0].dealerId) : alMansourId;

  if (firstOrderDealerId) {
    await executeOne(
      connection,
      `
        INSERT INTO dealer_customer_feedback (
          dealer_id,
          user_id,
          order_item_id,
          complaint_type,
          rating,
          message,
          is_resolved
        )
        VALUES (?, ?, ?, 'review', 5, ?, 0)
      `,
      [
        firstOrderDealerId,
        normalUserId,
        firstOrderItem,
        "Fast confirmation and the part matched the car exactly."
      ]
    );

    await executeOne(
      connection,
      `
        INSERT INTO dealer_customer_feedback (
          dealer_id,
          user_id,
          order_item_id,
          complaint_type,
          rating,
          message,
          is_resolved
        )
        VALUES (?, ?, ?, 'complaint', NULL, ?, 0)
      `,
      [
        firstOrderDealerId,
        normalUserId,
        firstOrderItem,
        "Customer asked for clearer delivery ETA updates after order confirmation."
      ]
    );

    await executeOne(
      connection,
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
        VALUES (?, ?, 'customer_feedback', ?, ?, 'feedback', NULL, 0)
      `,
      [
        firstOrderDealerId,
        normalUserId,
        "New customer feedback received",
        "One review and one complaint were added to your dealer record. Review the feedback board for details."
      ]
    );
  }

  const supportSeeds = [
    {
      dealerId: alMansourId,
      userId: userIdByEmail["dealer@autofix.com"] || adminId,
      subject: "Need help mapping Cairo shipping fees",
      message: "The dealer team wants to update region-based shipping costs for Cairo and Giza with clearer carrier logic.",
      priority: "normal",
      status: "in_progress",
      adminReply: "Support started reviewing your shipping setup. We will keep the ticket updated after checking carrier regions."
    },
    {
      dealerId: bavarianId,
      userId: userIdByEmail["premium@autofix.com"] || adminId,
      subject: "Verification queue clarification",
      message: "Please confirm the right workflow for handling suspicious serials before escalating them to AutoFix admin review.",
      priority: "high",
      status: "open",
      adminReply: null
    }
  ].filter((ticket) => ticket.dealerId && ticket.userId);

  for (const ticket of supportSeeds) {
    const resolvedAt = ticket.status === "resolved" ? "2026-04-22 15:00:00" : null;
    await executeOne(
      connection,
      `
        INSERT INTO dealer_support_tickets (
          dealer_id,
          created_by_user_id,
          subject,
          message,
          priority,
          status,
          admin_reply,
          resolved_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        ticket.dealerId,
        ticket.userId,
        ticket.subject,
        ticket.message,
        ticket.priority,
        ticket.status,
        ticket.adminReply,
        resolvedAt
      ]
    );
  }

  for (const access of accessRows) {
    if (!Number(access.canViewOrders || 0) && !Number(access.canManageInventory || 0)) {
      await executeOne(
        connection,
        `
          UPDATE dealer_brand_access
          SET can_view_orders = 1,
              can_manage_inventory = 1
          WHERE id = ?
        `,
        [Number(access.id)]
      );
    }
  }
}

export default runSeed;
