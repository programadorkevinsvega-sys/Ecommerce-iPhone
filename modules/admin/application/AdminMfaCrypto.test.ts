import { describe, expect, it } from "vitest";
import {
  decodeBase32,
  encodeBase32,
  generateTotpSecret,
  matchTotpStep,
  createRecoveryCodes,
  normalizeRecoveryCode,
  totpAtStep,
} from "./AdminMfaCrypto";

describe("admin TOTP and recovery code primitives", () => {
  it("round-trips base32 secrets", () => {
    const bytes = Uint8Array.from([0, 1, 2, 253, 254, 255]);
    expect(decodeBase32(encodeBase32(bytes))).toEqual(bytes);
  });

  it("matches the RFC 6238 SHA-1 six-digit test vector", async () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(await totpAtStep(secret, 1)).toBe("287082");
    expect(await matchTotpStep(secret, "287082", 59_000)).toBe(1);
    expect(await matchTotpStep(secret, "287082", 59_000, 1)).toBeNull();
  });

  it("generates high-entropy one-time recovery codes with strict normalization", () => {
    const codes = createRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes.every((code) => /^[A-F0-9]{8}(-[A-F0-9]{8}){3}$/.test(code))).toBe(true);
    expect(normalizeRecoveryCode(codes[0]!)).toMatch(/^[A-F0-9]{32}$/);
    expect(normalizeRecoveryCode("not-a-recovery-code")).toBeNull();
  });

  it("generates a fresh 160-bit TOTP secret", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  });
});
