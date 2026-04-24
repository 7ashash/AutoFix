import { Router } from "express";
import { query } from "../config/database.js";
import {
  getBrandPresentation,
  getDealerPresentation,
  getModelPresentation,
  normalizeBrandKey
} from "../lib/catalog-data.js";

const router = Router();

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function resolveDealerFilter({ dealerId, dealerSlug } = {}) {
  if (!dealerId && !dealerSlug) {
    return null;
  }

  const rows = await query(
    `
      SELECT id, name, slug, description, location
      FROM dealers
      WHERE (:dealerId IS NOT NULL AND id = :dealerId)
         OR (:dealerSlug <> '' AND slug = :dealerSlug)
      LIMIT 1
    `,
    {
      dealerId: dealerId ? Number(dealerId) : null,
      dealerSlug: String(dealerSlug || "").trim()
    }
  );

  return rows[0] ? {
    id: Number(rows[0].id),
    name: rows[0].name,
    slug: rows[0].slug,
    description: rows[0].description,
    location: rows[0].location,
    image: getDealerPresentation(rows[0].slug).image
  } : null;
}

async function getBrandByKey(brandKey) {
  const normalizedBrandKey = normalizeBrandKey(brandKey);
  const rows = await query(
    `
      SELECT
        b.id,
        b.brand_key AS brandKey,
        b.name,
        COUNT(DISTINCT m.id) AS modelCount,
        COUNT(DISTINCT dsb.dealer_id) AS dealerCount
      FROM brands b
      LEFT JOIN models m
        ON m.brand_id = b.id
      LEFT JOIN dealer_supported_brands dsb
        ON dsb.brand_id = b.id
      WHERE b.brand_key = :brandKey
      GROUP BY b.id, b.brand_key, b.name
      LIMIT 1
    `,
    { brandKey: normalizedBrandKey }
  );

  if (!rows[0]) {
    return null;
  }

  return {
    id: Number(rows[0].id),
    key: rows[0].brandKey,
    name: rows[0].name,
    logo: getBrandPresentation(rows[0].brandKey).logo,
    modelCount: Number(rows[0].modelCount || 0),
    dealerCount: Number(rows[0].dealerCount || 0)
  };
}

router.get("/brands", async (_req, res, next) => {
  try {
    const rows = await query(
      `
        SELECT
          b.id,
          b.brand_key AS brandKey,
          b.name,
          COUNT(DISTINCT m.id) AS modelCount,
          COUNT(DISTINCT dsb.dealer_id) AS dealerCount
        FROM brands b
        LEFT JOIN models m
          ON m.brand_id = b.id
        LEFT JOIN dealer_supported_brands dsb
          ON dsb.brand_id = b.id
        GROUP BY b.id, b.brand_key, b.name
        HAVING COUNT(DISTINCT m.id) > 0
        ORDER BY b.name ASC
      `
    );

    const data = rows.map((row) => ({
      id: Number(row.id),
      key: row.brandKey,
      name: row.name,
      logo: getBrandPresentation(row.brandKey).logo,
      modelCount: Number(row.modelCount || 0),
      dealerCount: Number(row.dealerCount || 0)
    }));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/brands/:brandKey/models", async (req, res, next) => {
  try {
    const brand = await getBrandByKey(req.params.brandKey);
    if (!brand) {
      throw createError("Brand not found", 404);
    }

    const dealer = await resolveDealerFilter({
      dealerId: req.query?.dealerId,
      dealerSlug: req.query?.dealerSlug
    });

    const dealerClause = dealer ? "AND p.dealer_id = :dealerId" : "";
    const params = {
      brandKey: brand.key,
      dealerId: dealer?.id || null
    };

    const modelRows = await query(
      `
        SELECT
          m.id,
          m.model_key AS modelKey,
          m.name,
          COUNT(DISTINCT p.id) AS partCount
        FROM models m
        INNER JOIN brands b
          ON b.id = m.brand_id
        INNER JOIN vehicle_years vy
          ON vy.model_id = m.id
        INNER JOIN part_compatibility pc
          ON pc.model_id = m.id
         AND pc.vehicle_year_id = vy.id
        INNER JOIN parts p
          ON p.id = pc.part_id
         AND p.active = 1
        WHERE b.brand_key = :brandKey
          ${dealerClause}
        GROUP BY m.id, m.model_key, m.name
        ORDER BY m.name ASC
      `,
      params
    );

    const yearRows = await query(
      `
        SELECT
          m.id AS modelId,
          vy.id,
          vy.year_value AS yearValue,
          vy.year_label AS yearLabel
        FROM models m
        INNER JOIN brands b
          ON b.id = m.brand_id
        INNER JOIN vehicle_years vy
          ON vy.model_id = m.id
        INNER JOIN part_compatibility pc
          ON pc.model_id = m.id
         AND pc.vehicle_year_id = vy.id
        INNER JOIN parts p
          ON p.id = pc.part_id
         AND p.active = 1
        WHERE b.brand_key = :brandKey
          ${dealerClause}
        GROUP BY m.id, vy.id, vy.year_value, vy.year_label
        ORDER BY vy.year_value ASC
      `,
      params
    );

    const yearsByModelId = yearRows.reduce((result, row) => {
      const modelId = Number(row.modelId);
      result[modelId] = result[modelId] || [];
      result[modelId].push({
        id: Number(row.id),
        value: Number(row.yearValue),
        label: row.yearLabel
      });
      return result;
    }, {});

    const models = modelRows.map((row) => {
      const presentation = getModelPresentation(row.modelKey);
      return {
        id: Number(row.id),
        key: row.modelKey,
        name: row.name,
        image: presentation?.image || "./pictures/autofix logo.png",
        profileLabel: presentation?.profileLabel || "Vehicle fitment",
        profileDescription: presentation?.profileDescription || "Choose the manufactured year to continue through the AutoFix fitment flow.",
        availableYears: yearsByModelId[Number(row.id)] || [],
        partCount: Number(row.partCount || 0)
      };
    });

    res.json({
      success: true,
      data: {
        brand,
        dealer,
        models
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/models/:modelKey/years", async (req, res, next) => {
  try {
    const dealer = await resolveDealerFilter({
      dealerId: req.query?.dealerId,
      dealerSlug: req.query?.dealerSlug
    });

    const dealerClause = dealer ? "AND p.dealer_id = :dealerId" : "";
    const params = {
      modelKey: String(req.params.modelKey || "").trim().toLowerCase(),
      dealerId: dealer?.id || null
    };

    const rows = await query(
      `
        SELECT
          b.id AS brandId,
          b.brand_key AS brandKey,
          b.name AS brandName,
          m.id AS modelId,
          m.model_key AS modelKey,
          m.name AS modelName,
          vy.id,
          vy.year_value AS yearValue,
          vy.year_label AS yearLabel
        FROM models m
        INNER JOIN brands b
          ON b.id = m.brand_id
        INNER JOIN vehicle_years vy
          ON vy.model_id = m.id
        INNER JOIN part_compatibility pc
          ON pc.model_id = m.id
         AND pc.vehicle_year_id = vy.id
        INNER JOIN parts p
          ON p.id = pc.part_id
         AND p.active = 1
        WHERE m.model_key = :modelKey
          ${dealerClause}
        GROUP BY
          b.id,
          b.brand_key,
          b.name,
          m.id,
          m.model_key,
          m.name,
          vy.id,
          vy.year_value,
          vy.year_label
        ORDER BY vy.year_value ASC
      `,
      params
    );

    if (!rows.length) {
      throw createError("Model not found", 404);
    }

    const presentation = getModelPresentation(rows[0].modelKey);

    res.json({
      success: true,
      data: {
        brand: {
          id: Number(rows[0].brandId),
          key: rows[0].brandKey,
          name: rows[0].brandName,
          logo: getBrandPresentation(rows[0].brandKey).logo
        },
        dealer,
        model: {
          id: Number(rows[0].modelId),
          key: rows[0].modelKey,
          name: rows[0].modelName,
          image: presentation?.image || "./pictures/autofix logo.png",
          profileLabel: presentation?.profileLabel || "Vehicle fitment",
          profileDescription: presentation?.profileDescription || "Choose a manufactured year to continue."
        },
        years: rows.map((row) => ({
          id: Number(row.id),
          value: Number(row.yearValue),
          label: row.yearLabel
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
