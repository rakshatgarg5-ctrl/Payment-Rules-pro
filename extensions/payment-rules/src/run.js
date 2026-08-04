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
 * @param {RunInput} input
 * @param {object} condition
 */
function evaluateCondition(input, condition) {
  const type = condition?.type;
  const operator = condition?.operator;

  if (type === "country") {
    const countries = (input.cart.deliveryGroups || [])
      .map((g) => g.deliveryAddress?.countryCode)
      .filter(Boolean);
    const values = (condition.values || []).map((v) => String(v).toUpperCase());
    if (values.length === 0) return true;
    const hasMatch = countries.some((c) => values.includes(String(c).toUpperCase()));
    if (operator === "not_in") return !hasMatch;
    return hasMatch; // in
  }

  if (type === "cart_total") {
    const cartTotal = parseFloat(input.cart.cost.totalAmount.amount);
    const value = parseFloat(condition.value);
    if (Number.isNaN(value)) return false;
    switch (operator) {
      case "gt":
        return cartTotal > value;
      case "lt":
        return cartTotal < value;
      case "lte":
        return cartTotal <= value;
      case "eq":
        return cartTotal === value;
      case "gte":
      default:
        return cartTotal >= value;
    }
  }

  if (type === "product") {
    const cartProductIds = (input.cart.lines || [])
      .map((line) =>
        line.merchandise && "product" in line.merchandise
          ? line.merchandise.product?.id
          : null,
      )
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
    return matched.length > 0; // includes_any
  }

  if (type === "customer_tag") {
    const customer = input.cart.buyerIdentity?.customer;
    // Guests: fail closed when a customer_tag condition is present
    if (!customer) return false;

    const values = (condition.values || []).map((v) => String(v).toLowerCase());
    if (values.length === 0) return true;

    const tagResults = customer.hasTags || [];
    const matched = tagResults.filter(
      (t) => t.hasTag && values.includes(String(t.tag).toLowerCase()),
    );

    if (operator === "includes_all") {
      return values.every((v) =>
        tagResults.some(
          (t) => t.hasTag && String(t.tag).toLowerCase() === v,
        ),
      );
    }
    return matched.length > 0; // includes_any
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
    return items.some((c) => evaluateCondition(input, c));
  }
  return items.every((c) => evaluateCondition(input, c));
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

  // Hide
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
