import { describe, expect, it } from "vitest";
import { safeInternalPath } from "../../src/lib/security";

describe("safeInternalPath", () => {
  it("keeps safe same-origin paths including query strings", () => {
    expect(safeInternalPath("/checkout?step=delivery")).toBe("/checkout?step=delivery");
  });

  it("rejects protocol-relative redirects", () => {
    expect(safeInternalPath("//attacker.example")).toBe("/account");
  });

  it("rejects absolute external URLs", () => {
    expect(safeInternalPath("https://attacker.example/login")).toBe("/account");
  });

  it("rejects backslash-based URL confusion", () => {
    expect(safeInternalPath("/\\attacker.example")).toBe("/account");
  });

  it("uses the configured fallback for missing or malformed paths", () => {
    expect(safeInternalPath(undefined, "/auth/redirect")).toBe("/auth/redirect");
    expect(safeInternalPath("javascript:alert(1)")).toBe("/account");
  });
});
