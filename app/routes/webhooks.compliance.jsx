import { authenticate } from "../shopify.server.js";
import db from "../db.server.js";

/**
 * Mandatory GDPR/compliance webhooks (App Store requirement).
 * @see https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance
 */
export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Compliance webhook ${topic} for ${shop}`);

  switch (topic) {
    case "SHOP_REDACT":
      await db.session.deleteMany({ where: { shop } });
      break;
    case "CUSTOMERS_REDACT":
    case "CUSTOMERS_DATA_REQUEST":
      // PayHide does not store buyer PII in our database. Payment rules are
      // stored on the shop via Shopify payment customizations / app metafields.
      console.log(
        `Acknowledged ${topic} for ${shop}`,
        payload?.customer?.id ? `(customer ${payload.customer.id})` : "",
      );
      break;
    default:
      console.log(`Unhandled compliance topic ${topic} for ${shop}`);
  }

  return new Response();
};
