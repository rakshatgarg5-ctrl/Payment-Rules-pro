import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdmin } from "../shopify.server.js";

const SUPPORT_EMAIL = "swiftlogic.support@gmail.com";

export const loader = async ({ request }) => {
  await authenticateAdmin(request);
  return null;
};

export default function SupportPage() {
  return (
    <s-page heading="Support & tutorials">
      <s-section>
        <s-stack direction="block" gap="base">
          <s-heading fontSize="large-400">Need help?</s-heading>
          <s-paragraph>
            Have a question, running into an issue, or finding that a rule
            isn&apos;t working at checkout? Need help setting something up or
            have a feature request? Our support team is here to help.
          </s-paragraph>
          <s-paragraph>
            Please contact us at{" "}
            <s-link href={`mailto:${SUPPORT_EMAIL}`}>
              <s-text tone="info">{SUPPORT_EMAIL}</s-text>
            </s-link>{" "}
            and include your store URL along with a brief description of the
            issue. This helps us investigate and assist you faster.
          </s-paragraph>
          <s-paragraph>
            We&apos;ll get back to you as soon as possible.
          </s-paragraph>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
