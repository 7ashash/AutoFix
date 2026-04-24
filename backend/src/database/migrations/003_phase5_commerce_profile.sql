SET @schema_name = DATABASE();
SET @schema_name_bin = BINARY DATABASE();

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE BINARY TABLE_SCHEMA = @schema_name_bin
        AND BINARY TABLE_NAME = 'users'
        AND BINARY COLUMN_NAME = 'address_line'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN address_line VARCHAR(255) NULL AFTER phone'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE BINARY TABLE_SCHEMA = @schema_name_bin
        AND BINARY TABLE_NAME = 'users'
        AND BINARY COLUMN_NAME = 'city'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN city VARCHAR(120) NULL AFTER address_line'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE BINARY TABLE_SCHEMA = @schema_name_bin
        AND BINARY TABLE_NAME = 'cart_items'
        AND BINARY COLUMN_NAME = 'model_id'
    ),
    'SELECT 1',
    'ALTER TABLE cart_items ADD COLUMN model_id INT UNSIGNED NULL AFTER part_id'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE BINARY TABLE_SCHEMA = @schema_name_bin
        AND BINARY TABLE_NAME = 'cart_items'
        AND BINARY COLUMN_NAME = 'vehicle_year_id'
    ),
    'SELECT 1',
    'ALTER TABLE cart_items ADD COLUMN vehicle_year_id INT UNSIGNED NULL AFTER model_id'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE BINARY TABLE_SCHEMA = @schema_name_bin
        AND BINARY TABLE_NAME = 'order_items'
        AND BINARY COLUMN_NAME = 'model_id'
    ),
    'SELECT 1',
    'ALTER TABLE order_items ADD COLUMN model_id INT UNSIGNED NULL AFTER dealer_id'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE BINARY TABLE_SCHEMA = @schema_name_bin
        AND BINARY TABLE_NAME = 'order_items'
        AND BINARY COLUMN_NAME = 'vehicle_year_id'
    ),
    'SELECT 1',
    'ALTER TABLE order_items ADD COLUMN vehicle_year_id INT UNSIGNED NULL AFTER model_id'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
      WHERE BINARY CONSTRAINT_SCHEMA = @schema_name_bin
        AND BINARY CONSTRAINT_NAME = 'fk_cart_items_model'
    ),
    'SELECT 1',
    'ALTER TABLE cart_items ADD CONSTRAINT fk_cart_items_model FOREIGN KEY (model_id) REFERENCES models (id) ON DELETE SET NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
      WHERE BINARY CONSTRAINT_SCHEMA = @schema_name_bin
        AND BINARY CONSTRAINT_NAME = 'fk_cart_items_year'
    ),
    'SELECT 1',
    'ALTER TABLE cart_items ADD CONSTRAINT fk_cart_items_year FOREIGN KEY (vehicle_year_id) REFERENCES vehicle_years (id) ON DELETE SET NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
      WHERE BINARY CONSTRAINT_SCHEMA = @schema_name_bin
        AND BINARY CONSTRAINT_NAME = 'fk_order_items_model'
    ),
    'SELECT 1',
    'ALTER TABLE order_items ADD CONSTRAINT fk_order_items_model FOREIGN KEY (model_id) REFERENCES models (id) ON DELETE SET NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
      WHERE BINARY CONSTRAINT_SCHEMA = @schema_name_bin
        AND BINARY CONSTRAINT_NAME = 'fk_order_items_year'
    ),
    'SELECT 1',
    'ALTER TABLE order_items ADD CONSTRAINT fk_order_items_year FOREIGN KEY (vehicle_year_id) REFERENCES vehicle_years (id) ON DELETE SET NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @needs_cart_uq_upgrade = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE BINARY TABLE_SCHEMA = @schema_name_bin
        AND BINARY TABLE_NAME = 'cart_items'
        AND BINARY INDEX_NAME = 'uq_cart_item'
        AND BINARY COLUMN_NAME = 'vehicle_year_id'
    ),
    0,
    1
  )
);

SET @sql = (
  SELECT IF(
    @needs_cart_uq_upgrade = 1
    AND NOT EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE BINARY TABLE_SCHEMA = @schema_name_bin
        AND BINARY TABLE_NAME = 'cart_items'
        AND BINARY INDEX_NAME = 'idx_cart_items_cart'
    ),
    'ALTER TABLE cart_items ADD INDEX idx_cart_items_cart (cart_id)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    @needs_cart_uq_upgrade = 1
    AND NOT EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE BINARY TABLE_SCHEMA = @schema_name_bin
        AND BINARY TABLE_NAME = 'cart_items'
        AND BINARY INDEX_NAME = 'idx_cart_items_part'
    ),
    'ALTER TABLE cart_items ADD INDEX idx_cart_items_part (part_id)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    @needs_cart_uq_upgrade = 1
    AND EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE BINARY TABLE_SCHEMA = @schema_name_bin
        AND BINARY TABLE_NAME = 'cart_items'
        AND BINARY INDEX_NAME = 'uq_cart_item'
    ),
    'ALTER TABLE cart_items DROP INDEX uq_cart_item',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    @needs_cart_uq_upgrade = 1,
    'ALTER TABLE cart_items ADD UNIQUE KEY uq_cart_item (cart_id, part_id, vehicle_year_id)',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
