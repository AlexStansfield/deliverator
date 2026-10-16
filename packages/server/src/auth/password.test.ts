import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, generatePassword } from "./password.js";

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });

  it("rejects malformed hashes", () => {
    expect(verifyPassword("x", "not-a-hash")).toBe(false);
  });

  it("generates readable random passwords", () => {
    const p = generatePassword();
    expect(p).toHaveLength(20);
    expect(p).toMatch(/^[A-Za-z2-9]+$/);
    expect(p).not.toMatch(/[0OIl1]/);
    expect(generatePassword()).not.toBe(p);
  });
});
