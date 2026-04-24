INSERT IGNORE INTO part_categories (category_key, name) VALUES
  ('battery', 'Battery'),
  ('brakes', 'Brake Components'),
  ('filters', 'Filters'),
  ('wipers', 'Wiper Blades'),
  ('engine', 'Engine Parts');

INSERT IGNORE INTO brands (brand_key, name) VALUES
  ('mg', 'MG'),
  ('peugeot', 'Peugeot'),
  ('toyota', 'Toyota'),
  ('bmw', 'BMW'),
  ('mercedes', 'Mercedes'),
  ('nissan', 'Nissan'),
  ('hyundai', 'Hyundai');

INSERT IGNORE INTO dealers (name, slug, description, location, contact_email, contact_phone) VALUES
  ('Al-Mansour Automotive', 'al-mansour-automotive', 'Official AutoFix-connected network for MG and Peugeot vehicles in Egypt.', 'Cairo', 'dealer@autofix.com', '+20 100 000 1001'),
  ('Toyota Egypt', 'toyota-egypt', 'Official Toyota dealer coverage across the AutoFix marketplace.', 'Cairo', 'toyota@autofix.com', '+20 100 000 2002'),
  ('Bavarian Auto Group', 'bavarian-auto-group', 'Premium dealer network for BMW and Mercedes fitment-ready parts.', 'Giza', 'premium@autofix.com', '+20 100 000 3003'),
  ('Nissan Egypt', 'nissan-egypt', 'Official Nissan service and parts distribution inside AutoFix.', 'Alexandria', 'nissan@autofix.com', '+20 100 000 4004'),
  ('GB Auto Hyundai', 'gb-auto-hyundai', 'Dealer coverage for Hyundai aftermarket and OEM-ready parts.', 'Cairo', 'hyundai@autofix.com', '+20 100 000 5005');

INSERT IGNORE INTO models (brand_id, model_key, name)
SELECT id, 'mg-zs', 'MG ZS' FROM brands WHERE brand_key = 'mg';

INSERT IGNORE INTO models (brand_id, model_key, name)
SELECT id, 'mercedes-cla200', 'CLA200' FROM brands WHERE brand_key = 'mercedes';

INSERT IGNORE INTO models (brand_id, model_key, name)
SELECT id, 'toyota-corolla', 'Corolla' FROM brands WHERE brand_key = 'toyota';

INSERT IGNORE INTO models (brand_id, model_key, name)
SELECT id, 'bmw-320i', '320i' FROM brands WHERE brand_key = 'bmw';

INSERT IGNORE INTO models (brand_id, model_key, name)
SELECT id, 'nissan-qashqai', 'Qashqai' FROM brands WHERE brand_key = 'nissan';

INSERT IGNORE INTO models (brand_id, model_key, name)
SELECT id, 'hyundai-elantra', 'Elantra AD' FROM brands WHERE brand_key = 'hyundai';

INSERT IGNORE INTO vehicle_years (model_id, year_value, year_label)
SELECT id, 2025, '2025' FROM models WHERE model_key = 'mg-zs';

INSERT IGNORE INTO vehicle_years (model_id, year_value, year_label)
SELECT id, 2021, '2021' FROM models WHERE model_key = 'mercedes-cla200';

INSERT IGNORE INTO vehicle_years (model_id, year_value, year_label)
SELECT id, 2024, '2024' FROM models WHERE model_key = 'toyota-corolla';

INSERT IGNORE INTO vehicle_years (model_id, year_value, year_label)
SELECT id, 2023, '2023' FROM models WHERE model_key = 'bmw-320i';

INSERT IGNORE INTO vehicle_years (model_id, year_value, year_label)
SELECT id, 2024, '2024' FROM models WHERE model_key = 'nissan-qashqai';

INSERT IGNORE INTO vehicle_years (model_id, year_value, year_label)
SELECT id, 2024, '2024' FROM models WHERE model_key = 'hyundai-elantra';

INSERT IGNORE INTO parts (
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
  serial_number
)
SELECT
  d.id,
  b.id,
  pc.id,
  'Car Battery',
  'mg-zs-2025-car-battery',
  'MGZS-BAT-2025',
  'original',
  2500,
  4.7,
  18,
  'Car battery suitable for MG ZS 2025.',
  'pictures/car battery.jpg',
  'SN-6379-9209'
FROM dealers d
JOIN brands b ON b.brand_key = 'mg'
JOIN part_categories pc ON pc.category_key = 'battery'
WHERE d.slug = 'al-mansour-automotive';

INSERT IGNORE INTO parts (
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
  serial_number
)
SELECT
  d.id,
  b.id,
  pc.id,
  'Brake Pads',
  'mercedes-cla200-2021-brake-pads',
  'CLA200-BRK-2021',
  'original',
  1200,
  4.5,
  12,
  'Brake pads suitable for Mercedes CLA200 2021.',
  'pictures/brake pads.jpg',
  'SN-4401-CLA2'
FROM dealers d
JOIN brands b ON b.brand_key = 'mercedes'
JOIN part_categories pc ON pc.category_key = 'brakes'
WHERE d.slug = 'bavarian-auto-group';

INSERT IGNORE INTO parts (
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
  serial_number
)
SELECT
  d.id,
  b.id,
  pc.id,
  'Oil Filter',
  'toyota-corolla-2024-oil-filter',
  'COROLLA-OIL-2024',
  'aftermarket',
  390,
  4.3,
  28,
  'Oil filter matched to Toyota Corolla 2024.',
  'pictures/oil filter.jpg',
  'SN-TOY-4422'
FROM dealers d
JOIN brands b ON b.brand_key = 'toyota'
JOIN part_categories pc ON pc.category_key = 'filters'
WHERE d.slug = 'toyota-egypt';

INSERT IGNORE INTO parts (
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
  serial_number
)
SELECT
  d.id,
  b.id,
  pc.id,
  'Wiper Blades',
  'nissan-qashqai-2024-wiper-blades',
  'QASHQAI-WIPER-2024',
  'original',
  220,
  4.4,
  7,
  'Wiper blades for Nissan Qashqai 2024.',
  'pictures/wiper blades.jpg',
  'SN-NIS-7710'
FROM dealers d
JOIN brands b ON b.brand_key = 'nissan'
JOIN part_categories pc ON pc.category_key = 'wipers'
WHERE d.slug = 'nissan-egypt';

INSERT IGNORE INTO parts (
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
  serial_number
)
SELECT
  d.id,
  b.id,
  pc.id,
  'Alternator',
  'hyundai-elantra-2024-alternator',
  'ELANTRA-ALT-2024',
  'aftermarket',
  3200,
  4.6,
  4,
  'Alternator for Hyundai Elantra AD 2024.',
  'pictures/alternator.jpeg',
  'SN-HYU-9981'
FROM dealers d
JOIN brands b ON b.brand_key = 'hyundai'
JOIN part_categories pc ON pc.category_key = 'engine'
WHERE d.slug = 'gb-auto-hyundai';

INSERT IGNORE INTO part_compatibility (part_id, brand_id, model_id, vehicle_year_id)
SELECT p.id, b.id, m.id, vy.id
FROM parts p
JOIN brands b ON b.brand_key = 'mg'
JOIN models m ON m.model_key = 'mg-zs'
JOIN vehicle_years vy ON vy.model_id = m.id AND vy.year_value = 2025
WHERE p.part_number = 'MGZS-BAT-2025';

INSERT IGNORE INTO part_compatibility (part_id, brand_id, model_id, vehicle_year_id)
SELECT p.id, b.id, m.id, vy.id
FROM parts p
JOIN brands b ON b.brand_key = 'mercedes'
JOIN models m ON m.model_key = 'mercedes-cla200'
JOIN vehicle_years vy ON vy.model_id = m.id AND vy.year_value = 2021
WHERE p.part_number = 'CLA200-BRK-2021';

INSERT IGNORE INTO part_compatibility (part_id, brand_id, model_id, vehicle_year_id)
SELECT p.id, b.id, m.id, vy.id
FROM parts p
JOIN brands b ON b.brand_key = 'toyota'
JOIN models m ON m.model_key = 'toyota-corolla'
JOIN vehicle_years vy ON vy.model_id = m.id AND vy.year_value = 2024
WHERE p.part_number = 'COROLLA-OIL-2024';

INSERT IGNORE INTO part_compatibility (part_id, brand_id, model_id, vehicle_year_id)
SELECT p.id, b.id, m.id, vy.id
FROM parts p
JOIN brands b ON b.brand_key = 'nissan'
JOIN models m ON m.model_key = 'nissan-qashqai'
JOIN vehicle_years vy ON vy.model_id = m.id AND vy.year_value = 2024
WHERE p.part_number = 'QASHQAI-WIPER-2024';

INSERT IGNORE INTO part_compatibility (part_id, brand_id, model_id, vehicle_year_id)
SELECT p.id, b.id, m.id, vy.id
FROM parts p
JOIN brands b ON b.brand_key = 'hyundai'
JOIN models m ON m.model_key = 'hyundai-elantra'
JOIN vehicle_years vy ON vy.model_id = m.id AND vy.year_value = 2024
WHERE p.part_number = 'ELANTRA-ALT-2024';

INSERT IGNORE INTO serial_registry (part_id, dealer_id, serial_number, registry_status, seller_name, notes)
SELECT p.id, p.dealer_id, p.serial_number, 'valid', d.name, 'Matched in dealer registry'
FROM parts p
JOIN dealers d ON d.id = p.dealer_id;

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
SELECT d.id, b.id, CURRENT_DATE(), 4200, 86, 1140, 'Car Battery', 1, 8
FROM dealers d
JOIN brands b ON b.brand_key = 'mg'
WHERE d.slug = 'al-mansour-automotive';

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
SELECT d.id, b.id, CURRENT_DATE(), 3700, 74, 980, 'Brake Pads', 0, 11
FROM dealers d
JOIN brands b ON b.brand_key = 'mercedes'
WHERE d.slug = 'bavarian-auto-group';

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
SELECT d.id, b.id, CURRENT_DATE(), 5100, 102, 1325, 'Oil Filter', 0, 14
FROM dealers d
JOIN brands b ON b.brand_key = 'toyota'
WHERE d.slug = 'toyota-egypt';
