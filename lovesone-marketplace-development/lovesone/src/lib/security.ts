/**
 * Accept only same-origin absolute paths for post-authentication redirects.
 * Reject protocol-relative URLs, backslashes and control characters.
 */
export function safeInternalPath(value: string | null | undefined, fallback = "/account"): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }

  try {
    const base = "https://lovesone.invalid";
    const parsed = new URL(value, base);
    if (parsed.origin !== base) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
