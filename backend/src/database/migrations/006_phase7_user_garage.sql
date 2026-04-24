ALTER TABLE users
  ADD COLUMN garage_vehicle_year_id INT UNSIGNED NULL AFTER city,
  ADD KEY idx_users_garage_vehicle_year (garage_vehicle_year_id),
  ADD CONSTRAINT fk_users_garage_vehicle_year
    FOREIGN KEY (garage_vehicle_year_id) REFERENCES vehicle_years (id)
    ON DELETE SET NULL;
