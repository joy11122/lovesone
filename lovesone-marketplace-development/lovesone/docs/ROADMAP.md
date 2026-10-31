# LOVESONE delivery roadmap

This document reflects the current repository implementation. A feature is marked complete only when corresponding code exists; external credentials and certification are tracked separately.

## Phase 1 — Foundation
- [x] Brand system, responsive storefront shell and landing page
- [x] Next.js project configuration and base documentation
- [x] Core user, vendor, product and order models
- [x] MongoDB connection helper
- [x] Auth.js credentials and Google OAuth foundations
- [x] Role-aware session mapping and active-account revalidation
- [ ] Verify MongoDB replica-set transactions against a provisioned staging Atlas cluster
- [ ] Automated backup and restore verification

## Phase 2 — Storefront
- [x] Homepage category discovery and category-filtered shop links
- [x] Active product catalogue and category filtering
- [x] Product detail route, price, description and stock display
- [x] Browser-persisted cart and quantity controls
- [ ] Product search, sorting and pagination controls
- [x] Vendor-owned single product cover-image upload via signed Cloudinary server route
- [ ] Multi-image gallery and product variants
- [ ] Wishlist and account-synchronised cart
- [ ] Customer address book and delivery fee calculation
- [ ] Bengali localization and complete SEO / accessibility audit

## Phase 3 — Vendors
- [x] Seller application and vendor profile persistence
- [x] Admin approval with transactional account-role update
- [x] Vendor-scoped product submission
- [x] Admin product moderation queue
- [ ] Vendor product editing, inventory updates and archive actions
- [ ] Vendor order list, fulfillment and cancellation transitions
- [ ] KYC document uploads and verification evidence storage
- [ ] Vendor shipping labels, returns and payout dashboard

## Phase 4 — Checkout and payments
- [x] Parent order and vendor suborder creation
- [x] Transactional COD checkout with server-authoritative prices and stock checks
- [x] Customer-scoped checkout idempotency key and duplicate-submit protection
- [x] Customer order history and delivered-order return request
- [ ] bKash server-side payment initiation, execute/query verification and callback handling
- [ ] Nagad server-side payment initiation and provider-side verification
- [ ] SSLCommerz hosted checkout, IPN and validation API integration
- [ ] Sandbox testing, provider certification and production callback configuration
- [ ] Stale payment reservation expiry and provider reconciliation
- [ ] Refunds, chargebacks, commission ledger and vendor settlements
- [ ] Courier contracts, serviceability and rate tables

## Phase 5 — Admin and operations
- [x] RBAC-protected admin console and marketplace metrics
- [x] Vendor approval workflow
- [x] Product moderation, including medicine compliance-reference gate
- [x] Recent order overview
- [x] Return-request approval/rejection (decision only; no refund execution)
- [ ] Vendor suspension/reinstatement and customer support tooling
- [ ] Admin MFA, immutable audit log and security event review
- [ ] Order status / fulfillment controls and refund operations

## Phase 6 — Account and customer experience
- [x] Credentials registration and sign-in
- [x] Google OAuth sign-in foundation with verified-email check
- [ ] Email verification and transactional email templates
- [ ] Password reset and account recovery
- [ ] Account deletion, data export and session revocation
- [ ] Reviews, coupons, notifications and loyalty
- [ ] Pet profiles and tailored recommendations

## Phase 7 — Launch readiness
- [x] Unit test foundation and redirect-safety tests
- [x] Playwright storefront/auth smoke tests
- [x] CI typecheck, lint, unit, browser smoke and production build gates
- [ ] Database integration tests for multi-vendor checkout and rollback
- [ ] Two-vendor tenant-isolation and role-workflow tests
- [ ] Security scans, distributed rate limiting and bot protection
- [ ] Accessibility, performance and Core Web Vitals audit
- [ ] Backups, monitoring, alerting and incident runbooks
- [ ] Staging deployment and production smoke tests

## External launch dependencies
- MongoDB Atlas URI and replica-set transaction support
- Google OAuth credentials and authorized callback URLs
- Verified transactional email sender/domain
- Cloudinary cloud name, API key and API secret for signed product-image uploads
- bKash, Nagad and SSLCommerz merchant accounts, official API credentials, sandbox access and certification
- Delivery partner agreement, coverage and serviceability/fee data
- Legal review for medicines, prescription products, vendor identity, tax, returns and consumer disclosures

## Important operational boundaries
- COD checkout is the only payment method currently implemented.
- Product stock is decremented at COD order creation. Cancellation/restock operations need a complete audited order lifecycle before public launch.
- Admin return approval records a decision only; it does not refund or settle money.
- Prescription-controlled medicine listings remain blocked at checkout.
- Do not enable online payments or claim production readiness until provider callbacks are verified against official provider APIs and staging transactions.
