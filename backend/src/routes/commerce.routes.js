import { Router } from "express";
import { query, withTransaction } from "../config/database.js";
import { requireAuth } from "../middleware/authenticate.js";
import { getBrandPresentation, getDealerPresentation, getModelPresentation } from "../lib/catalog-data.js";

const router = Router();

const SHIPPING_FEE = 15;
const VALID_FULFILLMENT_METHODS = new Set(["delivery", "pickup"]);
const VALID_PAYMENT_METHODS = new Set(["cash", "card"]);
const LOW_STOCK_THRESHOLD = 5;

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function formatEnum(value, fallback) {
  if (!value) {
    return fallback;
  }

  return String(value)
    .trim()
    .toLowerCase();
}

function buildOrderNumber() {
  const now = new Date();
  const compactDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");
  const token = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AF-${compactDate}-${token}`;
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

async function insertDealerNotification(connection, payload) {
  await connection.execute(
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
}

async function maybeCreateLowStockNotification(connection, { dealerId, partId, partName, stockQuantity }) {
  if (Number(stockQuantity) > LOW_STOCK_THRESHOLD) {
    return;
  }

  const [existingRows] = await connection.execute(
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
    [Number(dealerId), Number(partId)]
  );

  if (existingRows[0]) {
    return;
  }

  await insertDealerNotification(connection, {
    dealerId,
    notificationType: "low_stock",
    title: `Low stock alert: ${partName}`,
    message: `${partName} is down to ${stockQuantity} units after the latest order.`,
    referenceType: "part",
    referenceId: partId
  });
}

async function ensureCartId(userId) {
  await query(
    `
      INSERT IGNORE INTO carts (user_id)
      VALUES (:userId)
    `,
    { userId }
  );

  const rows = await query(
    `
      SELECT id
      FROM carts
      WHERE user_id = :userId
      LIMIT 1
    `,
    { userId }
  );

  return rows[0] ? Number(rows[0].id) : null;
}

async function resolvePart({ partId = null, partSlug = "" } = {}) {
  const normalizedId = Number(partId || 0);
  const normalizedSlug = String(partSlug || "").trim();

  if (!normalizedId && !normalizedSlug) {
    throw createError("Part reference is required");
  }

  const rows = await query(
    `
      SELECT
        p.id,
        p.slug,
        p.name,
        p.part_number AS partNumber,
        p.part_type AS partType,
        p.price,
        p.rating,
        p.stock_quantity AS stockQuantity,
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

  if (!rows[0]) {
    throw createError("Part not found", 404);
  }

  return rows[0];
}

async function resolveVehicleFitment({ partId, modelKey, year }) {
  const normalizedModelKey = String(modelKey || "").trim().toLowerCase();
  const normalizedYear = Number(year || 0);

  if (!normalizedModelKey || !normalizedYear) {
    return null;
  }

  const rows = await query(
    `
      SELECT
        m.id AS modelId,
        m.model_key AS modelKey,
        m.name AS modelName,
        vy.id AS vehicleYearId,
        vy.year_value AS yearValue
      FROM part_compatibility pc
      INNER JOIN models m
        ON m.id = pc.model_id
      INNER JOIN vehicle_years vy
        ON vy.id = pc.vehicle_year_id
      WHERE pc.part_id = :partId
        AND m.model_key = :modelKey
        AND vy.year_value = :yearValue
      LIMIT 1
    `,
    {
      partId,
      modelKey: normalizedModelKey,
      yearValue: normalizedYear
    }
  );

  if (!rows[0]) {
    throw createError("This part is not compatible with the selected vehicle", 400);
  }

  return {
    modelId: Number(rows[0].modelId),
    modelKey: rows[0].modelKey,
    modelName: rows[0].modelName,
    vehicleYearId: Number(rows[0].vehicleYearId),
    yearValue: Number(rows[0].yearValue)
  };
}

function mapCartRows(rows) {
  const items = rows.map((row) => {
    const quantity = Number(row.quantity || 0);
    const unitPrice = Number(row.price || 0);
    const lineTotal = Number((quantity * unitPrice).toFixed(2));

    return {
      cartItemId: Number(row.cartItemId),
      quantity,
      lineTotal,
      part: {
        id: Number(row.partId),
        slug: row.slug,
        name: row.name,
        image: row.imageUrl || "./pictures/autofix logo.png",
        type: row.partType === "original" ? "Original" : "Aftermarket",
        price: unitPrice,
        rating: Number(row.rating || 0),
        stockQuantity: Number(row.stockQuantity || 0),
        partNumber: row.partNumber,
        serialNumber: row.serialNumber
      },
      dealer: {
        id: Number(row.dealerId),
        name: row.dealerName,
        slug: row.dealerSlug,
        image: getDealerPresentation(row.dealerSlug).image
      },
      brand: {
        id: Number(row.brandId),
        key: row.brandKey,
        name: row.brandName,
        logo: getBrandPresentation(row.brandKey).logo
      },
      vehicle: row.modelId && row.yearValue
        ? {
          id: Number(row.modelId),
          key: row.modelKey,
          name: row.modelName,
          image: getModelPresentation(row.modelKey)?.image || "./pictures/autofix logo.png",
          year: Number(row.yearValue)
        }
        : null
    };
  });

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));

  return {
    items,
    summary: {
      uniqueItems: items.length,
      itemCount,
      subtotal,
      estimatedShipping: items.length ? SHIPPING_FEE : 0,
      estimatedTotal: subtotal + (items.length ? SHIPPING_FEE : 0)
    }
  };
}

async function loadCartState(userId) {
  const cartId = await ensureCartId(userId);

  const rows = await query(
    `
      SELECT
        c.id AS cartId,
        ci.id AS cartItemId,
        ci.quantity,
        p.id AS partId,
        p.slug,
        p.name,
        p.part_number AS partNumber,
        p.part_type AS partType,
        p.price,
        p.rating,
        p.stock_quantity AS stockQuantity,
        p.image_url AS imageUrl,
        p.serial_number AS serialNumber,
        d.id AS dealerId,
        d.name AS dealerName,
        d.slug AS dealerSlug,
        b.id AS brandId,
        b.brand_key AS brandKey,
        b.name AS brandName,
        m.id AS modelId,
        m.model_key AS modelKey,
        m.name AS modelName,
        vy.year_value AS yearValue
      FROM carts c
      LEFT JOIN cart_items ci
        ON ci.cart_id = c.id
      LEFT JOIN parts p
        ON p.id = ci.part_id
      LEFT JOIN dealers d
        ON d.id = p.dealer_id
      LEFT JOIN brands b
        ON b.id = p.brand_id
      LEFT JOIN models m
        ON m.id = ci.model_id
      LEFT JOIN vehicle_years vy
        ON vy.id = ci.vehicle_year_id
      WHERE c.user_id = :userId
        AND (ci.id IS NULL OR p.active = 1)
      ORDER BY ci.created_at DESC, ci.id DESC
    `,
    { userId }
  );

  const nonEmptyRows = rows.filter((row) => row.cartItemId);
  const cartData = mapCartRows(nonEmptyRows);

  return {
    cartId,
    ...cartData
  };
}

async function loadOrdersList(userId) {
  const rows = await query(
    `
      SELECT
        o.id,
        o.order_number AS orderNumber,
        o.status,
        o.fulfillment_method AS fulfillmentMethod,
        o.payment_method AS paymentMethod,
        o.subtotal,
        o.shipping_fee AS shippingFee,
        o.total_amount AS totalAmount,
        o.created_at AS createdAt,
        COUNT(oi.id) AS itemCount,
        GROUP_CONCAT(DISTINCT d.name ORDER BY d.name SEPARATOR ' / ') AS dealerNames,
        SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT p.name ORDER BY p.name SEPARATOR ' / '), ' / ', 3) AS previewParts
      FROM orders o
      LEFT JOIN order_items oi
        ON oi.order_id = o.id
      LEFT JOIN dealers d
        ON d.id = oi.dealer_id
      LEFT JOIN parts p
        ON p.id = oi.part_id
      WHERE o.user_id = :userId
      GROUP BY
        o.id,
        o.order_number,
        o.status,
        o.fulfillment_method,
        o.payment_method,
        o.subtotal,
        o.shipping_fee,
        o.total_amount,
        o.created_at
      ORDER BY o.created_at DESC, o.id DESC
    `,
    { userId }
  );

  return rows.map((row) => ({
    id: Number(row.id),
    orderNumber: row.orderNumber,
    status: row.status,
    fulfillmentMethod: row.fulfillmentMethod,
    paymentMethod: row.paymentMethod,
    subtotal: Number(row.subtotal || 0),
    shippingFee: Number(row.shippingFee || 0),
    totalAmount: Number(row.totalAmount || 0),
    itemCount: Number(row.itemCount || 0),
    dealerNames: row.dealerNames || "",
    previewParts: row.previewParts || "",
    createdAt: row.createdAt
  }));
}

async function loadOrderDetails(orderId, userId) {
  const orderRows = await query(
    `
      SELECT
        o.id,
        o.order_number AS orderNumber,
        o.customer_full_name AS customerFullName,
        o.phone,
        o.address_line AS addressLine,
        o.city,
        o.fulfillment_method AS fulfillmentMethod,
        o.payment_method AS paymentMethod,
        o.status,
        o.subtotal,
        o.shipping_fee AS shippingFee,
        o.total_amount AS totalAmount,
        o.created_at AS createdAt
      FROM orders o
      WHERE o.id = :orderId
        AND o.user_id = :userId
      LIMIT 1
    `,
    { orderId, userId }
  );

  if (!orderRows[0]) {
    throw createError("Order not found", 404);
  }

  const itemRows = await query(
    `
      SELECT
        oi.id,
        oi.quantity,
        oi.unit_price AS unitPrice,
        oi.line_total AS lineTotal,
        oi.status,
        p.id AS partId,
        p.slug,
        p.name,
        p.part_type AS partType,
        p.image_url AS imageUrl,
        d.id AS dealerId,
        d.name AS dealerName,
        d.slug AS dealerSlug,
        b.id AS brandId,
        b.brand_key AS brandKey,
        b.name AS brandName,
        m.id AS modelId,
        m.model_key AS modelKey,
        m.name AS modelName,
        vy.year_value AS yearValue
      FROM order_items oi
      INNER JOIN parts p
        ON p.id = oi.part_id
      INNER JOIN dealers d
        ON d.id = oi.dealer_id
      INNER JOIN brands b
        ON b.id = p.brand_id
      LEFT JOIN models m
        ON m.id = oi.model_id
      LEFT JOIN vehicle_years vy
        ON vy.id = oi.vehicle_year_id
      WHERE oi.order_id = :orderId
      ORDER BY oi.id ASC
    `,
    { orderId }
  );

  return {
    id: Number(orderRows[0].id),
    orderNumber: orderRows[0].orderNumber,
    customerFullName: orderRows[0].customerFullName,
    phone: orderRows[0].phone,
    addressLine: orderRows[0].addressLine,
    city: orderRows[0].city,
    customer: {
      fullName: orderRows[0].customerFullName,
      phone: orderRows[0].phone,
      address: orderRows[0].addressLine,
      city: orderRows[0].city
    },
    fulfillmentMethod: orderRows[0].fulfillmentMethod,
    paymentMethod: orderRows[0].paymentMethod,
    status: orderRows[0].status,
    subtotal: Number(orderRows[0].subtotal || 0),
    shippingFee: Number(orderRows[0].shippingFee || 0),
    totalAmount: Number(orderRows[0].totalAmount || 0),
    shipping: Number(orderRows[0].shippingFee || 0),
    total: Number(orderRows[0].totalAmount || 0),
    createdAt: orderRows[0].createdAt,
    items: itemRows.map((row) => ({
      id: Number(row.id),
      quantity: Number(row.quantity || 0),
      unitPrice: Number(row.unitPrice || 0),
      lineTotal: Number(row.lineTotal || 0),
      status: row.status,
      name: row.name,
      image: row.imageUrl || "./pictures/autofix logo.png",
      type: row.partType === "original" ? "Original" : "Aftermarket",
      part: {
        id: Number(row.partId),
        slug: row.slug,
        name: row.name,
        image: row.imageUrl || "./pictures/autofix logo.png",
        type: row.partType === "original" ? "Original" : "Aftermarket"
      },
      dealer: {
        id: Number(row.dealerId),
        name: row.dealerName,
        slug: row.dealerSlug,
        image: getDealerPresentation(row.dealerSlug).image
      },
      brand: {
        id: Number(row.brandId),
        key: row.brandKey,
        name: row.brandName,
        logo: getBrandPresentation(row.brandKey).logo
      },
      vehicle: row.modelId && row.yearValue
        ? {
          id: Number(row.modelId),
          key: row.modelKey,
          name: row.modelName,
          image: getModelPresentation(row.modelKey)?.image || "./pictures/autofix logo.png",
          year: Number(row.yearValue)
        }
        : null
    }))
  };
}

router.get("/cart", requireAuth, async (req, res, next) => {
  try {
    const data = await loadCartState(req.auth.user.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/cart/sync", requireAuth, async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const userId = req.auth.user.id;
    const cartId = await ensureCartId(userId);

    await withTransaction(async (connection) => {
      for (const item of items) {
        const quantity = Math.max(1, Math.min(20, Number(item?.quantity || 1)));
        const part = await resolvePart({
          partId: item?.partId,
          partSlug: item?.slug
        });
        const fitment = await resolveVehicleFitment({
          partId: part.id,
          modelKey: item?.modelKey,
          year: item?.year
        });

        const [existingRows] = await connection.execute(
          `
            SELECT id, quantity
            FROM cart_items
            WHERE cart_id = ?
              AND part_id = ?
              AND (
                (? IS NULL AND vehicle_year_id IS NULL)
                OR vehicle_year_id = ?
              )
            LIMIT 1
          `,
          [cartId, part.id, fitment?.vehicleYearId || null, fitment?.vehicleYearId || null]
        );

        if (existingRows[0]) {
          await connection.execute(
            `
              UPDATE cart_items
              SET quantity = LEAST(quantity + ?, 20),
                  model_id = ?,
                  vehicle_year_id = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            [
              quantity,
              fitment?.modelId || null,
              fitment?.vehicleYearId || null,
              existingRows[0].id
            ]
          );
        } else {
          await connection.execute(
            `
              INSERT INTO cart_items (cart_id, part_id, model_id, vehicle_year_id, quantity)
              VALUES (?, ?, ?, ?, ?)
            `,
            [cartId, part.id, fitment?.modelId || null, fitment?.vehicleYearId || null, quantity]
          );
        }
      }
    });

    const data = await loadCartState(userId);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/cart/items", requireAuth, async (req, res, next) => {
  try {
    const quantity = Math.max(1, Math.min(20, Number(req.body?.quantity || 1)));
    const part = await resolvePart({
      partId: req.body?.partId,
      partSlug: req.body?.partSlug || req.body?.slug
    });
    const fitment = await resolveVehicleFitment({
      partId: part.id,
      modelKey: req.body?.modelKey,
      year: req.body?.year
    });

    const userId = req.auth.user.id;
    const cartId = await ensureCartId(userId);

    await withTransaction(async (connection) => {
      const [existingRows] = await connection.execute(
        `
          SELECT id
          FROM cart_items
          WHERE cart_id = ?
            AND part_id = ?
            AND (
              (? IS NULL AND vehicle_year_id IS NULL)
              OR vehicle_year_id = ?
            )
          LIMIT 1
        `,
        [cartId, part.id, fitment?.vehicleYearId || null, fitment?.vehicleYearId || null]
      );

      if (existingRows[0]) {
        await connection.execute(
          `
            UPDATE cart_items
            SET quantity = LEAST(quantity + ?, 20),
                model_id = ?,
                vehicle_year_id = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [
            quantity,
            fitment?.modelId || null,
            fitment?.vehicleYearId || null,
            existingRows[0].id
          ]
        );
      } else {
        await connection.execute(
          `
            INSERT INTO cart_items (cart_id, part_id, model_id, vehicle_year_id, quantity)
            VALUES (?, ?, ?, ?, ?)
          `,
          [cartId, part.id, fitment?.modelId || null, fitment?.vehicleYearId || null, quantity]
        );
      }
    });

    const data = await loadCartState(userId);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch("/cart/items/:cartItemId", requireAuth, async (req, res, next) => {
  try {
    const cartItemId = Number(req.params.cartItemId || 0);
    const quantity = Number(req.body?.quantity || 0);
    if (!cartItemId) {
      throw createError("Cart item was not found", 404);
    }

    if (quantity < 1 || quantity > 20) {
      throw createError("Quantity must be between 1 and 20");
    }

    const rows = await query(
      `
        SELECT ci.id
        FROM cart_items ci
        INNER JOIN carts c
          ON c.id = ci.cart_id
        WHERE ci.id = :cartItemId
          AND c.user_id = :userId
        LIMIT 1
      `,
      {
        cartItemId,
        userId: req.auth.user.id
      }
    );

    if (!rows[0]) {
      throw createError("Cart item was not found", 404);
    }

    await query(
      `
        UPDATE cart_items
        SET quantity = :quantity,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = :cartItemId
      `,
      { quantity, cartItemId }
    );

    const data = await loadCartState(req.auth.user.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.delete("/cart/items/:cartItemId", requireAuth, async (req, res, next) => {
  try {
    const cartItemId = Number(req.params.cartItemId || 0);
    if (!cartItemId) {
      throw createError("Cart item was not found", 404);
    }

    await query(
      `
        DELETE ci
        FROM cart_items ci
        INNER JOIN carts c
          ON c.id = ci.cart_id
        WHERE ci.id = :cartItemId
          AND c.user_id = :userId
      `,
      {
        cartItemId,
        userId: req.auth.user.id
      }
    );

    const data = await loadCartState(req.auth.user.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.delete("/cart", requireAuth, async (req, res, next) => {
  try {
    const cartId = await ensureCartId(req.auth.user.id);
    await query("DELETE FROM cart_items WHERE cart_id = :cartId", { cartId });
    const data = await loadCartState(req.auth.user.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post("/orders/checkout", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth.user.id;
    const fullName = String(req.body?.fullName || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const addressLine = String(req.body?.address || req.body?.addressLine || "").trim();
    const city = String(req.body?.city || "").trim();
    const fulfillmentMethod = formatEnum(req.body?.fulfillmentMethod, "delivery");
    const paymentMethod = formatEnum(req.body?.paymentMethod, "cash");

    if (!fullName || !phone || !addressLine || !city) {
      throw createError("Full name, phone, address, and city are required");
    }

    if (!VALID_FULFILLMENT_METHODS.has(fulfillmentMethod)) {
      throw createError("Choose a valid fulfillment method");
    }

    if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
      throw createError("Choose a valid payment method");
    }

    const cartId = await ensureCartId(userId);
    const cartRows = await query(
      `
        SELECT
          ci.id AS cartItemId,
          ci.quantity,
          ci.model_id AS modelId,
          ci.vehicle_year_id AS vehicleYearId,
          p.id AS partId,
          p.price,
          p.stock_quantity AS stockQuantity,
          p.dealer_id AS dealerId
        FROM cart_items ci
        INNER JOIN parts p
          ON p.id = ci.part_id
        WHERE ci.cart_id = :cartId
          AND p.active = 1
      `,
      { cartId }
    );

    if (!cartRows.length) {
      throw createError("Your cart is empty", 400);
    }

    for (const row of cartRows) {
      if (Number(row.quantity) > Number(row.stockQuantity)) {
        throw createError("One or more parts are no longer available in the requested quantity", 409);
      }
    }

    const subtotal = Number(
      cartRows.reduce((sum, row) => sum + Number(row.price) * Number(row.quantity), 0).toFixed(2)
    );
    const shippingFee = fulfillmentMethod === "delivery" ? SHIPPING_FEE : 0;
    const totalAmount = Number((subtotal + shippingFee).toFixed(2));
    const orderNumber = buildOrderNumber();

    let createdOrderId = null;

    await withTransaction(async (connection) => {
      const dealerOrderSummary = new Map();

      const [orderResult] = await connection.execute(
        `
          INSERT INTO orders (
            user_id,
            order_number,
            customer_full_name,
            phone,
            address_line,
            city,
            fulfillment_method,
            payment_method,
            status,
            subtotal,
            shipping_fee,
            total_amount
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)
        `,
        [
          userId,
          orderNumber,
          fullName,
          phone,
          addressLine,
          city,
          fulfillmentMethod,
          paymentMethod,
          subtotal,
          shippingFee,
          totalAmount
        ]
      );

      createdOrderId = Number(orderResult.insertId);

      for (const row of cartRows) {
        const quantity = Number(row.quantity);
        const unitPrice = Number(row.price);
        const lineTotal = Number((quantity * unitPrice).toFixed(2));
        const dealerId = Number(row.dealerId);
        const partId = Number(row.partId);
        const nextStockQuantity = Math.max(0, Number(row.stockQuantity || 0) - quantity);

        const [orderItemResult] = await connection.execute(
          `
            INSERT INTO order_items (
              order_id,
              part_id,
              dealer_id,
              model_id,
              vehicle_year_id,
              quantity,
              unit_price,
              line_total,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
          `,
          [
            createdOrderId,
            partId,
            dealerId,
            row.modelId ? Number(row.modelId) : null,
            row.vehicleYearId ? Number(row.vehicleYearId) : null,
            quantity,
            unitPrice,
            lineTotal
          ]
        );

        await connection.execute(
          `
            UPDATE parts
            SET stock_quantity = GREATEST(stock_quantity - ?, 0),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [quantity, partId]
        );

        await createInventoryMovement(connection, {
          dealerId,
          partId,
          movementType: "sale",
          quantityDelta: -quantity,
          note: `Checkout sale for order ${orderNumber}.`,
          createdByUserId: userId
        });

        await maybeCreateLowStockNotification(connection, {
          dealerId,
          partId,
          partName: row.name,
          stockQuantity: nextStockQuantity
        });

        const currentDealerSummary = dealerOrderSummary.get(dealerId) || {
          dealerId,
          dealerName: row.dealerName || "Dealer",
          itemCount: 0,
          orderItemIds: []
        };
        currentDealerSummary.itemCount += quantity;
        currentDealerSummary.orderItemIds.push(Number(orderItemResult.insertId || 0));
        dealerOrderSummary.set(dealerId, currentDealerSummary);
      }

      for (const dealerSummary of dealerOrderSummary.values()) {
        await insertDealerNotification(connection, {
          dealerId: dealerSummary.dealerId,
          notificationType: "new_order",
          title: `New order routed: ${orderNumber}`,
          message: `${dealerSummary.itemCount} item(s) were routed to ${dealerSummary.dealerName} in a new customer order.`,
          referenceType: "order",
          referenceId: createdOrderId
        });
      }

      await connection.execute(
        `
          UPDATE users
          SET full_name = ?,
              phone = ?,
              address_line = ?,
              city = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [fullName, phone, addressLine, city, userId]
      );

      await connection.execute("DELETE FROM cart_items WHERE cart_id = ?", [cartId]);
    });

    const order = await loadOrderDetails(createdOrderId, userId);
    res.status(201).json({
      success: true,
      data: {
        order
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/orders", requireAuth, async (req, res, next) => {
  try {
    const orders = await loadOrdersList(req.auth.user.id);
    res.json({
      success: true,
      data: {
        orders
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/orders/latest", requireAuth, async (req, res, next) => {
  try {
    const orders = await loadOrdersList(req.auth.user.id);
    if (!orders[0]) {
      throw createError("No orders found", 404);
    }

    const order = await loadOrderDetails(orders[0].id, req.auth.user.id);
    res.json({
      success: true,
      data: {
        order
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/orders/:orderId", requireAuth, async (req, res, next) => {
  try {
    const orderId = Number(req.params.orderId || 0);
    if (!orderId) {
      throw createError("Order not found", 404);
    }

    const order = await loadOrderDetails(orderId, req.auth.user.id);
    res.json({
      success: true,
      data: {
        order
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
