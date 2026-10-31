# LOVESONE — Bangladesh Pet Marketplace

**Brand line:** A little more love for every pet.

LOVESONE is a playful, colorful multi-vendor marketplace for pet parents in Bangladesh. The experience uses warm cream and peach surfaces, rounded cards, friendly pet illustrations, soft shadows and responsive layouts.

## Application routes

| Route | Purpose | Access |
|---|---|---|
| `/` | Brand homepage and category discovery | Public |
| `/shop` | Active marketplace catalogue | Public |
| `/product/[slug]` | Product details and add-to-bag | Public |
| `/cart` | Persistent browser shopping bag | Public |
| `/checkout` | Customer checkout (cash on delivery) | Customer |
| `/login` | Email/password and Google sign-in | Public |
| `/register` | Customer registration | Public |
| `/account` | Customer order history and return requests | Customer |
| `/vendor/register` | Seller application | Public page; signed-in customer required to submit |
| `/vendor/dashboard` | Seller listing workspace | Approved vendor |
| `/admin` | Seller approvals, product moderation and order overview | Admin / super-admin |

## Commerce flow

1. Customers browse active products and add them to a browser-persisted cart.
2. Checkout accepts COD orders only. The server reloads current product prices and seller IDs, checks stock and prescription restrictions, reserves stock and creates a parent order with vendor suborders in a MongoDB transaction.
3. Sellers submit product listings from their dashboard. New listings remain pending until an administrator approves them.
4. Customers can request returns for delivered orders. Admin approval records the decision; it does not issue a payment refund.

## Authentication and seller onboarding

- Auth.js v5 with credentials and Google OAuth.
- Customer registration hashes passwords with bcrypt.
- Seller applications are linked to an existing customer account.
- An administrator must approve the application before the account gains vendor access.
- Vendor product creation is scoped to the authenticated vendor and requires a verified seller profile.

## Local development

Use Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Configure these server-side environment variables in `.env.local` and in the deployment provider:

- `MONGODB_URI` (MongoDB Atlas replica-set connection string; transactions are required)
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` (Google sign-in)
- `NEXTAUTH_URL` or the Auth.js deployment URL configuration appropriate to the hosting environment

Do not commit secrets. The super-admin bootstrap script is a trusted local operation and must never be exposed as a public endpoint.

## Quality commands

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

## Current implementation boundary

- Checkout currently supports **cash on delivery only**. bKash, Nagad and SSLCommerz credentials, hosted checkout, callbacks and certification are not implemented in these storefront routes and must not be presented as active payment options.
- Courier pricing, vendor payout ledger and reconciliation, automated refunds, KYC document storage, image upload, email verification/password recovery, rate limiting, audit logs and production monitoring remain incomplete.
- The seller workspace currently supports listing submission and review status. Full inventory editing, order fulfillment and payout management are not included yet.
- Prescription-controlled medicine listings are blocked at checkout pending a lawful prescription-review workflow.
- MongoDB transactions require a replica-set deployment such as MongoDB Atlas.

Never treat a successful source push as proof that production deployment, payment certification or live order processing has passed.