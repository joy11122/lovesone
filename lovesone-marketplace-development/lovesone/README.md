# LOVESONE — Bangladesh Pet Marketplace

**Brand line:** A little more love for every pet.

LOVESONE is a multi-vendor pet marketplace foundation for customers, sellers and marketplace administrators in Bangladesh. The storefront uses a warm cream-and-peach visual system with responsive layouts and a browser-persisted shopping bag.

## Application routes

| Route | Purpose | Access |
|---|---|---|
| / | Brand homepage and category discovery | Public |
| /shop | Active marketplace catalogue with category filtering | Public |
| /product/[slug] | Product details, stock status and add-to-bag | Public |
| /cart | Browser-persisted shopping bag | Public |
| /checkout | COD checkout with server-side stock validation | Customer |
| /order/success | Verified order confirmation | Customer |
| /login | Email/password and Google sign-in | Public |
| /register | Customer registration | Public |
| /auth/redirect | Role-aware post-authentication destination | Authenticated |
| /account | Customer order history and return requests | Customer |
| /vendor/register | Seller application | Public page; signed-in customer required to submit |
| /vendor/dashboard | Seller listing workspace | Approved vendor |
| /admin | Seller approvals, product moderation and order overview | Admin / super-admin |

## Implemented commerce flow

1. Customers browse active products and add them to a browser-persisted cart.
2. Checkout accepts COD only. The server reloads authoritative prices and seller IDs, validates stock and prescription restrictions, decrements inventory and creates a parent order with vendor suborders in a MongoDB transaction.
3. Checkout requests include a customer-scoped idempotency key so a retry after a network timeout does not create a second order.
4. Sellers submit product listings. New listings remain pending until an administrator approves them.
5. Customers can request returns for delivered orders. Admin approval records the decision; it does not issue a payment refund.

## Authentication and access control

- Auth.js v5 with credentials and Google OAuth.
- Customer passwords are hashed with bcrypt.
- Google sign-in requires a verified Google email.
- Role claims are refreshed from active database users; suspended or deleted accounts lose the authenticated session identity on the next JWT check.
- Seller applications are linked to customer accounts. Admin approval changes the profile and account role in a MongoDB transaction.
- Vendor product creation is scoped to the authenticated vendor and requires a verified seller profile.

## Local development

Use Node.js 20.9 or newer.

~~~bash
npm install
npm run dev
~~~

Configure these server-side environment variables in .env.local and in the deployment provider:

- MONGODB_URI (MongoDB Atlas replica-set connection string; transactions are required)
- AUTH_SECRET
- AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET (Google sign-in)
- AUTH_URL / deployment URL configuration appropriate to the hosting environment

Do not commit secrets. The super-admin bootstrap script is a trusted local operation and must never be exposed as a public endpoint.

## Quality commands

~~~bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
~~~

GitHub Actions runs typecheck, lint, unit tests, Playwright browser smoke tests and the production build on pushes and pull requests to main.

## Known implementation and launch boundaries

- Checkout currently supports **cash on delivery only**. bKash, Nagad and SSLCommerz adapters, initiation routes, callback/IPN verification and provider reconciliation are not present in the current source tree. Do not enable or advertise online payment until these are implemented and sandbox-certified.
- Product image upload/gallery, product variants, wishlist and a persistent server-side cart are not implemented. Current product visuals are category illustrations.
- Vendor order fulfillment, inventory editing, KYC document storage, payout ledger, settlement statements and commission accounting are not implemented.
- Email verification, password reset, account deletion, session revocation, distributed rate limiting, audit-log retention and operational monitoring are not implemented.
- Courier pricing, shipping labels, automated refunds, chargebacks and delivery partner integrations are not implemented.
- Prescription-controlled medicine listings are blocked at checkout pending a lawful prescription-review workflow.
- MongoDB transactions require a replica-set deployment such as MongoDB Atlas.

A successful source push or CI build is not proof of live database connectivity, payment certification, courier serviceability or production order processing. Review docs/PRODUCTION_CHECKLIST.md before launch.
