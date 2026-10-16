import { describe, it, expect } from "vitest";
import { normaliseBasePath } from "./config.js";

describe("normaliseBasePath", () => {
  it("normalises common spellings", () => {
    expect(normaliseBasePath(undefined)).toBe("");
    expect(normaliseBasePath("")).toBe("");
    expect(normaliseBasePath("/")).toBe("");
    expect(normaliseBasePath("downloader")).toBe("/downloader");
    expect(normaliseBasePath("/downloader/")).toBe("/downloader");
    expect(normaliseBasePath("/apps/dl//")).toBe("/apps/dl");
  });
  it("rejects junk", () => {
    expect(() => normaliseBasePath("/bad path")).toThrow();
  });
});
