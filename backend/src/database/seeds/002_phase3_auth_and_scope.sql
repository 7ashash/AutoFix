INSERT IGNORE INTO users (username, email, password_hash, full_name, phone, role, account_status) VALUES
  ('admin', 'admin@autofix.com', '{{HASH:Admin@123}}', 'AutoFix Admin', '+20 100 111 0001', 'admin', 'active'),
  ('dealer', 'dealer@autofix.com', '{{HASH:Dealer@123}}', 'Al-Mansour Dealer', '+20 100 111 0002', 'dealer', 'active'),
  ('premium', 'premium@autofix.com', '{{HASH:Premium@123}}', 'Premium Dealer Manager', '+20 100 111 0003', 'dealer', 'active'),
  ('toyota', 'toyota@autofix.com', '{{HASH:Toyota@123}}', 'Toyota Dealer Manager', '+20 100 111 0004', 'dealer', 'active'),
  ('user', 'user@autofix.com', '{{HASH:User@123}}', 'Normal Customer', '+20 100 111 0005', 'user', 'active');

INSERT IGNORE INTO admins (user_id, super_admin)
SELECT id, 1
FROM users
WHERE email = 'admin@autofix.com';

INSERT IGNORE INTO dealer_supported_brands (dealer_id, brand_id)
SELECT d.id, b.id
FROM dealers d
JOIN brands b ON b.brand_key IN ('mg', 'peugeot')
WHERE d.slug = 'al-mansour-automotive';

INSERT IGNORE INTO dealer_supported_brands (dealer_id, brand_id)
SELECT d.id, b.id
FROM dealers d
JOIN brands b ON b.brand_key = 'toyota'
WHERE d.slug = 'toyota-egypt';

INSERT IGNORE INTO dealer_supported_brands (dealer_id, brand_id)
SELECT d.id, b.id
FROM dealers d
JOIN brands b ON b.brand_key IN ('bmw', 'mercedes')
WHERE d.slug = 'bavarian-auto-group';

INSERT IGNORE INTO dealer_supported_brands (dealer_id, brand_id)
SELECT d.id, b.id
FROM dealers d
JOIN brands b ON b.brand_key = 'nissan'
WHERE d.slug = 'nissan-egypt';

INSERT IGNORE INTO dealer_supported_brands (dealer_id, brand_id)
SELECT d.id, b.id
FROM dealers d
JOIN brands b ON b.brand_key = 'hyundai'
WHERE d.slug = 'gb-auto-hyundai';

INSERT IGNORE INTO dealer_brand_access (
  user_id,
  dealer_id,
  brand_id,
  access_status,
  can_manage_inventory,
  can_view_orders,
  can_manage_verification,
  can_view_analytics,
  assigned_by
)
SELECT
  u.id,
  d.id,
  b.id,
  'active',
  1,
  1,
  1,
  1,
  a.id
FROM users u
JOIN dealers d ON d.slug = 'al-mansour-automotive'
JOIN brands b ON b.brand_key = 'mg'
JOIN users a ON a.email = 'admin@autofix.com'
WHERE u.email = 'dealer@autofix.com';

INSERT IGNORE INTO dealer_brand_access (
  user_id,
  dealer_id,
  brand_id,
  access_status,
  can_manage_inventory,
  can_view_orders,
  can_manage_verification,
  can_view_analytics,
  assigned_by
)
SELECT
  u.id,
  d.id,
  b.id,
  'active',
  1,
  1,
  1,
  1,
  a.id
FROM users u
JOIN dealers d ON d.slug = 'bavarian-auto-group'
JOIN brands b ON b.brand_key IN ('bmw', 'mercedes')
JOIN users a ON a.email = 'admin@autofix.com'
WHERE u.email = 'premium@autofix.com';

INSERT IGNORE INTO dealer_brand_access (
  user_id,
  dealer_id,
  brand_id,
  access_status,
  can_manage_inventory,
  can_view_orders,
  can_manage_verification,
  can_view_analytics,
  assigned_by
)
SELECT
  u.id,
  d.id,
  b.id,
  'active',
  1,
  1,
  1,
  1,
  a.id
FROM users u
JOIN dealers d ON d.slug = 'toyota-egypt'
JOIN brands b ON b.brand_key = 'toyota'
JOIN users a ON a.email = 'admin@autofix.com'
WHERE u.email = 'toyota@autofix.com';

INSERT IGNORE INTO carts (user_id)
SELECT id FROM users WHERE email = 'user@autofix.com';

INSERT IGNORE INTO cart_items (cart_id, part_id, quantity)
SELECT c.id, p.id, 1
FROM carts c
JOIN users u ON u.id = c.user_id AND u.email = 'user@autofix.com'
JOIN parts p ON p.part_number = 'CLA200-BRK-2021';

INSERT IGNORE INTO orders (
  user_id,
  order_number,
  customer_full_name,
  phone,
  address_line,
  city,
  fulfillment_method,
  payment_method,
  status,
  subtotal,
  shipping_fee,
  total_amount
)
SELECT
  u.id,
  'AFX-10001',
  u.full_name,
  u.phone,
  'Nasr City, 17 Abbas El Akkad',
  'Cairo',
  'delivery',
  'cash',
  'processing',
  1200,
  15,
  1215
FROM users u
WHERE u.email = 'user@autofix.com';

INSERT IGNORE INTO order_items (
  order_id,
  part_id,
  dealer_id,
  quantity,
  unit_price,
  line_total,
  status
)
SELECT
  o.id,
  p.id,
  p.dealer_id,
  1,
  p.price,
  p.price,
  'processing'
FROM orders o
JOIN parts p ON p.part_number = 'CLA200-BRK-2021'
WHERE o.order_number = 'AFX-10001';

INSERT IGNORE INTO dealer_access_requests (user_id, dealer_id, note, status)
SELECT
  u.id,
  d.id,
  'I want to manage MG listings and receive scoped orders from AutoFix.',
  'pending'
FROM users u
JOIN dealers d ON d.slug = 'al-mansour-automotive'
WHERE u.email = 'user@autofix.com';

INSERT IGNORE INTO dealer_access_request_brands (request_id, brand_id)
SELECT
  dar.id,
  b.id
FROM dealer_access_requests dar
JOIN users u ON u.id = dar.user_id AND u.email = 'user@autofix.com'
JOIN dealers d ON d.id = dar.dealer_id AND d.slug = 'al-mansour-automotive'
JOIN brands b ON b.brand_key = 'mg';

INSERT IGNORE INTO assistant_logs (user_id, dealer_id, session_type, intent, user_message, assistant_response, status)
SELECT
  u.id,
  d.id,
  'parts_search',
  'compatibility-check',
  'Do you have an original MG ZS battery?',
  'Yes, AutoFix found an original MG ZS battery under Al-Mansour Automotive.',
  'completed'
FROM users u
JOIN dealers d ON d.slug = 'al-mansour-automotive'
WHERE u.email = 'user@autofix.com';

INSERT IGNORE INTO assistant_logs (user_id, dealer_id, session_type, intent, user_message, assistant_response, status)
SELECT
  u.id,
  d.id,
  'parts_search',
  'order-follow-up',
  'I need the brake pads order status.',
  'Your Mercedes brake pads order is already routed to Bavarian Auto Group and is processing now.',
  'completed'
FROM users u
JOIN dealers d ON d.slug = 'bavarian-auto-group'
WHERE u.email = 'user@autofix.com';

INSERT IGNORE INTO admin_activity_logs (admin_user_id, activity_message)
SELECT id, 'Seeded realistic admin control center data for dealer access governance.'
FROM users
WHERE email = 'admin@autofix.com';
