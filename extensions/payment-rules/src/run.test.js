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
      cost: {
        totalAmount: { amount: "50.0" },
        subtotalAmount: { amount: "45.0" },
      },
      buyerIdentity: { customer: null },
      deliveryGroups: [
        {
          deliveryAddress: {
            countryCode: "US",
            provinceCode: "CA",
            zip: "90210",
            city: "Los Angeles",
            address1: "123 Main St",
          },
          selectedDeliveryOption: {
            handle: "standard-shipping",
            title: "Standard Shipping",
            code: "STANDARD",
            deliveryMethodType: "SHIPPING",
          },
        },
      ],
      lines: [
        {
          quantity: 2,
          merchandise: {
            sku: "ABC-1",
            weight: 500,
            weightUnit: "GRAMS",
            product: {
              id: "gid://shopify/Product/1",
              inCollections: [],
            },
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

  it("applies hide when conditions are empty", () => {
    const result = run(baseInput());
    expect(result.operations).toEqual([
      { hide: { paymentMethodId: paymentMethods[0].id } },
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

  it("matches cart currency and logged-in state", () => {
    const input = baseInput();
    input.cart.cost.totalAmount.currencyCode = "EUR";
    input.cart.buyerIdentity.customer = { hasTags: [] };
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: {
        logic: "AND",
        items: [
          { type: "cart_currency", operator: "in", values: ["EUR"] },
          { type: "customer_logged_in", value: "logged_in" },
        ],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(run(input).operations).toHaveLength(1);

    input.cart.buyerIdentity.customer = null;
    expect(run(input).operations).toEqual([]);
  });

  it("matches digital products and vendors", () => {
    const input = baseInput();
    input.cart.lines[0].merchandise.requiresShipping = false;
    input.cart.lines[0].merchandise.product.vendor = "Nike";
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: {
        logic: "AND",
        items: [
          { type: "digital_product", operator: "includes_any" },
          { type: "product_vendor", operator: "includes_any", values: ["Nike"] },
        ],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(run(input).operations).toHaveLength(1);
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

  it("matches always condition", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: {
        logic: "AND",
        items: [{ type: "always" }],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(run(input).operations).toHaveLength(1);
  });

  it("matches OR logic when any condition matches", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: {
        logic: "OR",
        items: [
          { type: "country", operator: "in", values: ["CA"] },
          { type: "cart_total", operator: "gte", value: 1000 },
        ],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(run(input).operations).toEqual([]);

    input.cart.deliveryGroups[0].deliveryAddress.countryCode = "CA";
    expect(run(input).operations).toHaveLength(1);
  });

  it("matches cart quantity condition", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: {
        logic: "AND",
        items: [{ type: "cart_quantity", operator: "gte", value: 3 }],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(run(input).operations).toEqual([]);

    input.cart.lines[0].quantity = 3;
    expect(run(input).operations).toHaveLength(1);
  });

  it("matches sku condition", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: {
        logic: "AND",
        items: [
          {
            type: "sku",
            operator: "includes_any",
            values: ["XYZ"],
          },
        ],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(run(input).operations).toEqual([]);

    input.cart.lines[0].merchandise.sku = "XYZ-9";
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

  it("uses exact match mode when configured", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: { logic: "AND", items: [] },
      actions: {
        matchMode: "exact",
        mode: "hide",
        hide: ["Cash"],
      },
    });
    expect(run(input).operations).toEqual([]);

    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: { logic: "AND", items: [] },
      actions: {
        matchMode: "exact",
        mode: "hide",
        hide: ["Cash on Delivery"],
      },
    });
    expect(run(input).operations).toEqual([
      { hide: { paymentMethodId: paymentMethods[0].id } },
    ]);
  });

  it("hides all payment methods for hide_all mode", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: { logic: "AND", items: [] },
      actions: { mode: "hide_all", hide: [] },
    });
    expect(run(input).operations).toHaveLength(paymentMethods.length);
  });

  it("keeps selected methods for show mode", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: { logic: "AND", items: [] },
      actions: {
        mode: "show",
        matchMode: "exact",
        hide: ["PayPal"],
      },
    });
    expect(run(input).operations).toEqual([
      { hide: { paymentMethodId: paymentMethods[0].id } },
      { hide: { paymentMethodId: paymentMethods[2].id } },
    ]);
  });

  it("emits move operations for sort mode", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: { logic: "AND", items: [] },
      actions: {
        mode: "sort",
        matchMode: "exact",
        order: [
          { name: "PayPal", position: 1 },
          { name: "Cash on Delivery", position: 3 },
        ],
      },
    });
    expect(run(input).operations).toEqual([
      {
        move: {
          paymentMethodId: paymentMethods[1].id,
          index: 0,
        },
      },
      {
        move: {
          paymentMethodId: paymentMethods[0].id,
          index: 2,
        },
      },
    ]);
  });

  it("emits rename operations for rename mode", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: { logic: "AND", items: [] },
      actions: {
        mode: "rename",
        matchMode: "exact",
        renames: [
          {
            name: "PayPal",
            operation: "replace",
            newName: "PayPal Express",
          },
        ],
      },
    });
    expect(run(input).operations).toEqual([
      {
        rename: {
          paymentMethodId: paymentMethods[1].id,
          name: "PayPal Express",
        },
      },
    ]);
  });

  it("skips rename rows without a new name", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: { logic: "AND", items: [] },
      actions: {
        mode: "rename",
        matchMode: "exact",
        renames: [{ name: "PayPal", operation: "replace", newName: "" }],
      },
    });
    expect(run(input).operations).toEqual([]);
  });

  it("skips unmatched sort names", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: { logic: "AND", items: [] },
      actions: {
        mode: "sort",
        matchMode: "exact",
        order: [{ name: "Venmo", position: 1 }],
      },
    });
    expect(run(input).operations).toEqual([]);
  });

  it("matches selected shipping method by title", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: {
        logic: "AND",
        items: [
          {
            type: "shipping_rate",
            operator: "in",
            values: ["Express"],
          },
        ],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(run(input).operations).toEqual([]);

    input.cart.deliveryGroups[0].selectedDeliveryOption.title =
      "Express Shipping";
    expect(run(input).operations).toHaveLength(1);
  });

  it("matches selected shipping method by handle", () => {
    const input = baseInput();
    input.cart.deliveryGroups[0].selectedDeliveryOption.handle = "express-shipping";
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: {
        logic: "AND",
        items: [
          {
            type: "shipping_rate",
            operator: "in",
            values: ["standard-shipping"],
          },
        ],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(run(input).operations).toEqual([]);

    input.cart.deliveryGroups[0].selectedDeliveryOption.handle =
      "standard-shipping";
    expect(run(input).operations).toHaveLength(1);
  });

  it("matches selected shipping method by code", () => {
    const input = baseInput();
    input.cart.deliveryGroups[0].selectedDeliveryOption.code = "OTHER";
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: {
        logic: "AND",
        items: [
          {
            type: "shipping_rate",
            operator: "in",
            values: ["FEDEX_GROUND"],
          },
        ],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(run(input).operations).toEqual([]);

    input.cart.deliveryGroups[0].selectedDeliveryOption.code = "FEDEX_GROUND";
    expect(run(input).operations).toHaveLength(1);
  });

  it("matches delivery method type", () => {
    const input = baseInput();
    input.paymentCustomization.metafield.value = JSON.stringify({
      enabled: true,
      conditions: {
        logic: "AND",
        items: [
          {
            type: "delivery_method",
            operator: "in",
            values: ["PICK_UP"],
          },
        ],
      },
      actions: { hide: ["PayPal"] },
    });
    expect(run(input).operations).toEqual([]);

    input.cart.deliveryGroups[0].selectedDeliveryOption.deliveryMethodType =
      "PICK_UP";
    expect(run(input).operations).toHaveLength(1);
  });
});
