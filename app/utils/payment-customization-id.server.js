/** Shopify payment customization IDs in app URLs are numeric GID suffixes. */
const NUMERIC_ID_PATTERN = /^\d+$/;

/**
 * @param {string | undefined} id Route param (not "new").
 * @returns {string | null} Normalized numeric id, or null if invalid.
 */
export function parsePaymentCustomizationRouteId(id) {
  const trimmed = String(id || "").trim();
  if (!trimmed || trimmed === "new") return null;
  if (!NUMERIC_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

/**
 * @param {string} numericId
 */
export function paymentCustomizationGid(numericId) {
  return `gid://shopify/PaymentCustomization/${numericId}`;
}

/**
 * @param {string | undefined} message
 */
export function isPaymentCustomizationNotFoundMessage(message) {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("not found") ||
    normalized.includes("does not exist") ||
    normalized.includes("couldn't find") ||
    normalized.includes("could not find") ||
    normalized.includes("no payment customization")
  );
}

const RULE_NOT_FOUND_SAVE_MESSAGE =
  "This rule was deleted or no longer exists. Go back to the dashboard and open the rule from the list.";

/**
 * @param {{ message: string }[]} errors
 * @returns {{ errors: { message: string }[]; ruleNotFound: boolean }}
 */
export function normalizeRuleSaveErrors(errors) {
  if (errors.some((entry) => isPaymentCustomizationNotFoundMessage(entry.message))) {
    return {
      errors: [{ message: RULE_NOT_FOUND_SAVE_MESSAGE }],
      ruleNotFound: true,
    };
  }
  return { errors, ruleNotFound: false };
}

export { RULE_NOT_FOUND_SAVE_MESSAGE };
