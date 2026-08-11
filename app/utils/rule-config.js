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
  country: "Country",
  province: "Province / state",
  zip: "Zip / postal code",
  city: "City",
  address: "Address line",
  sku: "SKU",
  collection: "Collection",
  product: "Product",
  customer_tag: "Customer tag",
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

  if (type === "country" || type === "province" || type === "zip" || type === "city" || type === "address") {
    const operator = LIST_OPERATOR_LABELS[item.operator || "in"] || "is one of";
    const values = joinList(item.values || []);
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

  return label;
}

/**
 * @param {object} config
 */
export function formatRuleSummary(config) {
  const items = config?.conditions?.items || [];
  const logic = config?.conditions?.logic === "OR" ? "OR" : "AND";
  const hide = (config?.actions?.hide || []).filter(Boolean);
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

  const thenText =
    hide.length > 0
      ? `Hide ${hide.join(", ")}`
      : "Hide (no payment methods selected)";

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
      return;
    case "sku":
      if (!item.values?.length) {
        errors.push({ message: `Condition ${n}: add at least one SKU.` });
      }
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

  const hide = (config?.actions?.hide || [])
    .map((name) => String(name).trim())
    .filter(Boolean);

  if (hide.length === 0) {
    errors.push({
      message: "Add at least one payment method name to hide.",
    });
  }

  const hideSeen = new Set();
  for (const name of hide) {
    const key = name.toLowerCase();
    if (hideSeen.has(key)) {
      warnings.push({
        message: `"${name}" appears more than once in the hide list.`,
      });
    }
    hideSeen.add(key);

    if (name.length < 3) {
      warnings.push({
        message: `"${name}" is very short — partial name matching may hide more methods than intended.`,
      });
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

  const onlyAlways =
    items.length === 1 && items[0]?.type === "always" && hide.length > 0;
  if (onlyAlways) {
    warnings.push({
      message:
        'The "Always" condition applies this rule on every checkout. Remove it if you only want conditional hiding.',
    });
  }

  return { errors, warnings };
}

/**
 * @param {{ title: string, config?: object }[]} rules
 */
export function findRuleOverlaps(rules) {
  /** @type {{ ruleA: string, ruleB: string, methods: string[] }[]} */
  const overlaps = [];

  for (let i = 0; i < rules.length; i += 1) {
    for (let j = i + 1; j < rules.length; j += 1) {
      const hideB = (rules[j].config?.actions?.hide || []).map((name) =>
        String(name).toLowerCase(),
      );
      const shared = (rules[i].config?.actions?.hide || []).filter((name) =>
        hideB.includes(String(name).toLowerCase()),
      );
      if (shared.length > 0) {
        overlaps.push({
          ruleA: rules[i].title,
          ruleB: rules[j].title,
          methods: shared,
        });
      }
    }
  }

  return overlaps;
}
