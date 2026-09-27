import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdmin } from "../shopify.server.js";

const SUPPORT_EMAIL = "swiftlogic.support@gmail.com";

export const loader = async ({ request }) => {
  await authenticateAdmin(request);
  return null;
};

export default function SupportPage() {
  return (
    <s-page heading="Support">
      <s-section heading="Need Help?">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Have a question or running into an issue? Reach out to our support
            team and we&apos;ll get back to you as soon as possible.
          </s-paragraph>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-link href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</s-link>
          </s-box>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
