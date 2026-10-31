# LOVESONE — Multi-vendor Pet Marketplace

LOVESONE is a Bangladesh-first pet marketplace for cats, dogs, birds, fish, rabbits and small pets. The codebase includes a responsive storefront, Auth.js authentication, MongoDB/Mongoose models, role-protected customer/vendor/admin workspaces, product moderation, transactional multi-vendor orders, COD and credential-gated online payment adapters.

## Current application areas
- `/` and `/shop` — public storefront and active product catalogue
- `/register` and `/login` — customer registration and sign-in (Google OAuth requires credentials)
- `/account` — customer order history and account summary
- `/vendor/register` — seller application
- `/vendor/dashboard` — seller inventory, listing submission/edit/archive and order fulfillment
- `/admin` — platform metrics, seller approvals, product moderation and recent orders

## Local development
1. Use Node.js 20.9+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and configure MongoDB Atlas, Auth.js and Google OAuth values.
4. Run `npm run dev`.

MongoDB transactions require a replica-set deployment (MongoDB Atlas provides this). Never commit credentials or production secrets.

## Quality commands
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run build`

## Important marketplace invariants
1. Every vendor-owned resource is scoped by the authenticated vendor ID on the server.
2. A checkout creates one parent order and one suborder per vendor.
3. Stock reservation and order creation execute in a MongoDB transaction; the client never supplies authoritative price, seller, commission or stock values.
4. Vendor fulfillment transitions are constrained server-side.
5. Prescription-controlled medicines remain blocked from checkout until a lawful prescription-review workflow is implemented. Admin approval requires a compliance reference for medicine listings.
6. Vendor payout totals shown in the dashboard are operational summaries, not a settlement ledger. Do not use them to pay vendors until a ledger and reconciliation workflow is deployed.

## Not launch-ready yet
Image upload, KYC document storage, courier integration, payout ledger, automated refunds/disputes, email verification/password reset, rate limiting, audit logs, legal review and full integration/E2E tests remain incomplete. Online payment adapters are implemented but merchant onboarding and certification remain external blockers. See `docs/ROADMAP.md` and `docs/PRODUCTION_CHECKLIST.md`.

## Environment
See `.env.example`. Configure secrets in the deployment provider, not in source control.

## New storefront flows
- `/shop` now loads active marketplace listings from MongoDB, with search, pet and category filters.
- `/product/[slug]` displays an active listing and supports adding it to the persistent browser cart.
- `/cart` and `/checkout` provide cart review and checkout. Product price, vendor, stock and prescription restrictions are always rechecked server-side. Payment options include COD, bKash, Nagad and SSLCommerz; online methods remain disabled until credentials are configured.
- Customers can request a return on delivered orders for delivered orders. Admins can approve or reject requests; approval does not itself issue a refund.

## Online payment gateway setup (credentials can be added later)

The server-side adapters are prepared for hosted checkout with bKash Tokenized Checkout, Nagad Online PG and SSLCommerz. Never expose any of these credentials through `NEXT_PUBLIC_*` variables or client-side code. Add the following values to `.env.local` and the deployment secret manager only after merchant onboarding:

- SSLCommerz: `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_SANDBOX=true` (use the provider-approved live setting only after certification).
- bKash: `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_SANDBOX=true`.
- Nagad: `NAGAD_MERCHANT_ID`, `NAGAD_MERCHANT_NUMBER`, `NAGAD_MERCHANT_PRIVATE_KEY`, `NAGAD_GATEWAY_PUBLIC_KEY`, `NAGAD_SERVER_IP`, `NAGAD_BASE_URL` (use the exact sandbox/live API host supplied by Nagad), `NAGAD_SANDBOX=true`.
- Set `NEXT_PUBLIC_APP_URL` to the exact public HTTPS origin in staging/production. Optional `*_BASE_URL` overrides are intended for provider-issued environments only.

Callback endpoints to register with the providers:

- SSLCommerz success/fail/cancel/IPN: `/api/payments/sslcommerz/success`, `/api/payments/sslcommerz/fail`, `/api/payments/sslcommerz/cancel`, `/api/payments/sslcommerz/ipn`. Register the IPN endpoint in the SSLCommerz merchant panel.
- bKash callback: `/api/payments/bkash/callback` (sent as `callbackURL` during payment creation).
- Nagad callback: `/api/payments/nagad/callback` (sent as `merchantCallbackURL` during checkout creation).

The order total, currency, provider order reference and payment status are checked server-side before marking an order paid. Online payment attempts reserve stock at order creation. Unverified/ambiguous callbacks leave the order pending; do not manually mark these orders paid. Reconcile them with the provider dashboard before taking action. A verified failure can be finalized by the internal settlement service, which restores reserved stock transactionally.

**Not yet certified:** no merchant credentials are included, and no live or sandbox transaction has been run. Complete each provider's sandbox onboarding and callback/IPN tests before enabling online payment in production. Nagad's RSA keys must be PEM-encoded and the merchant IP must match the value registered with Nagad.

## First super-admin bootstrap
Create the target account through the normal registration flow, then run the one-time script in a trusted local environment with `MONGODB_URI` and `BOOTSTRAP_ADMIN_EMAIL` set:

```bash
npm run bootstrap:admin
```

The script refuses to run if a super-admin already exists. Remove the bootstrap email from the environment immediately afterward. Never expose this script as a public HTTP endpoint.

## Current launch boundary
COD is available. bKash, Nagad and SSLCommerz server-side adapters, hosted checkout initiation, provider callbacks and payment verification routes are scaffolded in code, but online payments are not launch-enabled until merchant credentials, gateway-specific sandbox tests, callback/IPN setup and provider certification are completed. Courier pricing, automated refunds/payouts, KYC document storage, email verification/recovery, prescription verification, distributed rate limiting and production monitoring remain external or operational launch blockers.
