UPDATE users
SET garage_vehicle_year_id = (
  SELECT vy.id
  FROM vehicle_years vy
  INNER JOIN models m
    ON m.id = vy.model_id
  INNER JOIN brands b
    ON b.id = m.brand_id
  WHERE b.brand_key = 'toyota'
    AND m.model_key = 'toyota-corolla'
    AND vy.year_value = 2020
  LIMIT 1
)
WHERE email = 'user@autofix.com';

UPDATE users
SET garage_vehicle_year_id = (
  SELECT vy.id
  FROM vehicle_years vy
  INNER JOIN models m
    ON m.id = vy.model_id
  INNER JOIN brands b
    ON b.id = m.brand_id
  WHERE b.brand_key = 'mg'
    AND m.model_key = 'mg-zs'
    AND vy.year_value = 2025
  LIMIT 1
)
WHERE email = 'dealer@autofix.com';

UPDATE users
SET garage_vehicle_year_id = (
  SELECT vy.id
  FROM vehicle_years vy
  INNER JOIN models m
    ON m.id = vy.model_id
  INNER JOIN brands b
    ON b.id = m.brand_id
  WHERE b.brand_key = 'bmw'
    AND m.model_key = 'bmw-118i-f20'
    AND vy.year_value = 2022
  LIMIT 1
)
WHERE email = 'admin@autofix.com';

UPDATE users
SET garage_vehicle_year_id = (
  SELECT vy.id
  FROM vehicle_years vy
  INNER JOIN models m
    ON m.id = vy.model_id
  INNER JOIN brands b
    ON b.id = m.brand_id
  WHERE b.brand_key = 'toyota'
    AND m.model_key = 'toyota-camry'
    AND vy.year_value = 2024
  LIMIT 1
)
WHERE email = 'toyota@autofix.com';

UPDATE users
SET garage_vehicle_year_id = (
  SELECT vy.id
  FROM vehicle_years vy
  INNER JOIN models m
    ON m.id = vy.model_id
  INNER JOIN brands b
    ON b.id = m.brand_id
  WHERE b.brand_key = 'mercedes'
    AND m.model_key = 'mercedes-cla200'
    AND vy.year_value = 2023
  LIMIT 1
)
WHERE email = 'premium@autofix.com';
