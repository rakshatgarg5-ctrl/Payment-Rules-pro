import { authenticate } from "../shopify.server.js";
import db from "../db.server.js";

export const action = async ({ request }) => {
  const { payload, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const current = payload?.current;
  if (!Array.isArray(current)) {
    return new Response();
  }

  await db.session.updateMany({
    where: { shop },
    data: { scope: current.join(",") },
  });

  return new Response();
};
