import { countryName } from "./countries.js";

const NUMERIC_OPERATOR_LABELS = {
  gte: "is at least",
  gt: "is greater than",
  lte: "is at most",
  lt: "is less than",
  eq: "equals",
};

const LIST_OPERATOR_LABELS = {
  in: "is one of",
  not_in: "is not one of",
};

const MEMBERSHIP_OPERATOR_LABELS = {
  includes_any: "includes any of",
  includes_all: "includes all of",
  excludes_all: "includes none of",
};

const CONDITION_TYPE_LABELS = {
  always: "Always",
  cart_total: "Cart total",
  cart_subtotal: "Cart subtotal",
  cart_weight: "Cart weight",
  cart_quantity: "Cart quantity",
  cart_currency: "Cart currency",
  country: "Country",
  province: "Province / state",
  zip: "Zip / postal code",
  city: "City",
  address: "Address line",
  sku: "SKU",
  collection: "Collection",
  product: "Product",
  product_vendor: "Product vendor",
  digital_product: "Digital product",
  customer_tag: "Customer tag",
  customer_logged_in: "Customer logged-in / guest",
  shipping_rate: "Selected shipping rate",
  delivery_method: "Delivery method",
};

const DELIVERY_METHOD_LABELS = {
  SHIPPING: "Shipping",
  PICK_UP: "Local pickup",
  PICKUP_POINT: "Pickup point",
  LOCAL: "Local delivery",
  RETAIL: "Retail",
  NONE: "None",
};

const GID_PATTERN = /^gid:\/\/shopify\/(Product|Collection)\/\d+$/;

function joinList(values, max = 3) {
  if (!values?.length) return "";
  const shown = values.slice(0, max);
  const suffix =
    values.length > max ? ` (+${values.length - max} more)` : "";
  return `${shown.join(", ")}${suffix}`;
}

/**
 * @param {object} item
 */
export function formatConditionSummary(item) {
  const type = item?.type;
  if (!type) return null;

  if (type === "always") {
    return "Always";
  }

  const label = CONDITION_TYPE_LABELS[type] || type;

  if (
    type === "cart_total" ||
    type === "cart_subtotal" ||
    type === "cart_weight" ||
    type === "cart_quantity"
  ) {
    const operator = NUMERIC_OPERATOR_LABELS[item.operator || "gte"] || "is at least";
    const unit =
      type === "cart_weight" ? " g" : type === "cart_quantity" ? "" : "";
    return `${label} ${operator} ${item.value ?? 0}${unit}`;
  }

  if (type === "country") {
    const operator = LIST_OPERATOR_LABELS[item.operator || "in"] || "is one of";
    const values = joinList(
      (item.values || []).map((code) => countryName(code)),
    );
    if (!values) return `${label} (${operator} — no values)`;
    return `${label} ${operator} ${values}`;
  }

  if (type === "province" || type === "zip" || type === "city" || type === "address") {
    const operator = LIST_OPERATOR_LABELS[item.operator || "in"] || "is one of";
    const values = joinList(item.values || []);
    if (!values) return `${label} (${operator} — no values)`;
    return `${label} ${operator} ${values}`;
  }

  if (type === "shipping_rate") {
    const operator = LIST_OPERATOR_LABELS[item.operator || "in"] || "is one of";
    const values = joinList(item.values || []);
    if (!values) return `${label} (${operator} — no values)`;
    return `${label} ${operator} ${values}`;
  }

  if (type === "delivery_method") {
    const operator = LIST_OPERATOR_LABELS[item.operator || "in"] || "is one of";
    const values = joinList(
      (item.values || []).map(
        (value) => DELIVERY_METHOD_LABELS[value] || value,
      ),
    );
    if (!values) return `${label} (${operator} — no values)`;
    return `${label} ${operator} ${values}`;
  }

  if (type === "sku") {
    const operator =
      MEMBERSHIP_OPERATOR_LABELS[item.operator || "includes_any"] ||
      "includes any of";
    const values = joinList(item.values || []);
    if (!values) return `${label} (${operator} — no values)`;
    return `${label} ${operator} ${values}`;
  }

  if (type === "product") {
    const operator =
      MEMBERSHIP_OPERATOR_LABELS[item.operator || "includes_any"] ||
      "includes any of";
    const values = joinList(
      item.productSelections?.map((selection) => selection.title) ||
        item.productIds ||
        [],
    );
    if (!values) return `${label} (${operator} — no products)`;
    return `${label} ${operator} ${values}`;
  }

  if (type === "collection") {
    const operator =
      MEMBERSHIP_OPERATOR_LABELS[item.operator || "includes_any"] ||
      "includes any of";
    const values = joinList(
      item.collectionSelections?.map((selection) => selection.title) ||
        item.collectionIds ||
        [],
    );
    if (!values) return `${label} (${operator} — no collections)`;
    return `${label} ${operator} ${values}`;
  }

  if (type === "customer_tag") {
    const values = joinList(item.values || []);
    if (!values) return "Customer tag (no tags)";
    return `Customer tag includes ${values}`;
  }

  if (type === "cart_currency") {
    const operator = LIST_OPERATOR_LABELS[item.operator || "in"] || "is one of";
    const values = joinList(item.values || []);
    if (!values) return `${label} (${operator} — no values)`;
    return `${label} ${operator} ${values}`;
  }

  if (type === "product_vendor") {
    const operator =
      MEMBERSHIP_OPERATOR_LABELS[item.operator || "includes_any"] ||
      "includes any of";
    const values = joinList(item.values || []);
    if (!values) return `${label} (${operator} — no values)`;
    return `${label} ${operator} ${values}`;
  }

  if (type === "digital_product") {
    if (item.operator === "includes_all") return "Every item is a digital product";
    if (item.operator === "excludes_all") return "Cart has no digital products";
    return "Cart includes a digital product";
  }

  if (type === "customer_logged_in") {
    return item.value === "guest" ? "Customer is a guest" : "Customer is logged in";
  }

  return label;
}

/**
 * @param {object} config
 */
export function formatRuleSummary(config) {
  const items = config?.conditions?.items || [];
  const logic = config?.conditions?.logic === "OR" ? "OR" : "AND";
  const methods = (config?.actions?.hide || []).filter(Boolean);
  const actionMode = config?.actions?.mode || "hide";
  const matchMode = config?.actions?.matchMode === "exact" ? "exact" : "contains";
  const summaries = items.map(formatConditionSummary).filter(Boolean);

  let whenText;
  if (summaries.length === 0) {
    whenText = "When no conditions are set";
  } else if (summaries.length === 1) {
    whenText = `When ${summaries[0]}`;
  } else {
    const joiner = logic === "OR" ? " OR " : " AND ";
    whenText = `When ${summaries.join(joiner)}`;
  }

  const matchSuffix = matchMode === "exact" ? " (exact)" : "";
  let thenText;
  if (actionMode === "hide_all") {
    thenText = "Hide all payment methods";
  } else if (actionMode === "sort") {
    const order = (config?.actions?.order || [])
      .map((entry) => ({
        name: String(entry?.name || "").trim(),
        position: entry?.position,
      }))
      .filter((entry) => entry.name)
      .sort((a, b) => Number(a.position) - Number(b.position));
    thenText =
      order.length > 0
        ? `Sort ${order
            .map((entry) => `${entry.name} (${entry.position})`)
            .join(", ")}${matchSuffix}`
        : "Sort (no payment methods set)";
  } else if (actionMode === "rename") {
    const renames = (config?.actions?.renames || [])
      .map((entry) => ({
        name: String(entry?.name || "").trim(),
        newName: String(entry?.newName || "").trim(),
      }))
      .filter((entry) => entry.name);
    thenText =
      renames.length > 0
        ? `Rename ${renames
            .map((entry) =>
              entry.newName
                ? `${entry.name} to ${entry.newName}`
                : entry.name,
            )
            .join(", ")}${matchSuffix}`
        : "Rename (no payment methods set)";
  } else if (actionMode === "show") {
    thenText =
      methods.length > 0
        ? `Show only ${methods.join(", ")}${matchSuffix}`
        : "Show only (no payment methods selected)";
  } else {
    thenText =
      methods.length > 0
        ? `Hide ${methods.join(", ")}${matchSuffix}`
        : "Hide (no payment methods selected)";
  }

  return `${whenText} → ${thenText}`;
}

/**
 * @param {object} item
 * @param {number} index
 * @param {string[]} errors
 */
function validateCondition(item, index, errors) {
  const n = index + 1;

  if (!item?.type) {
    errors.push({ message: `Condition ${n}: choose a condition type.` });
    return;
  }

  switch (item.type) {
    case "always":
      return;
    case "cart_total":
    case "cart_subtotal":
    case "cart_weight":
    case "cart_quantity":
      if (item.value == null || Number.isNaN(Number(item.value))) {
        errors.push({ message: `Condition ${n}: enter a valid number.` });
      }
      return;
    case "country":
    case "province":
    case "zip":
    case "city":
    case "address":
    case "shipping_rate":
    case "cart_currency":
      if (!item.values?.length) {
        errors.push({
          message: `Condition ${n}: add at least one ${CONDITION_TYPE_LABELS[item.type].toLowerCase()} value.`,
        });
        return;
      }
      if (item.type === "country") {
        for (const value of item.values) {
          if (!/^[A-Z]{2}$/.test(String(value))) {
            errors.push({
              message: `Condition ${n}: "${value}" is not a valid 2-letter country code (example: US).`,
            });
          }
        }
      }
      if (item.type === "cart_currency") {
        for (const value of item.values) {
          if (!/^[A-Z]{3}$/.test(String(value))) {
            errors.push({
              message: `Condition ${n}: "${value}" is not a valid 3-letter currency code (example: USD).`,
            });
          }
        }
      }
      return;
    case "delivery_method": {
      if (!item.values?.length) {
        errors.push({
          message: `Condition ${n}: select at least one delivery method.`,
        });
        return;
      }
      const allowed = new Set(Object.keys(DELIVERY_METHOD_LABELS));
      for (const value of item.values) {
        if (!allowed.has(String(value))) {
          errors.push({
            message: `Condition ${n}: "${value}" is not a valid delivery method.`,
          });
        }
      }
      return;
    }
    case "sku":
      if (!item.values?.length) {
        errors.push({ message: `Condition ${n}: add at least one SKU.` });
      }
      return;
    case "product_vendor":
      if (!item.values?.length) {
        errors.push({ message: `Condition ${n}: add at least one product vendor.` });
      }
      return;
    case "digital_product":
    case "customer_logged_in":
      return;
    case "product": {
      const productIds =
        item.productIds?.length > 0
          ? item.productIds
          : (item.productSelections || []).map((selection) => selection.id);
      if (!productIds?.length) {
        errors.push({ message: `Condition ${n}: select at least one product.` });
        return;
      }
      for (const id of productIds) {
        if (!GID_PATTERN.test(String(id)) || !String(id).includes("/Product/")) {
          errors.push({
            message: `Condition ${n}: "${id}" is not a valid product.`,
          });
        }
      }
      return;
    }
    case "collection": {
      const collectionIds =
        item.collectionIds?.length > 0
          ? item.collectionIds
          : (item.collectionSelections || []).map((selection) => selection.id);
      if (!collectionIds?.length) {
        errors.push({
          message: `Condition ${n}: select at least one collection.`,
        });
        return;
      }
      for (const id of collectionIds) {
        if (
          !GID_PATTERN.test(String(id)) ||
          !String(id).includes("/Collection/")
        ) {
          errors.push({
            message: `Condition ${n}: "${id}" is not a valid collection.`,
          });
        }
      }
      return;
    }
    case "customer_tag":
      if (!item.values?.length) {
        errors.push({ message: `Condition ${n}: add at least one customer tag.` });
      }
      return;
    default:
      errors.push({ message: `Condition ${n}: unsupported condition type.` });
  }
}

/**
 * @param {object} config
 */
export function validateRuleConfig(config) {
  /** @type {{ message: string }[]} */
  const errors = [];
  /** @type {{ message: string }[]} */
  const warnings = [];

  const actionMode = config?.actions?.mode || "hide";
  const matchMode = config?.actions?.matchMode === "exact" ? "exact" : "contains";
  const methods = (config?.actions?.hide || [])
    .map((name) => String(name).trim())
    .filter(Boolean);
  const orderEntries = (config?.actions?.order || []).map((entry) => ({
    name: String(entry?.name || "").trim(),
    position: entry?.position,
  }));
  const renameEntries = (config?.actions?.renames || []).map((entry) => ({
    name: String(entry?.name || "").trim(),
    newName: String(entry?.newName || "").trim(),
  }));

  if (actionMode === "sort") {
    const named = orderEntries.filter((entry) => entry.name);
    if (named.length === 0) {
      errors.push({
        message: "Add at least one payment method to sort.",
      });
    }

    const nameSeen = new Set();
    const positionSeen = new Set();
    named.forEach((entry, index) => {
      const n = index + 1;
      const position = Number(entry.position);
      if (!Number.isInteger(position) || position < 1) {
        errors.push({
          message: `Sort row ${n}: enter a whole number position of 1 or greater.`,
        });
      } else {
        if (positionSeen.has(position)) {
          warnings.push({
            message: `Position ${position} is used more than once.`,
          });
        }
        positionSeen.add(position);
      }

      const key = entry.name.toLowerCase();
      if (nameSeen.has(key)) {
        warnings.push({
          message: `"${entry.name}" appears more than once in the sort list.`,
        });
      }
      nameSeen.add(key);

      if (matchMode === "contains" && entry.name.length <= 3) {
        warnings.push({
          message: `"${entry.name}" is very short — partial name matching may affect more methods than intended.`,
        });
      }
    });
  } else if (actionMode === "rename") {
    const named = renameEntries.filter((entry) => entry.name);
    if (named.length === 0) {
      errors.push({
        message: "Add at least one payment method to rename.",
      });
    }

    const nameSeen = new Set();
    named.forEach((entry, index) => {
      const n = index + 1;
      if (!entry.newName) {
        errors.push({
          message: `Rename row ${n}: enter a new payment name.`,
        });
      }

      const key = entry.name.toLowerCase();
      if (nameSeen.has(key)) {
        warnings.push({
          message: `"${entry.name}" appears more than once in the rename list.`,
        });
      }
      nameSeen.add(key);

      if (matchMode === "contains" && entry.name.length <= 3) {
        warnings.push({
          message: `"${entry.name}" is very short — partial name matching may affect more methods than intended.`,
        });
      }
    });
  } else if (actionMode !== "hide_all" && methods.length === 0) {
    errors.push({
      message:
        actionMode === "show"
          ? "Add at least one payment method name to show."
          : "Add at least one payment method name to hide.",
    });
  }

  if (actionMode !== "sort" && actionMode !== "rename") {
    const methodSeen = new Set();
    for (const name of methods) {
      const key = name.toLowerCase();
      if (methodSeen.has(key)) {
        warnings.push({
          message: `"${name}" appears more than once in the payment method list.`,
        });
      }
      methodSeen.add(key);

      if (matchMode === "contains" && name.length <= 3) {
        warnings.push({
          message: `"${name}" is very short — partial name matching may affect more methods than intended.`,
        });
      }
    }
  }

  const items = config?.conditions?.items || [];
  if (items.length === 0) {
    warnings.push({
      message:
        "No conditions are set. This rule will apply to every checkout when active.",
    });
  }

  items.forEach((item, index) => validateCondition(item, index, errors));

  const signatures = new Map();
  items.forEach((item, index) => {
    const signature = JSON.stringify(item);
    if (signatures.has(signature)) {
      warnings.push({
        message: `Conditions ${signatures.get(signature) + 1} and ${index + 1} are identical.`,
      });
    } else {
      signatures.set(signature, index);
    }
  });

  const hasActionTargets =
    actionMode === "hide_all" ||
    (actionMode === "sort"
      ? orderEntries.some((entry) => entry.name)
      : actionMode === "rename"
        ? renameEntries.some((entry) => entry.name)
        : methods.length > 0);
  const onlyAlways =
    items.length === 1 && items[0]?.type === "always" && hasActionTargets;
  if (onlyAlways) {
    warnings.push({
      message:
        'The "Always" condition applies this rule on every checkout. Remove it if you only want conditional changes.',
    });
  }

  return { errors, warnings };
}

/**
 * @param {object | null | undefined} config
 * @returns {string[]}
 */
function actionMethodNames(config) {
  const mode = config?.actions?.mode || "hide";
  if (mode === "sort") {
    return (config?.actions?.order || [])
      .map((entry) => String(entry?.name || "").trim())
      .filter(Boolean);
  }
  if (mode === "rename") {
    return (config?.actions?.renames || [])
      .map((entry) => String(entry?.name || "").trim())
      .filter(Boolean);
  }
  return (config?.actions?.hide || [])
    .map((name) => String(name).trim())
    .filter(Boolean);
}

/**
 * @param {{ title: string, enabled?: boolean, config?: object }[]} rules
 */
export function findRuleOverlaps(rules) {
  const activeRules = rules.filter((rule) => rule.enabled);
  /** @type {{ ruleA: string, ruleB: string, methods: string[] }[]} */
  const overlaps = [];

  for (let i = 0; i < activeRules.length; i += 1) {
    for (let j = i + 1; j < activeRules.length; j += 1) {
      const modeA = activeRules[i].config?.actions?.mode || "hide";
      const modeB = activeRules[j].config?.actions?.mode || "hide";
      if (modeA === "hide_all" || modeB === "hide_all") {
        overlaps.push({
          ruleA: activeRules[i].title,
          ruleB: activeRules[j].title,
          methods: ["all payment methods"],
        });
        continue;
      }

      const methodsB = actionMethodNames(activeRules[j].config).map((name) =>
        name.toLowerCase(),
      );
      const shared = actionMethodNames(activeRules[i].config).filter((name) =>
        methodsB.includes(name.toLowerCase()),
      );
      if (shared.length > 0) {
        overlaps.push({
          ruleA: activeRules[i].title,
          ruleB: activeRules[j].title,
          methods: shared,
        });
      }
    }
  }

  return overlaps;
}
