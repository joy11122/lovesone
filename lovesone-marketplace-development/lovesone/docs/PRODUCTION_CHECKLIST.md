# Production release checklist

This starter is not approved for public launch until every required item below is completed and tested.

## Infrastructure and accounts
- [ ] Provision MongoDB Atlas production cluster with replica-set transactions enabled.
- [ ] Create a least-privilege database user and restrict network access.
- [ ] Configure Vercel project, production domain, preview environment and rollback process.
- [ ] Configure AUTH_SECRET and Google OAuth credentials with exact production callback URLs.
- [ ] Configure verified email sender/domain and transactional templates.
- [ ] Configure Cloudinary account, signed upload endpoint and file-type/size restrictions.
- [ ] Complete merchant onboarding and sandbox/live approval for each payment provider.
- [ ] Confirm courier coverage, delivery prices, COD settlement and reverse logistics.

## Application readiness
- [ ] Implement email verification, password reset, account deletion and session revocation.
- [ ] Add persistent cart, product detail/variant management and stock reservation expiry.
- [x] Add customer cart/checkout UI and server-side COD order creation.
- [x] Add bKash, Nagad and SSLCommerz server-side checkout adapters and provider-side payment verification callbacks.
- [ ] Complete provider sandbox certification, production callback/IPN validation, automated reconciliation, stale reservation expiry, refunds and replay/concurrency integration tests.
- [ ] Add vendor payout ledger, settlement statements, refund and chargeback handling.
- [ ] Add complete vendor KYC and admin review UI; bootstrap first super-admin securely.
- [ ] Add support tooling, returns/disputes and customer order tracking.
- [ ] Add distributed rate limiting, bot protection, audit log retention and alerting.
- [ ] Add legal review for marketplace terms, privacy, consumer rights, tax and medicine sales.
- [ ] Implement prescription upload/review and pharmacist authorization before prescription products can be sold.

## Verification gates
- [ ] `npm install`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run test:e2e`
- [ ] `npm run build`
- [ ] Test vendor isolation with two different vendor accounts.
- [ ] Test concurrent checkout, duplicate webhooks, stock rollback and idempotent retries.
- [ ] Test Google OAuth and credentials flows against production-like configuration.
- [ ] Test accessibility, mobile layouts, Core Web Vitals and SEO metadata.
- [ ] Run dependency, secret, application and infrastructure security scans.
- [ ] Restore a backup into a clean environment and verify recovery procedure.
