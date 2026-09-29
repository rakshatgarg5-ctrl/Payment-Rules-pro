import { authenticate } from "../shopify.server.js";
import db from "../db.server.js";

/**
 * Mandatory GDPR/compliance webhooks (App Store requirement).
 * @see https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance
 */
export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} compliance webhook for ${shop}`);

  if (topic === "SHOP_REDACT") {
    await db.session.deleteMany({ where: { shop } });
  }

  // customers/data_request — no customer PII stored outside Session; acknowledge only.
  // customers/redact — no per-customer data stored; acknowledge only.

  return new Response();
};
