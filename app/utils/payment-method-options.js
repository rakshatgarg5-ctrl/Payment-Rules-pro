export const PAYMENT_METHOD_PRESETS = [
  "Cash on Delivery",
  "PayPal",
  "Shop Pay",
  "Apple Pay",
  "Google Pay",
  "Bank Deposit",
  "Money Order",
  "Manual Payment",
  "Klarna",
  "Afterpay",
  "Affirm",
  "Gift Card",
];

/**
 * @param {string | null | undefined} rawValue
 */
export function parseRuleConfigValue(rawValue) {
  if (!rawValue) return null;
  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

/**
 * @param {Iterable<string | null | undefined>} configs
 */
export function collectPaymentMethodNamesFromConfigs(configs) {
  const names = new Set(PAYMENT_METHOD_PRESETS);

  for (const config of configs) {
    if (!config) continue;
    for (const name of config?.actions?.hide || []) {
      const trimmed = String(name).trim();
      if (trimmed) names.add(trimmed);
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}
