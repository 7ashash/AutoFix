CREATE TABLE IF NOT EXISTS dealer_supported_brands (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dealer_id INT UNSIGNED NOT NULL,
  brand_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dealer_supported_brand (dealer_id, brand_id),
  CONSTRAINT fk_dealer_supported_brands_dealer
    FOREIGN KEY (dealer_id) REFERENCES dealers (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dealer_supported_brands_brand
    FOREIGN KEY (brand_id) REFERENCES brands (id)
    ON DELETE CASCADE
);
