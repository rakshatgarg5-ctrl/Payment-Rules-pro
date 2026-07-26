import { describe, expect, it } from "vitest";
import { run } from "./run";

const paymentMethods = [
  { id: "gid://shopify/PaymentCustomizationPaymentMethod/1", name: "Cash on Delivery" },
  { id: "gid://shopify/PaymentCustomizationPaymentMethod/2", name: "PayPal" },
  { id: "gid://shopify/PaymentCustomizationPaymentMethod/3", name: "Money Order" },
];

function baseInput(overrides = {}) {
  return {
    cart: {
      cost: { totalAmount: { amount: "50.0" } },
      buyerIdentity: { customer: null },
      deliveryGroups: [{ deliveryAddress: { countryCode: "US" } }],
      lines: [
        {
          merchandise: {
            product: { id: "gid://shopify/Product/1" },
          },
        },
      ],
    },
    paymentMethods,
    paymentCustomization: {
      metafield: {
        value: JSON.stringify({
          enabled: true,
          conditions: { logic: "AND", items: [] },
          actions: {
            hide: ["Cash on Delivery"],
            rename: [{ from: "Money Order", to: "Bank Transfer" }],
            sort: ["PayPal", "Money Order", "Cash on Delivery"],
          },
        }),
      },
    },
    ...overrides,
  };
}

describe("payment rules run", () => {
  it("returns no changes when metafield is empty", () => {
    const result = run({
      ...baseInput(),
      paymentCustomization: { metafield: null },
    });
    expect(result.operations).toEqual([]);
  });

  it("applies hide, rename, and sort when conditions are empty", () => {
    const result = run(baseInput());
    expect(result.operations).toEqual([
      { hide: { paymentMethodId: paymentMethods[0].id } },
      {
        rename: {
          paymentMethodId: paymentMethods[2].id,
          name: "Bank Transfer",
        },
      },
      { move: { paymentMethodId: paymentMethods[1].id, index: 0 } },
      { move: { paymentMethodId: paymentMethods[2].id, index: 1 } },
      { move: { paymentMethodId: paymentMethods[0].id, index: 2 } },
    ]);
  });

  it("matches cart total condition", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: {
        logic: "AND",
        items: [{ type: "cart_total", operator: "gte", value: 100 }],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(run(input).operations).toEqual([]);

    input.cart.cost.totalAmount.amount = "150.0";
    expect(run(input).operations).toEqual([
      { hide: { paymentMethodId: paymentMethods[1].id } },
    ]);
  });

  it("matches country condition", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: {
        logic: "AND",
        items: [{ type: "country", operator: "in", values: ["CA", "GB"] }],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(run(input).operations).toEqual([]);

    input.cart.deliveryGroups[0].deliveryAddress.countryCode = "CA";
    expect(run(input).operations).toHaveLength(1);
  });

  it("matches product condition", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: {
        logic: "AND",
        items: [
          {
            type: "product",
            operator: "includes_any",
            productIds: ["gid://shopify/Product/99"],
          },
        ],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(run(input).operations).toEqual([]);

    input.cart.lines[0].merchandise.product.id = "gid://shopify/Product/99";
    expect(run(input).operations).toHaveLength(1);
  });

  it("fails customer_tag for guests", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: {
        logic: "AND",
        items: [
          {
            type: "customer_tag",
            operator: "includes_any",
            values: ["wholesale"],
          },
        ],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(run(input).operations).toEqual([]);
  });

  it("matches customer_tag when customer has tag", () => {
    const input = baseInput();
    input.cart.buyerIdentity.customer = {
      hasTags: [
        { tag: "wholesale", hasTag: true },
        { tag: "vip", hasTag: false },
      ],
    };
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: {
        logic: "AND",
        items: [
          {
            type: "customer_tag",
            operator: "includes_any",
            values: ["wholesale"],
          },
        ],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(run(input).operations).toHaveLength(1);
  });

  it("skips when disabled", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: false,
      conditions: { logic: "AND", items: [] },
      actions: { hide: ["PayPal"] },
    });
    expect(run(input).operations).toEqual([]);
  });
});
