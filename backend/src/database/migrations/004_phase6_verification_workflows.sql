CREATE TABLE IF NOT EXISTS verification_checks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  part_id INT UNSIGNED NULL,
  dealer_id INT UNSIGNED NULL,
  matched_registry_id INT UNSIGNED NULL,
  serial_number VARCHAR(190) NOT NULL,
  result_status ENUM('valid', 'unverified', 'suspicious') NOT NULL,
  request_source ENUM('verify_page', 'product_page', 'api') NOT NULL DEFAULT 'verify_page',
  recommendation TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_verification_checks_user (user_id),
  INDEX idx_verification_checks_part (part_id),
  INDEX idx_verification_checks_dealer (dealer_id),
  INDEX idx_verification_checks_registry (matched_registry_id),
  INDEX idx_verification_checks_serial (serial_number),
  CONSTRAINT fk_verification_checks_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_verification_checks_part
    FOREIGN KEY (part_id) REFERENCES parts (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_verification_checks_dealer
    FOREIGN KEY (dealer_id) REFERENCES dealers (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_verification_checks_registry
    FOREIGN KEY (matched_registry_id) REFERENCES serial_registry (id)
    ON DELETE SET NULL
);

SET @schema_name_bin = BINARY DATABASE();

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE BINARY TABLE_SCHEMA = @schema_name_bin
        AND BINARY TABLE_NAME = 'verification_reports'
        AND BINARY COLUMN_NAME = 'part_id'
    ),
    'SELECT 1',
    'ALTER TABLE verification_reports ADD COLUMN part_id INT UNSIGNED NULL AFTER user_id'
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
        AND BINARY TABLE_NAME = 'verification_reports'
        AND BINARY COLUMN_NAME = 'dealer_id'
    ),
    'SELECT 1',
    'ALTER TABLE verification_reports ADD COLUMN dealer_id INT UNSIGNED NULL AFTER part_id'
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
        AND BINARY TABLE_NAME = 'verification_reports'
        AND BINARY COLUMN_NAME = 'seller_name'
    ),
    'SELECT 1',
    'ALTER TABLE verification_reports ADD COLUMN seller_name VARCHAR(190) NULL AFTER serial_number'
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
        AND BINARY TABLE_NAME = 'verification_reports'
        AND BINARY COLUMN_NAME = 'action_status'
    ),
    'SELECT 1',
    'ALTER TABLE verification_reports ADD COLUMN action_status ENUM(''open'', ''reviewing'', ''resolved'', ''dismissed'') NOT NULL DEFAULT ''open'' AFTER note'
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
        AND BINARY TABLE_NAME = 'verification_reports'
        AND BINARY COLUMN_NAME = 'reviewed_by'
    ),
    'SELECT 1',
    'ALTER TABLE verification_reports ADD COLUMN reviewed_by INT UNSIGNED NULL AFTER action_status'
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
        AND BINARY TABLE_NAME = 'verification_reports'
        AND BINARY COLUMN_NAME = 'reviewed_at'
    ),
    'SELECT 1',
    'ALTER TABLE verification_reports ADD COLUMN reviewed_at TIMESTAMP NULL DEFAULT NULL AFTER reviewed_by'
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
        AND BINARY TABLE_NAME = 'verification_reports'
        AND BINARY COLUMN_NAME = 'resolution_note'
    ),
    'SELECT 1',
    'ALTER TABLE verification_reports ADD COLUMN resolution_note TEXT NULL AFTER reviewed_at'
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
        AND BINARY CONSTRAINT_NAME = 'fk_verification_reports_part'
    ),
    'SELECT 1',
    'ALTER TABLE verification_reports ADD CONSTRAINT fk_verification_reports_part FOREIGN KEY (part_id) REFERENCES parts (id) ON DELETE SET NULL'
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
        AND BINARY CONSTRAINT_NAME = 'fk_verification_reports_dealer'
    ),
    'SELECT 1',
    'ALTER TABLE verification_reports ADD CONSTRAINT fk_verification_reports_dealer FOREIGN KEY (dealer_id) REFERENCES dealers (id) ON DELETE SET NULL'
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
        AND BINARY CONSTRAINT_NAME = 'fk_verification_reports_reviewer'
    ),
    'SELECT 1',
    'ALTER TABLE verification_reports ADD CONSTRAINT fk_verification_reports_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE BINARY TABLE_SCHEMA = @schema_name_bin
        AND BINARY TABLE_NAME = 'verification_reports'
        AND BINARY INDEX_NAME = 'idx_verification_reports_serial'
    ),
    'SELECT 1',
    'ALTER TABLE verification_reports ADD INDEX idx_verification_reports_serial (serial_number)'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE BINARY TABLE_SCHEMA = @schema_name_bin
        AND BINARY TABLE_NAME = 'verification_reports'
        AND BINARY INDEX_NAME = 'idx_verification_reports_action'
    ),
    'SELECT 1',
    'ALTER TABLE verification_reports ADD INDEX idx_verification_reports_action (action_status)'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
