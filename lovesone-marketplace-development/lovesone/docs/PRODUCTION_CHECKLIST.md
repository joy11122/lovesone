# Production release checklist

The current application is a development marketplace foundation. Do not approve public launch until every required item below is completed and verified in a staging environment.

## Infrastructure and accounts
- [ ] Provision MongoDB Atlas production cluster with replica-set transactions enabled.
- [ ] Create a least-privilege database user and restrict network access.
- [ ] Configure Vercel production, preview environments, custom domain and rollback procedure.
- [ ] Configure AUTH_SECRET and Google OAuth credentials with exact production callback URLs.
- [ ] Configure a verified email sender/domain and transactional templates.
- [ ] Configure Cloudinary credentials in encrypted deployment environment settings and verify production upload limits, retention and deletion policy.
- [ ] Complete merchant onboarding, sandbox testing and certification for each payment provider.
- [ ] Confirm courier coverage, delivery prices, COD settlement and reverse logistics.
- [ ] Configure backups, retention, restore drills, monitoring and alerting.

## Application readiness
- [x] Customer registration and credentials authentication foundation.
- [x] Google OAuth foundation with verified-email check.
- [x] Customer cart and server-side COD order creation.
- [x] Server-authoritative product price and stock checks at checkout.
- [x] Checkout idempotency key and duplicate-submit protection.
- [x] Vendor application, admin approval and product moderation foundations.
- [x] Customer order history and return-request workflow (decision only).
- [ ] Implement email verification, password reset, account deletion and session revocation.
- [x] Add vendor-owned single cover-image upload with server-side signing, file type/size validation and vendor-folder ownership.
- [ ] Add multi-image gallery, product variants, wishlist and persistent account cart.
- [x] Vendor-scoped order fulfillment, price/stock editing, pre-shipment cancellation and transactional stock restoration are implemented. COD collection reconciliation and operational review are still required.
- [ ] Implement bKash, Nagad and SSLCommerz server-side initiation, provider-side verification, callbacks/IPN and idempotent event handling.
- [ ] Complete provider sandbox certification, production callback validation, automated reconciliation, stale payment reservation expiry, refunds and replay/concurrency tests.
- [ ] Add vendor payout ledger, settlement statements, commission accounting and chargeback handling.
- [ ] Add complete vendor KYC and admin review UI; bootstrap first super-admin securely.
- [ ] Add support tooling, order tracking, returns/disputes and audited refund processing.
- [ ] Add distributed rate limiting, bot protection, audit log retention and alerting.
- [ ] Complete legal review for marketplace terms, privacy, consumer rights, tax and medicine sales.
- [ ] Implement prescription upload/review and pharmacist authorization before prescription products can be sold.

## Verification gates
- [x] TypeScript typecheck, ESLint, unit tests, Playwright smoke tests and production build in CI.
- [ ] npm audit and dependency/license review.
- [ ] Database integration tests against a disposable replica-set MongoDB.
- [ ] Test vendor isolation with two different vendor accounts.
- [ ] Test concurrent checkout, duplicate callbacks, stock rollback and idempotent retries.
- [ ] Test Google OAuth and credentials flows against production-like configuration.
- [ ] Test accessibility, mobile layouts, Core Web Vitals and SEO metadata.
- [ ] Run secret, application and infrastructure security scans.
- [ ] Restore a backup into a clean environment and verify recovery.
- [ ] Complete staging deployment and role-based production smoke tests.

## External launch blockers
- Production credentials and account approvals cannot be created by source-code changes. They must be supplied by the business owner and configured only in the deployment provider's encrypted environment settings.
- Payment gateway implementation must follow each provider's current official documentation. Never trust browser redirects or client-supplied payment status; verify transaction identity, amount, currency and final provider status server-side.
- Courier pricing, medicine compliance, KYC, refunds and vendor payouts require operational and legal decisions in addition to code.
