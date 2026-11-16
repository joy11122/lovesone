import { isIP } from "node:net";

/**
 * Read the original client IP only from headers supplied by the trusted
 * hosting proxy. On Vercel, x-vercel-forwarded-for is preferred; the
 * x-forwarded-for fallback is valid only when the deployment proxy overwrites
 * incoming values rather than passing client-supplied values through.
 */
export function getTrustedClientIp(headers: Headers): string | null {
  const candidates = [
    headers.get("x-vercel-forwarded-for"),
    headers.get("x-forwarded-for")
  ];

  for (const value of candidates) {
    const candidate = value?.split(",")[0]?.trim();
    if (candidate && isIP(candidate)) return candidate;
  }

  return null;
}
