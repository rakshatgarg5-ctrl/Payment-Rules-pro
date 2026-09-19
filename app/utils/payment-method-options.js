export const PAYMENT_METHOD_PRESETS = [
  "Affirm - Pay Over Time",
  "Afterpay",
  "Amazon Pay (express)",
  "Apple Pay (express)",
  "Authorize.net",
  "Bancontact",
  "Bank Deposit",
  "Betalingskort",
  "Billwerk+ Payments",
  "Cash on Delivery (COD)",
  "Deferred",
  "Gift card",
  "Google Pay (express)",
  "iDEAL",
  "Klarna",
  "Klarna pay later",
  "Klarna pay now",
  "Mercado Pago",
  "Money Order",
  "Net Terms",
  "PayPal",
  "PayU Latam",
  "Razorpay",
  "Redeemable payment method - Store credit",
  "Satispay",
  "Shop Pay (express)",
  "Shop Pay Installments",
  "Shopify Payments (Credit card)",
  "Sofort",
  "Stripe (Credit card)",
  "Venmo (express)",
  "Vipps",
  "(for testing) Bogus Gateway",
];

/**
 * Alphabetical order, with Bogus Gateway forced last for testing.
 * @param {string} a
 * @param {string} b
 */
export function comparePaymentMethodNames(a, b) {
  const aLast = isBogusGateway(a);
  const bLast = isBogusGateway(b);
  if (aLast !== bLast) return aLast ? 1 : -1;
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

/**
 * @param {string} name
 */
function isBogusGateway(name) {
  return /bogus\s*gateway/i.test(String(name));
}

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

  return [...names].sort(comparePaymentMethodNames);
}
