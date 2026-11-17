import "server-only";

export type SslCommerzCustomer = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
};

export type SslCommerzSessionInput = {
  transactionId: string;
  amount: number;
  customer: SslCommerzCustomer;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
};

type SslCommerzConfig = {
  storeId: string;
  storePassword: string;
  apiUrl: string;
  validationUrl: string;
};

type SslCommerzInitResponse = {
  status?: string;
  failedreason?: string;
  GatewayPageURL?: string;
  sessionkey?: string;
};

export type SslCommerzValidationResponse = {
  status?: string;
  tran_id?: string;
  val_id?: string;
  amount?: string;
  currency?: string;
  bank_tran_id?: string;
};

function getConfig(): SslCommerzConfig {
  const storeId = process.env.SSLCOMMERZ_STORE_ID?.trim();
  const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD?.trim();
  if (!storeId || !storePassword) throw new Error("SSLCOMMERZ_NOT_CONFIGURED");

  const live = process.env.SSLCOMMERZ_IS_LIVE === "true";
  const host = live ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com";
  return {
    storeId,
    storePassword,
    apiUrl: `${host}/gwprocess/v4/api.php`,
    validationUrl: `${host}/validator/api/validationserverAPI.php`
  };
}

export function isSslCommerzConfigured(): boolean {
  if (!process.env.SSLCOMMERZ_STORE_ID?.trim() || !process.env.SSLCOMMERZ_STORE_PASSWORD?.trim()) return false;
  try {
    getPaymentAppUrl();
    return true;
  } catch {
    return false;
  }
}

export function getPaymentAppUrl(): string {
  const configured = process.env.APP_URL?.trim();
  if (!configured) throw new Error("PAYMENT_APP_URL_NOT_CONFIGURED");
  const url = new URL(configured);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) {
    throw new Error("PAYMENT_APP_URL_MUST_USE_HTTPS");
  }
  return url.origin;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error("SSLCOMMERZ_REQUEST_FAILED");
  return response.json() as Promise<T>;
}

export async function initiateSslCommerzSession(input: SslCommerzSessionInput): Promise<{ gatewayUrl: string; sessionKey?: string }> {
  const config = getConfig();
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 10000000) {
    throw new Error("INVALID_PAYMENT_AMOUNT");
  }

  const body = new URLSearchParams({
    store_id: config.storeId,
    store_passwd: config.storePassword,
    total_amount: input.amount.toFixed(2),
    currency: "BDT",
    tran_id: input.transactionId,
    success_url: input.successUrl,
    fail_url: input.failUrl,
    cancel_url: input.cancelUrl,
    ipn_url: input.ipnUrl,
    shipping_method: "Courier",
    product_name: "LOVESONE marketplace order",
    product_category: "Pet supplies",
    product_profile: "general",
    cus_name: input.customer.name,
    cus_email: input.customer.email,
    cus_add1: input.customer.address.slice(0, 200),
    cus_city: input.customer.city.slice(0, 50),
    cus_postcode: "0000",
    cus_country: "Bangladesh",
    cus_phone: input.customer.phone,
    ship_name: input.customer.name,
    ship_add1: input.customer.address.slice(0, 200),
    ship_city: input.customer.city.slice(0, 50),
    ship_postcode: "0000",
    ship_country: "Bangladesh"
  });

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });
  const result = await readJson<SslCommerzInitResponse>(response);
  if (result.status !== "SUCCESS" || !result.GatewayPageURL) {
    throw new Error("SSLCOMMERZ_SESSION_CREATION_FAILED");
  }

  const gatewayUrl = new URL(result.GatewayPageURL);
  const allowedHosts = ["sandbox.sslcommerz.com", "securepay.sslcommerz.com"];
  if (gatewayUrl.protocol !== "https:" || !allowedHosts.includes(gatewayUrl.hostname)) {
    throw new Error("SSLCOMMERZ_INVALID_GATEWAY_URL");
  }
  return { gatewayUrl: gatewayUrl.toString(), ...(result.sessionkey ? { sessionKey: result.sessionkey } : {}) };
}

export async function validateSslCommerzTransaction(validationId: string): Promise<SslCommerzValidationResponse> {
  if (!validationId || validationId.length > 200) throw new Error("INVALID_PAYMENT_VALIDATION_ID");
  const config = getConfig();
  const query = new URLSearchParams({
    val_id: validationId,
    store_id: config.storeId,
    store_passwd: config.storePassword,
    format: "json"
  });
  const response = await fetch(`${config.validationUrl}?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });
  return readJson<SslCommerzValidationResponse>(response);
}
