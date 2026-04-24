ALTER TABLE parts
  ADD COLUMN manufacturer_name VARCHAR(190) NULL AFTER part_number,
  ADD COLUMN warranty_months INT NULL AFTER manufacturer_name,
  ADD COLUMN technical_specs JSON NULL AFTER warranty_months,
  ADD COLUMN archive_reason VARCHAR(255) NULL AFTER technical_specs;

ALTER TABLE orders
  ADD COLUMN coupon_code VARCHAR(80) NULL AFTER payment_method,
  ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER shipping_fee;

ALTER TABLE orders
  MODIFY COLUMN status ENUM('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'completed', 'cancelled') NOT NULL DEFAULT 'pending';

ALTER TABLE order_items
  MODIFY COLUMN status ENUM('new', 'pending', 'preparing', 'shipped', 'delivered', 'completed', 'cancelled') NOT NULL DEFAULT 'new',
  ADD COLUMN status_note TEXT NULL AFTER status,
  ADD COLUMN shipping_carrier VARCHAR(190) NULL AFTER status_note,
  ADD COLUMN tracking_number VARCHAR(190) NULL AFTER shipping_carrier,
  ADD COLUMN shipped_at TIMESTAMP NULL DEFAULT NULL AFTER tracking_number,
  ADD COLUMN delivered_at TIMESTAMP NULL DEFAULT NULL AFTER shipped_at,
  ADD COLUMN cancelled_at TIMESTAMP NULL DEFAULT NULL AFTER delivered_at;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dealer_id INT UNSIGNED NOT NULL,
  part_id INT UNSIGNED NOT NULL,
  movement_type ENUM('manual_adjustment', 'import', 'sale', 'restock', 'correction') NOT NULL DEFAULT 'manual_adjustment',
  quantity_delta INT NOT NULL,
  unit_cost DECIMAL(10,2) NULL,
  note VARCHAR(255) NULL,
  created_by_user_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_movements_dealer
    FOREIGN KEY (dealer_id) REFERENCES dealers (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_inventory_movements_part
    FOREIGN KEY (part_id) REFERENCES parts (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_inventory_movements_user
    FOREIGN KEY (created_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dealer_offers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dealer_id INT UNSIGNED NOT NULL,
  title VARCHAR(190) NOT NULL,
  description TEXT NULL,
  scope_type ENUM('part', 'category') NOT NULL DEFAULT 'part',
  part_id INT UNSIGNED NULL,
  category_id INT UNSIGNED NULL,
  discount_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  starts_at TIMESTAMP NULL DEFAULT NULL,
  ends_at TIMESTAMP NULL DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dealer_offers_dealer
    FOREIGN KEY (dealer_id) REFERENCES dealers (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dealer_offers_part
    FOREIGN KEY (part_id) REFERENCES parts (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_dealer_offers_category
    FOREIGN KEY (category_id) REFERENCES part_categories (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dealer_coupons (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dealer_id INT UNSIGNED NOT NULL,
  code VARCHAR(80) NOT NULL UNIQUE,
  title VARCHAR(190) NOT NULL,
  description TEXT NULL,
  discount_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  minimum_order_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  usage_limit INT UNSIGNED NULL,
  times_used INT UNSIGNED NOT NULL DEFAULT 0,
  starts_at TIMESTAMP NULL DEFAULT NULL,
  ends_at TIMESTAMP NULL DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dealer_coupons_dealer
    FOREIGN KEY (dealer_id) REFERENCES dealers (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dealer_coupon_targets (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  coupon_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  CONSTRAINT fk_dealer_coupon_targets_coupon
    FOREIGN KEY (coupon_id) REFERENCES dealer_coupons (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dealer_coupon_targets_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dealer_notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dealer_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NULL,
  notification_type ENUM('low_stock', 'new_order', 'customer_feedback', 'support_reply', 'campaign', 'shipment_update') NOT NULL DEFAULT 'campaign',
  title VARCHAR(190) NOT NULL,
  message TEXT NOT NULL,
  reference_type VARCHAR(80) NULL,
  reference_id INT UNSIGNED NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dealer_notifications_dealer
    FOREIGN KEY (dealer_id) REFERENCES dealers (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dealer_notifications_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dealer_shipping_methods (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dealer_id INT UNSIGNED NOT NULL,
  carrier_name VARCHAR(190) NOT NULL,
  region_name VARCHAR(190) NOT NULL,
  base_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  fee_per_item DECIMAL(10,2) NOT NULL DEFAULT 0,
  estimated_days_min INT UNSIGNED NULL,
  estimated_days_max INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dealer_shipping_methods_dealer
    FOREIGN KEY (dealer_id) REFERENCES dealers (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dealer_support_tickets (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dealer_id INT UNSIGNED NOT NULL,
  created_by_user_id INT UNSIGNED NOT NULL,
  subject VARCHAR(190) NOT NULL,
  message TEXT NOT NULL,
  priority ENUM('low', 'normal', 'high') NOT NULL DEFAULT 'normal',
  status ENUM('open', 'in_progress', 'resolved') NOT NULL DEFAULT 'open',
  admin_reply TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT fk_dealer_support_tickets_dealer
    FOREIGN KEY (dealer_id) REFERENCES dealers (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dealer_support_tickets_user
    FOREIGN KEY (created_by_user_id) REFERENCES users (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dealer_help_articles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(120) NOT NULL,
  title VARCHAR(190) NOT NULL,
  summary VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dealer_customer_feedback (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dealer_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NULL,
  order_item_id INT UNSIGNED NULL,
  complaint_type ENUM('review', 'complaint') NOT NULL DEFAULT 'review',
  rating INT UNSIGNED NULL,
  message TEXT NOT NULL,
  is_resolved TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dealer_customer_feedback_dealer
    FOREIGN KEY (dealer_id) REFERENCES dealers (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dealer_customer_feedback_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_dealer_customer_feedback_order_item
    FOREIGN KEY (order_item_id) REFERENCES order_items (id)
    ON DELETE SET NULL
);
