// @ts-check

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @type {FunctionRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {string} methodName
 * @param {string} needle
 */
function nameMatches(methodName, needle) {
  if (!needle) return false;
  return methodName.toLowerCase().includes(String(needle).toLowerCase());
}

/**
 * @param {number} actual
 * @param {string|undefined} operator
 * @param {number} expected
 */
function compareNumber(actual, operator, expected) {
  switch (operator) {
    case "gt":
      return actual > expected;
    case "lt":
      return actual < expected;
    case "lte":
      return actual <= expected;
    case "eq":
      return actual === expected;
    case "gte":
    default:
      return actual >= expected;
  }
}

/**
 * @param {string|undefined} weightUnit
 * @param {number|null|undefined} weight
 */
function toGrams(weight, weightUnit) {
  if (weight == null || Number.isNaN(weight)) return 0;
  switch (weightUnit) {
    case "KILOGRAMS":
      return weight * 1000;
    case "OUNCES":
      return weight * 28.3495;
    case "POUNDS":
      return weight * 453.592;
    case "GRAMS":
    default:
      return weight;
  }
}

/**
 * @param {RunInput} input
 * @param {string} field
 */
function addressFieldValues(input, field) {
  return (input.cart.deliveryGroups || [])
    .map((group) => group.deliveryAddress?.[field])
    .filter((value) => value != null && String(value).trim() !== "")
    .map((value) => String(value));
}

/**
 * @param {string[]} actualValues
 * @param {string|undefined} operator
 * @param {string[]} needles
 * @param {{ normalize?: (value: string) => string, mode?: "exact" | "contains" }} [options]
 */
function matchStringValues(actualValues, operator, needles, options = {}) {
  const normalize = options.normalize || ((value) => value.toLowerCase());
  const mode = options.mode || "exact";
  const values = (needles || []).map((value) => normalize(String(value))).filter(Boolean);
  if (values.length === 0) return true;

  const actuals = actualValues.map((value) => normalize(String(value)));
  const hasMatch = values.some((needle) =>
    actuals.some((actual) =>
      mode === "contains" ? actual.includes(needle) : actual === needle,
    ),
  );

  if (operator === "not_in") return !hasMatch;
  return hasMatch;
}

/**
 * @param {RunInput} input
 */
function cartLines(input) {
  return input.cart.lines || [];
}

/**
 * @param {RunInput['cart']['lines'][number]} line
 */
function variantMerchandise(line) {
  const merchandise = line.merchandise;
  if (!merchandise || !("product" in merchandise)) return null;
  return merchandise;
}

/**
 * @param {RunInput} input
 * @param {object} condition
 */
function evaluateCondition(input, condition) {
  const type = condition?.type;
  const operator = condition?.operator;

  if (type === "always") {
    return true;
  }

  if (type === "country") {
    return matchStringValues(
      addressFieldValues(input, "countryCode"),
      operator,
      (condition.values || []).map((value) => String(value).toUpperCase()),
      { normalize: (value) => value.toUpperCase() },
    );
  }

  if (type === "province") {
    return matchStringValues(
      addressFieldValues(input, "provinceCode"),
      operator,
      condition.values || [],
      { normalize: (value) => value.toUpperCase() },
    );
  }

  if (type === "zip") {
    return matchStringValues(
      addressFieldValues(input, "zip"),
      operator,
      condition.values || [],
      { mode: "contains" },
    );
  }

  if (type === "city") {
    return matchStringValues(
      addressFieldValues(input, "city"),
      operator,
      condition.values || [],
      { mode: "contains" },
    );
  }

  if (type === "address") {
    return matchStringValues(
      addressFieldValues(input, "address1"),
      operator,
      condition.values || [],
      { mode: "contains" },
    );
  }

  if (type === "cart_total") {
    const cartTotal = parseFloat(input.cart.cost.totalAmount.amount);
    const value = parseFloat(condition.value);
    if (Number.isNaN(value)) return false;
    return compareNumber(cartTotal, operator, value);
  }

  if (type === "cart_subtotal") {
    const subtotal = parseFloat(input.cart.cost.subtotalAmount.amount);
    const value = parseFloat(condition.value);
    if (Number.isNaN(value)) return false;
    return compareNumber(subtotal, operator, value);
  }

  if (type === "cart_quantity") {
    const quantity = cartLines(input).reduce(
      (sum, line) => sum + (line.quantity || 0),
      0,
    );
    const value = parseFloat(condition.value);
    if (Number.isNaN(value)) return false;
    return compareNumber(quantity, operator, value);
  }

  if (type === "cart_weight") {
    const totalGrams = cartLines(input).reduce((sum, line) => {
      const merchandise = variantMerchandise(line);
      if (!merchandise) return sum;
      return (
        sum +
        toGrams(merchandise.weight, merchandise.weightUnit) * (line.quantity || 0)
      );
    }, 0);
    const value = parseFloat(condition.value);
    if (Number.isNaN(value)) return false;
    return compareNumber(totalGrams, operator, value);
  }

  if (type === "product") {
    const cartProductIds = cartLines(input)
      .map((line) => variantMerchandise(line)?.product?.id)
      .filter(Boolean);
    const productIds = condition.productIds || [];
    if (productIds.length === 0) return true;

    const matched = productIds.filter((id) => cartProductIds.includes(id));
    if (operator === "includes_all") {
      return productIds.every((id) => cartProductIds.includes(id));
    }
    if (operator === "excludes_all") {
      return matched.length === 0;
    }
    return matched.length > 0;
  }

  if (type === "collection") {
    const collectionIds = condition.collectionIds || [];
    if (collectionIds.length === 0) return true;

    const memberIds = new Set();
    for (const line of cartLines(input)) {
      const memberships = variantMerchandise(line)?.product?.inCollections || [];
      for (const membership of memberships) {
        if (membership.isMember) memberIds.add(membership.collectionId);
      }
    }

    const matched = collectionIds.filter((id) => memberIds.has(id));
    if (operator === "includes_all") {
      return collectionIds.every((id) => memberIds.has(id));
    }
    if (operator === "excludes_all") {
      return matched.length === 0;
    }
    return matched.length > 0;
  }

  if (type === "sku") {
    const skus = cartLines(input)
      .map((line) => variantMerchandise(line)?.sku)
      .filter(Boolean)
      .map((sku) => String(sku));
    const values = condition.values || [];
    if (values.length === 0) return true;

    const matched = values.filter((value) =>
      skus.some((sku) => sku.toLowerCase().includes(String(value).toLowerCase())),
    );
    if (operator === "includes_all") {
      return values.every((value) =>
        skus.some((sku) =>
          sku.toLowerCase().includes(String(value).toLowerCase()),
        ),
      );
    }
    if (operator === "excludes_all") {
      return matched.length === 0;
    }
    return matched.length > 0;
  }

  if (type === "customer_tag") {
    const customer = input.cart.buyerIdentity?.customer;
    if (!customer) return false;

    const values = (condition.values || []).map((value) =>
      String(value).toLowerCase(),
    );
    if (values.length === 0) return true;

    const tagResults = customer.hasTags || [];
    const matched = tagResults.filter(
      (tag) => tag.hasTag && values.includes(String(tag.tag).toLowerCase()),
    );

    if (operator === "includes_all") {
      return values.every((value) =>
        tagResults.some(
          (tag) => tag.hasTag && String(tag.tag).toLowerCase() === value,
        ),
      );
    }
    return matched.length > 0;
  }

  return false;
}

/**
 * @param {RunInput} input
 * @param {object} configuration
 */
function conditionsMatch(input, configuration) {
  const items = configuration?.conditions?.items || [];
  if (items.length === 0) return true;

  const logic = configuration?.conditions?.logic || "AND";
  if (logic === "OR") {
    return items.some((condition) => evaluateCondition(input, condition));
  }
  return items.every((condition) => evaluateCondition(input, condition));
}

/**
 * @param {RunInput['paymentMethods']} paymentMethods
 * @param {string} needle
 */
function findMethod(paymentMethods, needle) {
  return paymentMethods.find((method) => nameMatches(method.name, needle));
}

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  /** @type {{
   *   enabled?: boolean
   *   conditions?: { logic?: string, items?: object[] }
   *   actions?: {
   *     hide?: string[]
   *   }
   * }}
   */
  let configuration = {};
  try {
    configuration = JSON.parse(
      input?.paymentCustomization?.metafield?.value ?? "{}",
    );
  } catch {
    return NO_CHANGES;
  }

  if (configuration.enabled === false) {
    return NO_CHANGES;
  }

  if (!conditionsMatch(input, configuration)) {
    return NO_CHANGES;
  }

  const actions = configuration.actions || {};
  /** @type {FunctionRunResult['operations']} */
  const operations = [];
  const paymentMethods = input.paymentMethods || [];

  for (const hideName of actions.hide || []) {
    const method = findMethod(paymentMethods, hideName);
    if (method) {
      operations.push({
        hide: {
          paymentMethodId: method.id,
        },
      });
    }
  }

  return { operations };
}
