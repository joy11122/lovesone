# LOVESONE delivery roadmap

## Phase 1 — Foundation
- [x] Brand system, responsive storefront shell and landing page
- [x] Project config, environment template and base docs
- [x] Core data models, MongoDB connection and Zod validation foundations
- [x] Auth.js Google/Credentials providers and role-aware session mapping (credentials still require secrets/configuration)
- [ ] Verify MongoDB replica-set transactions against a provisioned Atlas environment

## Phase 2 — Storefront
- [x] Starter category and product presentation
- [x] Public active-product API with search, pet/category filters, sorting and pagination
- [ ] Product detail pages, variants, image gallery and stock display
- [ ] Persistent cart and wishlist
- [ ] Complete responsive customer checkout and address book

## Phase 3 — Vendors
- [x] Vendor application and profile persistence
- [x] Vendor-scoped dashboard with inventory overview, low-stock/pending-review metrics and net-sales summary
- [x] Vendor product submission, price/stock editing and archive actions
- [x] Vendor order list and guarded fulfillment transitions
- [ ] KYC document uploads and manual verification evidence storage
- [ ] Product image upload/storage and complete listing editor
- [ ] Vendor shipping labels, cancellation handling and returns

## Phase 4 — Checkout
- [x] Order and vendor suborder schema
- [x] Transactional multi-vendor order creation with stock decrement and idempotency key
- [x] Customer order-history dashboard
- [x] COD order API foundation
- [ ] Address book, delivery pricing and shipping integrations
- [x] bKash/Nagad/SSLCommerz server-side payment adapters and hosted checkout initiation (credentials required)
- [ ] Provider sandbox certification and end-to-end transaction verification
- [x] SSLCommerz IPN validation and bKash/Nagad server-side payment verification callbacks
- [ ] Automated provider reconciliation, refunds and stale payment reservation expiry
- [ ] Commission ledger, payout workflow and settlement statements

## Phase 5 — Admin
- [x] RBAC-protected admin console and platform metrics
- [x] Vendor approval workflow with transactional role/profile update
- [x] Product moderation queue, including medicine compliance-reference gate
- [x] Recent order oversight
- [ ] Vendor suspension/reinstatement, customer support and audit log explorer
- [ ] Returns, disputes, refunds and configurable commission policies
- [ ] Secure first-super-admin bootstrap and admin MFA

## Phase 6 — Growth
- [ ] Reviews, coupons, notifications and loyalty
- [ ] Pet profiles and tailored recommendations
- [ ] Recurring orders/subscriptions after operational validation
- [ ] Bengali localization

## Phase 7 — Launch readiness
- [ ] Automated unit, integration and browser tests for all role workflows
- [ ] Security review, distributed rate limiting and abuse controls
- [ ] Accessibility, performance and SEO audit
- [ ] Backups, monitoring, alerting and incident runbooks
- [ ] Staging deployment and production smoke tests

## External launch blockers
- MongoDB Atlas URI and replica-set availability
- Google OAuth credentials and authorized callback URLs
- Email provider/domain verification
- Cloudinary (or equivalent) account and signed upload credentials
- Bangladesh merchant accounts and approved payment gateway contracts
- Delivery partner agreement and serviceability/fee data
- Legal review for medicines, prescription products, vendor identity, tax, returns and consumer disclosures

## Delivery update — 2026-10-31
- [x] Persistent browser cart with stock-bounded quantity controls
- [x] Live marketplace product cards, product detail pages and search/filter UI
- [x] Customer COD checkout UI wired to the transactional order API
- [x] Customer return request submission for delivered orders
- [x] Admin return-request review queue (approval/rejection only; no automatic refund)
- [x] One-time, CLI-only super-admin bootstrap script (promotes an existing active account; refuses to overwrite an existing super-admin)

## Remaining external / production launch dependencies
- Payment adapters and checkout/callback routes are in code. Merchant credentials, provider-specific sandbox testing/certification, merchant-panel IPN configuration (SSLCommerz), live approval and production smoke tests are still required before enabling online payments in production.
- Courier contracts, serviceability and rate tables are required before shipping fees and labels can be calculated.
- Transactional email provider/domain, object-storage credentials, distributed rate-limit store and monitoring/alerting credentials are required for verified email, account recovery, image uploads, abuse protection and operational alerts.
- Prescription medicine sales remain blocked until a licensed review and prescription-verification process has legal approval and is implemented.
- Refund execution, vendor payouts, chargeback/dispute processing and accounting reconciliation require merchant/bank workflows; admin return approval is not a refund.
- MongoDB Atlas must support replica-set transactions. Run the real integration suite against a provisioned staging database before launch.


## Payment gateway implementation notes
- Server adapters live in `src/services/payments/` and are called only from server routes. The checkout form never receives provider secrets.
- Provider callbacks validate the transaction with the provider before changing `paymentStatus` to `paid`; SSLCommerz IPN also uses its validation API.
- A pending online order has reserved stock. Unverified callback/network failures intentionally remain pending to avoid incorrectly releasing stock after a customer may have paid. Add provider reconciliation and expiry before production scale.
- No sandbox certification, merchant credentials, production credentials or live payment tests have been completed.
