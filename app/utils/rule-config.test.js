import { describe, expect, it } from "vitest";
import {
  findRuleOverlaps,
  formatRuleSummary,
  validateRuleConfig,
} from "./rule-config.js";

describe("formatRuleSummary", () => {
  it("describes AND logic with hide actions", () => {
    const summary = formatRuleSummary({
      conditions: {
        logic: "AND",
        items: [
          { type: "country", operator: "in", values: ["US"] },
          { type: "cart_total", operator: "gte", value: 100 },
        ],
      },
      actions: { hide: ["Cash on Delivery"] },
    });
    expect(summary).toContain("Country is one of US");
    expect(summary).toContain("Cart total is at least 100");
    expect(summary).toContain("Hide Cash on Delivery");
  });

  it("describes OR logic", () => {
    const summary = formatRuleSummary({
      conditions: {
        logic: "OR",
        items: [
          { type: "country", operator: "in", values: ["US"] },
          { type: "cart_total", operator: "gte", value: 500 },
        ],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(summary).toContain(" OR ");
    expect(summary).toContain("Hide PayPal");
  });

  it("uses product titles in summaries when available", () => {
    const summary = formatRuleSummary({
      conditions: {
        logic: "AND",
        items: [
          {
            type: "product",
            operator: "includes_any",
            productIds: ["gid://shopify/Product/1"],
            productSelections: [
              { id: "gid://shopify/Product/1", title: "Blue Shirt" },
            ],
          },
        ],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(summary).toContain("Blue Shirt");
  });
});

describe("validateRuleConfig", () => {
  it("requires at least one payment method to hide", () => {
    const result = validateRuleConfig({
      conditions: { logic: "AND", items: [{ type: "always" }] },
      actions: { hide: [] },
    });
    expect(result.errors.some((e) => e.message.includes("payment method"))).toBe(
      true,
    );
  });

  it("flags invalid country codes", () => {
    const result = validateRuleConfig({
      conditions: {
        logic: "AND",
        items: [{ type: "country", operator: "in", values: ["USA"] }],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(result.errors.some((e) => e.message.includes("country code"))).toBe(
      true,
    );
  });

  it("warns about short payment method names", () => {
    const result = validateRuleConfig({
      conditions: { logic: "AND", items: [{ type: "always" }] },
      actions: { hide: ["COD"] },
    });
    expect(result.warnings.some((w) => w.message.includes("very short"))).toBe(
      true,
    );
  });
});

describe("findRuleOverlaps", () => {
  it("detects shared hide targets across rules", () => {
    const overlaps = findRuleOverlaps([
      {
        title: "Rule A",
        config: { actions: { hide: ["PayPal", "COD"] } },
      },
      {
        title: "Rule B",
        config: { actions: { hide: ["paypal"] } },
      },
    ]);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].methods).toContain("PayPal");
  });
});
