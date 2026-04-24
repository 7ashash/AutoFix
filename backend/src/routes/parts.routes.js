import { Router } from "express";
import { query } from "../config/database.js";
import {
  getBrandPresentation,
  getDealerPresentation,
  getModelPresentation,
  getPartGroupKeyByName,
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

  return rows[0]
    ? {
      id: Number(rows[0].id),
      name: rows[0].name,
      slug: rows[0].slug,
      description: rows[0].description,
      location: rows[0].location,
      image: getDealerPresentation(rows[0].slug).image
    }
    : null;
}

function mapPartRow(row) {
  return {
    id: Number(row.id),
    slug: row.slug,
    groupKey: getPartGroupKeyByName(row.name),
    name: row.name,
    image: row.imageUrl || "./pictures/autofix logo.png",
    desc: row.description,
    price: Number(row.price),
    type: row.partType === "original" ? "Original" : "Aftermarket",
    rating: Number(row.rating),
    stockQuantity: Number(row.stockQuantity),
    partNumber: row.partNumber,
    serialNumber: row.serialNumber,
    category: row.categoryName || "Parts",
    categoryKey: row.categoryKey || "",
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
    vehicle: row.modelId
      ? {
        id: Number(row.modelId),
        key: row.modelKey,
        name: row.modelName,
        year: row.yearValue ? Number(row.yearValue) : null
      }
      : null
  };
}

router.get("/compatible", async (req, res, next) => {
  try {
    const brandKey = normalizeBrandKey(req.query?.brandKey);
    const modelKey = String(req.query?.modelKey || "").trim().toLowerCase();
    const year = Number(req.query?.year);
    const dealer = await resolveDealerFilter({
      dealerId: req.query?.dealerId,
      dealerSlug: req.query?.dealerSlug
    });

    if (!brandKey || !modelKey || !year) {
      throw createError("brandKey, modelKey, and year are required");
    }

    const dealerClause = dealer ? "AND d.id = :dealerId" : "";
    const params = {
      brandKey,
      modelKey,
      year,
      dealerId: dealer?.id || null
    };

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
          p.description,
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
          vy.year_value AS yearValue,
          pc2.category_key AS categoryKey,
          pc2.name AS categoryName
        FROM part_compatibility pc
        INNER JOIN parts p
          ON p.id = pc.part_id
         AND p.active = 1
        INNER JOIN brands b
          ON b.id = pc.brand_id
        INNER JOIN models m
          ON m.id = pc.model_id
        INNER JOIN vehicle_years vy
          ON vy.id = pc.vehicle_year_id
        INNER JOIN dealers d
          ON d.id = p.dealer_id
        LEFT JOIN part_categories pc2
          ON pc2.id = p.category_id
        WHERE b.brand_key = :brandKey
          AND m.model_key = :modelKey
          AND vy.year_value = :year
          ${dealerClause}
        ORDER BY
          CASE p.part_type WHEN 'original' THEN 0 ELSE 1 END,
          p.rating DESC,
          p.name ASC
      `,
      params
    );

    res.json({
      success: true,
      data: {
        vehicle: rows[0]
          ? {
            brand: {
              id: Number(rows[0].brandId),
              key: rows[0].brandKey,
              name: rows[0].brandName,
              logo: getBrandPresentation(rows[0].brandKey).logo
            },
            model: {
              id: Number(rows[0].modelId),
              key: rows[0].modelKey,
              name: rows[0].modelName,
              image: getModelPresentation(rows[0].modelKey)?.image || "./pictures/autofix logo.png"
            },
            year
          }
          : {
            brand: {
              key: brandKey,
              name: brandKey.toUpperCase(),
              logo: getBrandPresentation(brandKey).logo
            },
            model: {
              key: modelKey,
              name: modelKey
            },
            year
          },
        dealer,
        parts: rows.map(mapPartRow)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/search", async (req, res, next) => {
  try {
    const searchQuery = String(req.query?.query || "").trim();
    const brandKey = normalizeBrandKey(req.query?.brandKey);
    const modelKey = String(req.query?.modelKey || "").trim().toLowerCase();
    const year = Number(req.query?.year || 0);

    const params = {
      term: `%${searchQuery}%`,
      brandKey: brandKey || null,
      modelKey: modelKey || null,
      year: year || null
    };

    const brandClause = brandKey ? "AND b.brand_key = :brandKey" : "";
    const modelClause = modelKey ? "AND m.model_key = :modelKey" : "";
    const yearClause = year ? "AND vy.year_value = :year" : "";

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
          p.description,
          p.image_url AS imageUrl,
          p.serial_number AS serialNumber,
          d.id AS dealerId,
          d.name AS dealerName,
          d.slug AS dealerSlug,
          b.id AS brandId,
          b.brand_key AS brandKey,
          b.name AS brandName,
          MAX(m.id) AS modelId,
          MAX(m.model_key) AS modelKey,
          MAX(m.name) AS modelName,
          MAX(vy.year_value) AS yearValue,
          pc2.category_key AS categoryKey,
          pc2.name AS categoryName
        FROM parts p
        INNER JOIN dealers d
          ON d.id = p.dealer_id
        INNER JOIN brands b
          ON b.id = p.brand_id
        LEFT JOIN part_categories pc2
          ON pc2.id = p.category_id
        LEFT JOIN part_compatibility pc
          ON pc.part_id = p.id
        LEFT JOIN models m
          ON m.id = pc.model_id
        LEFT JOIN vehicle_years vy
          ON vy.id = pc.vehicle_year_id
        WHERE p.active = 1
          AND (
            p.name LIKE :term
            OR p.part_number LIKE :term
            OR p.description LIKE :term
            OR pc2.name LIKE :term
          )
          ${brandClause}
          ${modelClause}
          ${yearClause}
        GROUP BY
          p.id,
          p.slug,
          p.name,
          p.part_number,
          p.part_type,
          p.price,
          p.rating,
          p.stock_quantity,
          p.description,
          p.image_url,
          p.serial_number,
          d.id,
          d.name,
          d.slug,
          b.id,
          b.brand_key,
          b.name,
          pc2.category_key,
          pc2.name
        ORDER BY p.rating DESC, p.name ASC
        LIMIT 30
      `,
      params
    );

    res.json({
      success: true,
      data: {
        query: searchQuery,
        results: rows.map(mapPartRow)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:partRef", async (req, res, next) => {
  try {
    const partRef = String(req.params.partRef || "").trim();
    const partId = Number(partRef);
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
          p.description,
          p.image_url AS imageUrl,
          p.serial_number AS serialNumber,
          d.id AS dealerId,
          d.name AS dealerName,
          d.slug AS dealerSlug,
          b.id AS brandId,
          b.brand_key AS brandKey,
          b.name AS brandName,
          pc2.category_key AS categoryKey,
          pc2.name AS categoryName
        FROM parts p
        INNER JOIN dealers d
          ON d.id = p.dealer_id
        INNER JOIN brands b
          ON b.id = p.brand_id
        LEFT JOIN part_categories pc2
          ON pc2.id = p.category_id
        WHERE (p.id = :partId OR p.slug = :partSlug)
          AND p.active = 1
        LIMIT 1
      `,
      {
        partId: Number.isFinite(partId) ? partId : 0,
        partSlug: partRef
      }
    );

    if (!rows[0]) {
      throw createError("Part not found", 404);
    }

    const compatibilityRows = await query(
      `
        SELECT
          b.id AS brandId,
          b.brand_key AS brandKey,
          b.name AS brandName,
          m.id AS modelId,
          m.model_key AS modelKey,
          m.name AS modelName,
          vy.id AS yearId,
          vy.year_value AS yearValue
        FROM part_compatibility pc
        INNER JOIN brands b
          ON b.id = pc.brand_id
        INNER JOIN models m
          ON m.id = pc.model_id
        INNER JOIN vehicle_years vy
          ON vy.id = pc.vehicle_year_id
        WHERE pc.part_id = :partId
        ORDER BY b.name ASC, m.name ASC, vy.year_value ASC
      `,
      { partId: Number(rows[0].id) }
    );

    const imageRows = await query(
      `
        SELECT image_url AS imageUrl, is_primary AS isPrimary
        FROM part_images
        WHERE part_id = :partId
        ORDER BY is_primary DESC, id ASC
      `,
      { partId: Number(rows[0].id) }
    );

    const requestedBrandKey = normalizeBrandKey(req.query?.brandKey);
    const requestedModelKey = String(req.query?.modelKey || "").trim().toLowerCase();
    const requestedYear = Number(req.query?.year || 0);

    const selectedFitment = compatibilityRows.find((item) =>
      (!requestedBrandKey || item.brandKey === requestedBrandKey) &&
      (!requestedModelKey || item.modelKey === requestedModelKey) &&
      (!requestedYear || Number(item.yearValue) === requestedYear)
    ) || null;

    res.json({
      success: true,
      data: {
        part: {
          ...mapPartRow(rows[0]),
          gallery: imageRows.length
            ? imageRows.map((item) => item.imageUrl)
            : [rows[0].imageUrl || "./pictures/autofix logo.png"]
        },
        selectedFitment: selectedFitment
          ? {
            brand: {
              id: Number(selectedFitment.brandId),
              key: selectedFitment.brandKey,
              name: selectedFitment.brandName,
              logo: getBrandPresentation(selectedFitment.brandKey).logo
            },
            model: {
              id: Number(selectedFitment.modelId),
              key: selectedFitment.modelKey,
              name: selectedFitment.modelName,
              image: getModelPresentation(selectedFitment.modelKey)?.image || "./pictures/autofix logo.png"
            },
            year: Number(selectedFitment.yearValue)
          }
          : null,
        compatibility: compatibilityRows.map((item) => ({
          brand: {
            id: Number(item.brandId),
            key: item.brandKey,
            name: item.brandName,
            logo: getBrandPresentation(item.brandKey).logo
          },
          model: {
            id: Number(item.modelId),
            key: item.modelKey,
            name: item.modelName,
            image: getModelPresentation(item.modelKey)?.image || "./pictures/autofix logo.png"
          },
          year: Number(item.yearValue)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
