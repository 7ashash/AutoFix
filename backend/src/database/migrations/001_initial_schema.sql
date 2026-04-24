CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(190) NOT NULL,
  phone VARCHAR(50) NULL,
  address_line VARCHAR(255) NULL,
  city VARCHAR(120) NULL,
  role ENUM('user', 'dealer', 'admin') NOT NULL DEFAULT 'user',
  account_status ENUM('active', 'pending_approval', 'suspended') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL UNIQUE,
  super_admin TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_admins_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dealers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  slug VARCHAR(190) NOT NULL UNIQUE,
  description TEXT NULL,
  location VARCHAR(190) NULL,
  contact_email VARCHAR(190) NULL,
  contact_phone VARCHAR(50) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brands (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  brand_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(190) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS models (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  brand_id INT UNSIGNED NOT NULL,
  model_key VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(190) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_models_brand
    FOREIGN KEY (brand_id) REFERENCES brands (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vehicle_years (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  model_id INT UNSIGNED NOT NULL,
  year_value INT NOT NULL,
  year_label VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vehicle_year (model_id, year_value),
  CONSTRAINT fk_vehicle_years_model
    FOREIGN KEY (model_id) REFERENCES models (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS part_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(190) NOT NULL
);

CREATE TABLE IF NOT EXISTS parts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dealer_id INT UNSIGNED NOT NULL,
  brand_id INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NULL,
  name VARCHAR(190) NOT NULL,
  slug VARCHAR(190) NOT NULL UNIQUE,
  part_number VARCHAR(120) NOT NULL UNIQUE,
  part_type ENUM('original', 'aftermarket') NOT NULL DEFAULT 'original',
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  rating DECIMAL(3,2) NOT NULL DEFAULT 0,
  stock_quantity INT NOT NULL DEFAULT 0,
  description TEXT NULL,
  image_url VARCHAR(500) NULL,
  serial_number VARCHAR(190) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_parts_dealer
    FOREIGN KEY (dealer_id) REFERENCES dealers (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_parts_brand
    FOREIGN KEY (brand_id) REFERENCES brands (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_parts_category
    FOREIGN KEY (category_id) REFERENCES part_categories (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS part_images (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  part_id INT UNSIGNED NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_part_images_part
    FOREIGN KEY (part_id) REFERENCES parts (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS part_compatibility (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  part_id INT UNSIGNED NOT NULL,
  brand_id INT UNSIGNED NOT NULL,
  model_id INT UNSIGNED NOT NULL,
  vehicle_year_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_part_vehicle (part_id, vehicle_year_id),
  CONSTRAINT fk_part_compatibility_part
    FOREIGN KEY (part_id) REFERENCES parts (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_part_compatibility_brand
    FOREIGN KEY (brand_id) REFERENCES brands (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_part_compatibility_model
    FOREIGN KEY (model_id) REFERENCES models (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_part_compatibility_year
    FOREIGN KEY (vehicle_year_id) REFERENCES vehicle_years (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS serial_registry (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  part_id INT UNSIGNED NOT NULL,
  dealer_id INT UNSIGNED NOT NULL,
  serial_number VARCHAR(190) NOT NULL UNIQUE,
  registry_status ENUM('valid', 'unverified', 'suspicious') NOT NULL DEFAULT 'valid',
  seller_name VARCHAR(190) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_serial_registry_part
    FOREIGN KEY (part_id) REFERENCES parts (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_serial_registry_dealer
    FOREIGN KEY (dealer_id) REFERENCES dealers (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verification_reports (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  serial_number VARCHAR(190) NOT NULL,
  report_status ENUM('valid', 'unverified', 'suspicious') NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_verification_reports_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS carts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_carts_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cart_id INT UNSIGNED NOT NULL,
  part_id INT UNSIGNED NOT NULL,
  model_id INT UNSIGNED NULL,
  vehicle_year_id INT UNSIGNED NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cart_item (cart_id, part_id, vehicle_year_id),
  CONSTRAINT fk_cart_items_cart
    FOREIGN KEY (cart_id) REFERENCES carts (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_part
    FOREIGN KEY (part_id) REFERENCES parts (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_model
    FOREIGN KEY (model_id) REFERENCES models (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_cart_items_year
    FOREIGN KEY (vehicle_year_id) REFERENCES vehicle_years (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  customer_full_name VARCHAR(190) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  address_line VARCHAR(255) NOT NULL,
  city VARCHAR(120) NOT NULL,
  fulfillment_method ENUM('delivery', 'pickup') NOT NULL DEFAULT 'delivery',
  payment_method ENUM('cash', 'card') NOT NULL DEFAULT 'cash',
  status ENUM('pending', 'confirmed', 'processing', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  part_id INT UNSIGNED NOT NULL,
  dealer_id INT UNSIGNED NOT NULL,
  model_id INT UNSIGNED NULL,
  vehicle_year_id INT UNSIGNED NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('new', 'pending', 'processing', 'completed', 'cancelled') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_order_items_part
    FOREIGN KEY (part_id) REFERENCES parts (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_order_items_dealer
    FOREIGN KEY (dealer_id) REFERENCES dealers (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_order_items_model
    FOREIGN KEY (model_id) REFERENCES models (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_order_items_year
    FOREIGN KEY (vehicle_year_id) REFERENCES vehicle_years (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS assistant_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  dealer_id INT UNSIGNED NULL,
  session_type ENUM('parts_search', 'fault_diagnosis', 'service_recommendation') NOT NULL DEFAULT 'parts_search',
  intent VARCHAR(120) NULL,
  user_message TEXT NOT NULL,
  assistant_response TEXT NOT NULL,
  status ENUM('completed', 'escalated', 'pending') NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assistant_logs_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_assistant_logs_dealer
    FOREIGN KEY (dealer_id) REFERENCES dealers (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dealer_analytics (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dealer_id INT UNSIGNED NOT NULL,
  brand_id INT UNSIGNED NULL,
  metric_date DATE NOT NULL,
  store_views INT NOT NULL DEFAULT 0,
  completed_sales INT NOT NULL DEFAULT 0,
  search_hits INT NOT NULL DEFAULT 0,
  most_searched_part VARCHAR(190) NULL,
  low_stock_items INT NOT NULL DEFAULT 0,
  active_listings INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dealer_analytics_dealer
    FOREIGN KEY (dealer_id) REFERENCES dealers (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dealer_analytics_brand
    FOREIGN KEY (brand_id) REFERENCES brands (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dealer_access_requests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  dealer_id INT UNSIGNED NOT NULL,
  note TEXT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_by INT UNSIGNED NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dealer_access_requests_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dealer_access_requests_dealer
    FOREIGN KEY (dealer_id) REFERENCES dealers (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dealer_access_requests_admin
    FOREIGN KEY (reviewed_by) REFERENCES users (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dealer_access_request_brands (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id INT UNSIGNED NOT NULL,
  brand_id INT UNSIGNED NOT NULL,
  CONSTRAINT fk_request_brands_request
    FOREIGN KEY (request_id) REFERENCES dealer_access_requests (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_request_brands_brand
    FOREIGN KEY (brand_id) REFERENCES brands (id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dealer_brand_access (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  dealer_id INT UNSIGNED NOT NULL,
  brand_id INT UNSIGNED NOT NULL,
  access_status ENUM('active', 'pending_approval', 'suspended') NOT NULL DEFAULT 'active',
  can_manage_inventory TINYINT(1) NOT NULL DEFAULT 1,
  can_view_orders TINYINT(1) NOT NULL DEFAULT 1,
  can_manage_verification TINYINT(1) NOT NULL DEFAULT 1,
  can_view_analytics TINYINT(1) NOT NULL DEFAULT 1,
  assigned_by INT UNSIGNED NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dealer_brand_access (user_id, dealer_id, brand_id),
  CONSTRAINT fk_dealer_brand_access_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dealer_brand_access_dealer
    FOREIGN KEY (dealer_id) REFERENCES dealers (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dealer_brand_access_brand
    FOREIGN KEY (brand_id) REFERENCES brands (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dealer_brand_access_admin
    FOREIGN KEY (assigned_by) REFERENCES users (id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  admin_user_id INT UNSIGNED NOT NULL,
  activity_message VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_admin_activity_logs_user
    FOREIGN KEY (admin_user_id) REFERENCES users (id)
    ON DELETE CASCADE
);
