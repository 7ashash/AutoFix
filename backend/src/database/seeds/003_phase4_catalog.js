import {
  brandPresentation,
  brandDealerMap,
  catalogModels,
  partCategories,
  partTemplates,
  supportedDealerBrands
} from "../../lib/catalog-data.js";

const allBrandKeys = Object.keys(brandPresentation);
const modelYears = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

const brandPriceFactor = {
  bmw: 1.18,
  audi: 1.16,
  mercedes: 1.2,
  toyota: 1.05,
  hyundai: 1.0,
  kia: 1.03,
  mg: 1.01,
  nissan: 1.04,
  peugeot: 1.06,
  chevrolet: 1.08
};

function toTitleCase(value) {
  return String(value || "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function abbreviateBrand(brandKey) {
  const normalized = String(brandKey || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  return normalized.slice(0, 3) || "AFX";
}

function abbreviateModel(modelKey) {
  return String(modelKey || "")
    .split("-")
    .map((segment) => segment.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 3))
    .filter(Boolean)
    .slice(-2)
    .join("");
}

function buildPartNumber(brandKey, modelKey, yearValue, template) {
  return `${abbreviateBrand(brandKey)}-${abbreviateModel(modelKey)}-${String(yearValue)}-${template.key.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6)}`;
}

function buildPartSlug(modelKey, yearValue, template) {
  return `${modelKey}-${yearValue}-${template.key}`;
}

function buildSerialNumber(brandKey, modelKey, yearValue, templateIndex) {
  return `SN-${abbreviateBrand(brandKey)}-${abbreviateModel(modelKey)}-${String(yearValue).slice(-2)}-${String(templateIndex + 1).padStart(2, "0")}-${4100 + yearValue + templateIndex * 11}`;
}

function buildPrice(basePrice, brandKey, modelIndex, templateIndex, yearValue) {
  const factor = brandPriceFactor[brandKey] || 1;
  const offset = (modelIndex % 4) * 35 + (templateIndex % 3) * 20 + ((yearValue - 2020) * 6);
  return Math.round(basePrice * factor + offset);
}

function buildRating(baseRating, modelIndex, templateIndex, yearValue) {
  const adjustment = ((modelIndex + templateIndex + yearValue) % 4) * 0.05;
  return Math.min(4.9, Number((baseRating + adjustment).toFixed(1)));
}

function buildStock(modelIndex, templateIndex, yearValue) {
  return Math.max(4, 28 - (modelIndex % 7) - (templateIndex % 5) - ((yearValue - 2020) % 3));
}

async function executeOne(connection, sql, params = []) {
  await connection.execute(sql, params);
}

async function queryRows(connection, sql, params = []) {
  const [rows] = await connection.execute(sql, params);
  return rows;
}

export async function runSeed(connection) {
  for (const category of partCategories) {
    await executeOne(
      connection,
      `
        INSERT INTO part_categories (category_key, name)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name)
      `,
      [category.key, category.name]
    );
  }

  for (const brandKey of allBrandKeys) {
    await executeOne(
      connection,
      `
        INSERT INTO brands (brand_key, name)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name)
      `,
      [brandKey, toTitleCase(brandKey)]
    );
  }

  const brandRows = await queryRows(connection, "SELECT id, brand_key AS brandKey FROM brands");
  const dealerRows = await queryRows(connection, "SELECT id, slug FROM dealers");
  const categoryRows = await queryRows(connection, "SELECT id, category_key AS categoryKey FROM part_categories");

  const brandIdByKey = Object.fromEntries(brandRows.map((row) => [row.brandKey, Number(row.id)]));
  const dealerIdBySlug = Object.fromEntries(dealerRows.map((row) => [row.slug, Number(row.id)]));
  const categoryIdByKey = Object.fromEntries(categoryRows.map((row) => [row.categoryKey, Number(row.id)]));

  for (const [dealerSlug, brandKeys] of Object.entries(supportedDealerBrands)) {
    const dealerId = dealerIdBySlug[dealerSlug];
    if (!dealerId) {
      continue;
    }

    for (const brandKey of brandKeys) {
      const brandId = brandIdByKey[brandKey];
      if (!brandId) {
        continue;
      }

      await executeOne(
        connection,
        `
          INSERT IGNORE INTO dealer_supported_brands (dealer_id, brand_id)
          VALUES (?, ?)
        `,
        [dealerId, brandId]
      );
    }
  }

  for (const model of catalogModels) {
    const brandId = brandIdByKey[model.brandKey];
    if (!brandId) {
      continue;
    }

    await executeOne(
      connection,
      `
        INSERT INTO models (brand_id, model_key, name)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          brand_id = VALUES(brand_id),
          name = VALUES(name)
      `,
      [brandId, model.modelKey, model.name]
    );
  }

  const modelRows = await queryRows(connection, "SELECT id, brand_id AS brandId, model_key AS modelKey, name FROM models");
  const modelIdByKey = Object.fromEntries(modelRows.map((row) => [row.modelKey, Number(row.id)]));

  for (const model of catalogModels) {
    const modelId = modelIdByKey[model.modelKey];
    if (!modelId) {
      continue;
    }

    for (const year of modelYears) {
      await executeOne(
        connection,
        `
          INSERT INTO vehicle_years (model_id, year_value, year_label)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE year_label = VALUES(year_label)
        `,
        [modelId, year, String(year)]
      );
    }
  }

  const yearRows = await queryRows(connection, "SELECT id, model_id AS modelId, year_value AS yearValue FROM vehicle_years");
  const yearsByModelId = yearRows.reduce((result, row) => {
    const modelId = Number(row.modelId);
    result[modelId] = result[modelId] || [];
    result[modelId].push({ id: Number(row.id), yearValue: Number(row.yearValue) });
    return result;
  }, {});

  for (const [modelIndex, model] of catalogModels.entries()) {
    const modelId = modelIdByKey[model.modelKey];
    const brandId = brandIdByKey[model.brandKey];
    const dealerSlug = brandDealerMap[model.brandKey];
    const dealerId = dealerIdBySlug[dealerSlug];

    if (!modelId || !brandId || !dealerId) {
      continue;
    }

    const modelYearsRows = yearsByModelId[modelId] || [];

    for (const yearRow of modelYearsRows) {
      for (const [templateIndex, template] of partTemplates.entries()) {
        const categoryId = categoryIdByKey[template.categoryKey];
        const slug = buildPartSlug(model.modelKey, yearRow.yearValue, template);
        const partNumber = buildPartNumber(model.brandKey, model.modelKey, yearRow.yearValue, template);
        const price = buildPrice(template.basePrice, model.brandKey, modelIndex, templateIndex, yearRow.yearValue);
        const rating = buildRating(template.baseRating, modelIndex, templateIndex, yearRow.yearValue);
        const stockQuantity = buildStock(modelIndex, templateIndex, yearRow.yearValue);
        const serialNumber = buildSerialNumber(model.brandKey, model.modelKey, yearRow.yearValue, templateIndex);
        const description = `${template.name} matched to ${model.name} ${yearRow.yearValue} with AutoFix vehicle-first compatibility and dealer-routed coverage.`;

        await executeOne(
          connection,
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
              active
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
              dealer_id = VALUES(dealer_id),
              brand_id = VALUES(brand_id),
              category_id = VALUES(category_id),
              name = VALUES(name),
              part_type = VALUES(part_type),
              price = VALUES(price),
              rating = VALUES(rating),
              stock_quantity = VALUES(stock_quantity),
              description = VALUES(description),
              image_url = VALUES(image_url),
              serial_number = VALUES(serial_number),
              active = VALUES(active)
          `,
          [
            dealerId,
            brandId,
            categoryId || null,
            template.name,
            slug,
            partNumber,
            template.partType,
            price,
            rating,
            stockQuantity,
            description,
            template.imageUrl,
            serialNumber
          ]
        );
      }
    }
  }

  const partRows = await queryRows(connection, "SELECT id, dealer_id AS dealerId, brand_id AS brandId, slug, serial_number AS serialNumber, image_url AS imageUrl FROM parts");
  const partIdBySlug = Object.fromEntries(partRows.map((row) => [row.slug, Number(row.id)]));

  for (const model of catalogModels) {
    const modelId = modelIdByKey[model.modelKey];
    const brandId = brandIdByKey[model.brandKey];
    const modelYearsRows = yearsByModelId[modelId] || [];

    for (const yearRow of modelYearsRows) {
      for (const template of partTemplates) {
        const partSlug = buildPartSlug(model.modelKey, yearRow.yearValue, template);
        const partId = partIdBySlug[partSlug];

        if (!partId) {
          continue;
        }

        await executeOne(
          connection,
          `
            INSERT IGNORE INTO part_compatibility (part_id, brand_id, model_id, vehicle_year_id)
            VALUES (?, ?, ?, ?)
          `,
          [partId, brandId, modelId, yearRow.id]
        );
      }
    }
  }

  for (const part of partRows) {
    const existingPrimaryImage = await queryRows(
      connection,
      "SELECT id FROM part_images WHERE part_id = ? AND is_primary = 1 LIMIT 1",
      [part.id]
    );

    if (existingPrimaryImage[0]) {
      await executeOne(connection, "UPDATE part_images SET image_url = ? WHERE id = ?", [
        part.imageUrl,
        existingPrimaryImage[0].id
      ]);
    } else {
      await executeOne(
        connection,
        `
          INSERT INTO part_images (part_id, image_url, is_primary)
          VALUES (?, ?, 1)
        `,
        [part.id, part.imageUrl]
      );
    }

    await executeOne(
      connection,
      `
        INSERT IGNORE INTO serial_registry (part_id, dealer_id, serial_number, registry_status, seller_name, notes)
        SELECT ?, ?, ?, 'valid', d.name, 'Phase 4 catalog seed matched in official dealer registry'
        FROM dealers d
        WHERE d.id = ?
      `,
      [part.id, part.dealerId, part.serialNumber, part.dealerId]
    );
  }

  const analyticsPairs = Object.entries(supportedDealerBrands).flatMap(([dealerSlug, brandKeys]) =>
    brandKeys.map((brandKey) => ({ dealerSlug, brandKey }))
  );

  for (const [index, pair] of analyticsPairs.entries()) {
    const dealerId = dealerIdBySlug[pair.dealerSlug];
    const brandId = brandIdByKey[pair.brandKey];

    if (!dealerId || !brandId) {
      continue;
    }

    await executeOne(
      connection,
      `
        INSERT IGNORE INTO dealer_analytics (
          dealer_id,
          brand_id,
          metric_date,
          store_views,
          completed_sales,
          search_hits,
          most_searched_part,
          low_stock_items,
          active_listings
        )
        VALUES (?, ?, CURRENT_DATE(), ?, ?, ?, ?, ?, ?)
      `,
      [
        dealerId,
        brandId,
        3200 + index * 240,
        48 + index * 6,
        760 + index * 55,
        partTemplates[index % partTemplates.length].name,
        index % 3,
        22 + index
      ]
    );
  }
}

export default runSeed;
