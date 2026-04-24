ALTER TABLE assistant_logs
  ADD COLUMN locale_code VARCHAR(20) NOT NULL DEFAULT 'en' AFTER status;

ALTER TABLE assistant_logs
  ADD COLUMN suggested_action VARCHAR(120) NULL AFTER locale_code;

ALTER TABLE assistant_logs
  ADD COLUMN context_snapshot JSON NULL AFTER suggested_action;
