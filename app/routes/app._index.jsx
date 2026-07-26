import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";

const FUNCTION_HANDLE = "payment-rules";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const functionsResponse = await admin.graphql(
    `#graphql
      query getPaymentRulesFunction {
        shopifyFunctions(first: 50) {
          nodes {
            id
            title
            apiType
            app {
              title
            }
          }
        }
      }`,
  );
  const functionsJson = await functionsResponse.json();
  const functions = functionsJson.data?.shopifyFunctions?.nodes || [];
  const paymentFunction =
    functions.find(
      (fn) =>
        String(fn.apiType || "")
          .toLowerCase()
          .includes("payment") &&
        String(fn.title || "")
          .toLowerCase()
          .includes("payment rules"),
    ) ||
    functions.find((fn) =>
      String(fn.apiType || "")
        .toLowerCase()
        .includes("payment"),
    );

  const customizationsResponse = await admin.graphql(
    `#graphql
      query getPaymentCustomizations {
        paymentCustomizations(first: 50) {
          nodes {
            id
            title
            enabled
            functionId
          }
        }
      }`,
  );
  const customizationsJson = await customizationsResponse.json();
  const allCustomizations =
    customizationsJson.data?.paymentCustomizations?.nodes || [];

  const functionId = paymentFunction?.id || null;
  const rules = functionId
    ? allCustomizations.filter((c) => c.functionId === functionId)
    : allCustomizations;

  return {
    functionId,
    functionHandle: FUNCTION_HANDLE,
    rules: rules.map((rule) => ({
      id: rule.id.replace("gid://shopify/PaymentCustomization/", ""),
      gid: rule.id,
      title: rule.title,
      enabled: rule.enabled,
    })),
  };
};

export default function Index() {
  const { functionId, rules } = useLoaderData();
  const navigate = useNavigate();
  const encodedFunctionId = functionId
    ? encodeURIComponent(functionId)
    : null;

  return (
    <s-page heading="Payment rules">
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={!encodedFunctionId}
        onClick={() => {
          if (encodedFunctionId) navigate(`/app/rules/${encodedFunctionId}/new`);
        }}
      >
        Create rule
      </s-button>

      <s-section heading="Your rules">
        <s-paragraph>
          Hide, rename, or sort checkout payment methods based on country, cart
          total, products, or customer tags. Rules run at checkout via Shopify
          Functions.
        </s-paragraph>

        {!functionId && (
          <s-banner tone="warning" heading="Function not found">
            Deploy the app so the Payment Rules function is available, then
            refresh this page.
          </s-banner>
        )}

        {rules.length === 0 ? (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-paragraph>
              No payment rules yet. Create a rule to customize payment methods
              at checkout.
            </s-paragraph>
          </s-box>
        ) : (
          <s-stack direction="block" gap="base">
            {rules.map((rule) => (
              <s-box
                key={rule.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
                borderColor="auto"
              >
                <s-stack direction="inline" gap="base" alignItems="center">
                  <s-stack direction="block" gap="none" style={{ flex: 1 }}>
                    <s-heading>{rule.title}</s-heading>
                    <s-text tone="neutral">
                      {rule.enabled ? "Active" : "Inactive"}
                    </s-text>
                  </s-stack>
                  <s-button
                    variant="secondary"
                    onClick={() =>
                      navigate(
                        `/app/rules/${encodedFunctionId}/${rule.id}`,
                      )
                    }
                  >
                    Edit
                  </s-button>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>

      <s-section slot="aside" heading="Tips">
        <s-unordered-list>
          <s-list-item>
            Match payment methods by name (partial match is supported).
          </s-list-item>
          <s-list-item>
            Wallet methods like Shop Pay and Apple Pay cannot be renamed.
          </s-list-item>
          <s-list-item>
            Customer tag conditions only apply when a customer is logged in.
          </s-list-item>
          <s-list-item>
            You can also manage rules under Settings → Payments →
            Customizations.
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
