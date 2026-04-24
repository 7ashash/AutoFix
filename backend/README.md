# AutoFix Backend

This backend is being built in phases so the marketplace can move from frontend prototype to a real working platform.

## Current status

The backend foundation, MySQL schema, phase 3 auth/admin/dealer access flow, phase 4 vehicle-first catalog APIs, phase 5 commerce flow, phase 6 verification workflow, phase 7 assistant APIs, phase 8 dealer operations dashboard, and phase 9 admin control center are now in place.

### Database schema prepared for AutoFix

- `users`
- `admins`
- `dealers`
- `dealer_brand_access`
- `dealer_access_requests`
- `dealer_access_request_brands`
- `brands`
- `models`
- `vehicle_years`
- `part_categories`
- `parts`
- `part_images`
- `part_compatibility`
- `serial_registry`
- `verification_reports`
- `carts`
- `cart_items`
- `orders`
- `order_items`
- `assistant_logs`
- `dealer_analytics`
- `admin_activity_logs`

## Current backend feature coverage

- Runtime foundation and health checks
- MySQL schema, migrations, and seed workflow
- Auth, roles, and scoped dealer/admin access
- Vehicle-first catalog and fitment-aware parts search
- Cart, checkout, orders, and stock deduction
- Authenticity verification and suspicious-report workflow
- Assistant APIs with grounded parts search and fault diagnosis
- Dealer dashboard operations:
  - product create / update / archive / delete
  - fitment management per model and year
  - categories, specs, manufacturer, serial, and warranty data
  - stock adjustments, bulk import, and inventory movements
  - routed order handling and shipping updates
  - offers and coupon management
  - customer targeting and dealer notifications
  - shipping methods and shipping estimates
  - support tickets and help center content
  - staff access scoped to dealer brands
  - dealer profile management
- Admin dashboard operations:
  - marketplace KPI overview and live notifications
  - global users search and account moderation
  - convert any registered email into a dealer
  - assign one or more dealer networks plus brand scope per dealer
  - approve or reject pending dealer access requests
  - create, update, archive, or delete dealer networks
  - preview any dealer dashboard as admin
  - edit, archive, or delete any marketplace product
  - review and update all orders
  - centrally adjust inventory across all dealers

## Next implementation phases

- Final integration, validation, testing, and polish

## Quick start

1. Copy `.env.example` to `.env`
2. Update MySQL credentials and runtime paths if needed
3. Install packages:

```bash
npm install
```

4. Initialize the database:

```bash
npm run db:init
```

5. For a realistic local backend run, use:

```bash
npm run dev:stack
```

That command starts the local MySQL runtime and then launches the Express backend in one flow.

## MySQL runtime notes

- MySQL Community Server is now extracted inside the project at `backend/mysql-runtime`
- The project can run without depending on a Windows service
- `dev:stack` is the recommended command during development

Useful commands:

```bash
npm run db:runtime:start
npm run db:runtime:ping
npm run db:runtime:stop
npm run phase4:smoke
npm run phase5:smoke
npm run phase6:smoke
npm run phase7:smoke
npm run phase8:smoke
npm run phase9:smoke
npm run dev:stack
```

## Phase 4 smoke test

Once MySQL and the backend are running, use:

```bash
npm run phase4:smoke
```

This verifies the real public catalog flow:

- health check
- dealers
- brands
- models
- years
- compatible parts
- part details
- search

## Phase 5 smoke test

Once MySQL and the backend are running, use:

```bash
npm run phase5:smoke
```

This verifies the live commerce flow:

- login
- live cart reset
- add compatible part to cart
- checkout
- latest order
- orders history

## Phase 6 smoke test

Once MySQL and the backend are running, use:

```bash
npm run phase6:smoke
```

This verifies the real verification flow:

- valid serial check
- suspicious mismatch check
- report submission
- verification history
- admin review queue and resolution

## Phase 7 smoke test

Once MySQL and the backend are running, use:

```bash
npm run phase7:smoke
```

This verifies the assistant flow:

- assistant bootstrap
- grounded parts search in English
- grounded parts search in Egyptian Arabic
- fault diagnosis
- persisted assistant history

## Phase 8 smoke test

Once MySQL and the backend are running, use:

```bash
npm run phase8:smoke
```

This verifies the dealer operations dashboard end to end:

- dealer login and scoped dashboard load
- product creation, update, archive, and restore
- stock movements and inventory import
- routed order creation from a real customer checkout
- dealer order status updates and shipping metadata
- offers and coupons
- customer notifications
- shipping methods and shipping fee estimation
- staff assignment and permission updates
- dealer profile update
- support ticket creation and follow-up
- help center availability

## Phase 9 smoke test

Once MySQL and the backend are running, use:

```bash
npm run phase9:smoke
```

This verifies the admin control center end to end:

- admin dashboard bootstrap and KPI payload
- create and update dealer networks
- convert a registered user into a dealer by email
- assign the same dealer account to multiple dealer networks
- suspend and reactivate a dealer account
- open dealer dashboard preview as admin
- edit marketplace products
- update inventory centrally
- create a real customer order and update it from admin
- archive dealer accounts and dealer networks
