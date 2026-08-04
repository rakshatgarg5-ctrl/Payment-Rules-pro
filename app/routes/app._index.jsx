import { useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";

const FUNCTION_HANDLE = "payment-rules";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const customizationsResponse = await admin.graphql(
    `#graphql
      query getPaymentCustomizations {
        paymentCustomizations(first: 50) {
          nodes {
            id
            title
            enabled
          }
        }
      }`,
  );
  const customizationsJson = await customizationsResponse.json();
  const rules = customizationsJson.data?.paymentCustomizations?.nodes || [];

  return {
    functionHandle: FUNCTION_HANDLE,
    rules: rules.map((rule) => ({
      id: rule.id.replace("gid://shopify/PaymentCustomization/", ""),
      gid: rule.id,
      title: rule.title,
      enabled: rule.enabled,
    })),
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const id = String(formData.get("id") || "");
  const gid = `gid://shopify/PaymentCustomization/${id}`;

  if (!id) {
    return { ok: false, errors: [{ message: "Missing rule id." }] };
  }

  if (intent === "toggle") {
    const enabled = formData.get("enabled") === "true";
    const response = await admin.graphql(
      `#graphql
        mutation togglePaymentCustomization($id: ID!, $enabled: Boolean!) {
          paymentCustomizationUpdate(
            id: $id
            paymentCustomization: { enabled: $enabled }
          ) {
            paymentCustomization {
              id
              enabled
            }
            userErrors {
              message
            }
          }
        }`,
      {
        variables: { id: gid, enabled },
      },
    );
    const responseJson = await response.json();
    const errors =
      responseJson.data?.paymentCustomizationUpdate?.userErrors || [];
    if (errors.length > 0) {
      return { ok: false, intent, errors };
    }
    return { ok: true, intent, enabled };
  }

  if (intent === "delete") {
    const response = await admin.graphql(
      `#graphql
        mutation deletePaymentCustomization($id: ID!) {
          paymentCustomizationDelete(id: $id) {
            deletedId
            userErrors {
              message
            }
          }
        }`,
      {
        variables: { id: gid },
      },
    );
    const responseJson = await response.json();
    const errors =
      responseJson.data?.paymentCustomizationDelete?.userErrors || [];
    if (errors.length > 0) {
      return { ok: false, intent, errors };
    }
    return { ok: true, intent };
  }

  return { ok: false, errors: [{ message: "Unknown action." }] };
};

export default function Index() {
  const { functionHandle, rules } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const createPath = `/app/rules/${functionHandle}/new`;
  const isSubmitting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;

    if (fetcher.data.ok) {
      if (fetcher.data.intent === "delete") {
        shopify.toast.show("Rule deleted");
      } else if (fetcher.data.intent === "toggle") {
        shopify.toast.show(
          fetcher.data.enabled ? "Rule activated" : "Rule deactivated",
        );
      }
      return;
    }

    const message =
      fetcher.data.errors?.[0]?.message || "Something went wrong.";
    shopify.toast.show(message, { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);

  const setEnabled = (rule, enabled) => {
    if (rule.enabled === enabled || isSubmitting) return;
    fetcher.submit(
      { intent: "toggle", id: rule.id, enabled: String(enabled) },
      { method: "post" },
    );
  };

  const deleteRule = (rule) => {
    if (isSubmitting) return;
    if (!confirm(`Delete "${rule.title}"? This cannot be undone.`)) return;
    fetcher.submit({ intent: "delete", id: rule.id }, { method: "post" });
  };

  return (
    <s-page heading="Payment rules">
      <s-button slot="primary-action" variant="primary" href={createPath}>
        Create rule
      </s-button>

      <s-section heading="Your rules">
        <s-paragraph>
          Hide checkout payment methods based on country, cart total, products,
          or customer tags. Rules run at checkout via Shopify Functions.
        </s-paragraph>

        {rules.length === 0 ? (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-paragraph>
              No payment rules yet. Create a rule to customize payment methods
              at checkout.
            </s-paragraph>
          </s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Title</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rules.map((rule) => (
                <s-table-row key={rule.id}>
                  <s-table-cell>
                    <s-link href={`/app/rules/${functionHandle}/${rule.id}`}>
                      {rule.title}
                    </s-link>
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small">
                      <s-button
                        variant={rule.enabled ? "primary" : "secondary"}
                        disabled={isSubmitting}
                        onClick={() => setEnabled(rule, true)}
                      >
                        Active
                      </s-button>
                      <s-button
                        variant={!rule.enabled ? "primary" : "secondary"}
                        disabled={isSubmitting}
                        onClick={() => setEnabled(rule, false)}
                      >
                        Inactive
                      </s-button>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="base">
                      <s-link href={`/app/rules/${functionHandle}/${rule.id}`}>
                        Update
                      </s-link>
                      <s-link
                        tone="critical"
                        onClick={() => deleteRule(rule)}
                      >
                        Delete
                      </s-link>
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section slot="aside" heading="Tips">
        <s-unordered-list>
          <s-list-item>
            Match payment methods by name (partial match is supported).
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
