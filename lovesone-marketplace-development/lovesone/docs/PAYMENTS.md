# Payment integration — SSLCommerz

LOVESONE keeps COD available and supports SSLCommerz hosted checkout when the merchant configuration is present. Payment secrets are server-only and must never be prefixed with `NEXT_PUBLIC_`.

## Environment configuration

Set these values in the deployment provider's encrypted environment settings and local `.env.local` for sandbox testing:

- `APP_URL`: canonical application origin, for example `https://shop.example.com`. Production must use HTTPS.
- `SSLCOMMERZ_STORE_ID`: merchant store ID supplied by SSLCommerz.
- `SSLCOMMERZ_STORE_PASSWORD`: merchant store password supplied by SSLCommerz.
- `SSLCOMMERZ_IS_LIVE`: `false` for sandbox (default); `true` only after the merchant account is certified for live transactions.
- `CRON_SECRET`: long random secret used to authenticate the unpaid-order expiry job.

The checkout UI exposes online payment only when the store ID, password and valid application URL are configured. SSLCommerz documents an amount range of ৳10.00–৳500,000.00 per transaction; checkout rejects totals outside that range. Never commit real credentials or paste them into source files.

## Request and verification flow

1. The customer chooses COD or SSLCommerz. The checkout API independently validates the choice and refuses SSLCommerz if merchant configuration is absent.
2. The server calculates prices, validates stock and coupon use, reserves stock and creates the parent order plus vendor suborders in a MongoDB transaction. The order stores `paymentMethod=sslcommerz` and remains unpaid.
3. The authenticated customer starts a payment attempt. The server locks the order to one active transaction ID and creates a hosted SSLCommerz session.
4. The browser is redirected only to an HTTPS gateway URL on an SSLCommerz host allowlist.
5. The success callback and IPN both call the SSLCommerz validation API from the server. The application checks final provider status, transaction ID, exact amount (to two decimal places) and BDT currency. Failure/cancel redirects and stale attempts are reconciled using the provider transaction-query API; browser-supplied status is never trusted.
6. The payment transaction and order are marked paid together in a MongoDB transaction. Repeated callbacks are idempotent. Browser redirects alone never mark an order paid.
7. Vendors cannot process non-COD orders until payment is verified. Customers cannot cancel an order while a payment attempt is active.

## Unpaid order expiry

Hosted payment attempts are short-lived. The protected endpoint `GET /api/cron/expire-unpaid-orders` expires online orders still unpaid after 30 minutes, restores reserved stock, releases coupon redemption and marks the order cancelled. It requires:

```http
Authorization: Bearer <CRON_SECRET>
```

Configure a trusted scheduler to call this endpoint every 10 minutes. The job checks the provider transaction-query API before releasing stock, so a delayed successful callback is reconciled instead of expiring a paid order. The endpoint processes at most 50 orders per invocation; repeat calls drain larger backlogs. Do not expose the cron secret in browser code.

## Sandbox certification checklist

- [ ] Configure sandbox merchant credentials and HTTPS staging `APP_URL`.
- [ ] Complete successful card and supported mobile/internet banking transactions.
- [ ] Verify failed and cancelled payment redirects do not mark orders paid.
- [ ] Verify valid IPN and success callback can arrive in either order without duplicate payment.
- [ ] Replay the same callback and confirm payment remains idempotent.
- [ ] Tamper with transaction ID, amount and currency in test callbacks; all must be rejected.
- [ ] Confirm an unpaid order cannot be fulfilled by a vendor.
- [ ] Confirm abandoned orders expire, stock is restored and coupon usage is released.
- [ ] Confirm paid orders are not expired by the cleanup job.
- [ ] Obtain provider approval before setting `SSLCOMMERZ_IS_LIVE=true`.

## Official provider references\n\n- [SSLCommerz Developer Documentation — Hosted checkout and validation](https://developer.sslcommerz.com/doc/v4/)\n- [SSLCommerz Transaction Query API](https://sandbox-gw.sslcommerz.com/doc/v4/order-query.html)\n\n## Current scope

SSLCommerz is the first online provider. bKash and Nagad adapters, automated refunds, chargebacks, vendor settlements and reconciliation reporting remain separate work. A successful CI run is not proof of merchant certification or live payment readiness.
