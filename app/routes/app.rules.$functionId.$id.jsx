import { useEffect, useMemo, useState } from "react";
import {
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSubmit,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";

const METAFIELD_NAMESPACE = "$app:payment-rules";
const CONFIG_KEY = "function-configuration";
const VARIABLES_KEY = "input-variables";

const EMPTY_CONFIG = {
  enabled: true,
  conditions: { logic: "AND", items: [] },
  actions: {
    hide: [],
  },
};

function defaultCondition(type) {
  switch (type) {
    case "country":
      return { type: "country", operator: "in", values: [] };
    case "cart_total":
      return { type: "cart_total", operator: "gte", value: 0 };
    case "product":
      return { type: "product", operator: "includes_any", productIds: [] };
    case "customer_tag":
      return { type: "customer_tag", operator: "includes_any", values: [] };
    default:
      return { type: "cart_total", operator: "gte", value: 0 };
  }
}

function collectTags(config) {
  const tags = [];
  for (const item of config?.conditions?.items || []) {
    if (item.type === "customer_tag" && Array.isArray(item.values)) {
      for (const tag of item.values) {
        const trimmed = String(tag).trim();
        if (trimmed && !tags.includes(trimmed)) tags.push(trimmed);
      }
    }
  }
  return tags;
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const loader = async ({ params, request }) => {
  const { id } = params;

  if (id === "new") {
    return {
      title: "",
      config: EMPTY_CONFIG,
    };
  }

  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(
    `#graphql
      query getPaymentCustomization($id: ID!) {
        paymentCustomization(id: $id) {
          id
          title
          enabled
          metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${CONFIG_KEY}") {
            value
          }
        }
      }`,
    {
      variables: {
        id: `gid://shopify/PaymentCustomization/${id}`,
      },
    },
  );

  const responseJson = await response.json();
  const customization = responseJson.data?.paymentCustomization;
  let config = EMPTY_CONFIG;
  if (customization?.metafield?.value) {
    try {
      config = {
        ...EMPTY_CONFIG,
        ...JSON.parse(customization.metafield.value),
        conditions: {
          ...EMPTY_CONFIG.conditions,
          ...(JSON.parse(customization.metafield.value).conditions || {}),
        },
        actions: {
          ...EMPTY_CONFIG.actions,
          ...(JSON.parse(customization.metafield.value).actions || {}),
        },
      };
    } catch {
      config = EMPTY_CONFIG;
    }
  }

  return {
    title: customization?.title || "",
    config: {
      ...config,
      enabled: customization?.enabled ?? config.enabled,
    },
  };
};

export const action = async ({ params, request }) => {
  const functionHandle = decodeURIComponent(params.functionId || "");
  const { id } = params;
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const title = String(formData.get("title") || "").trim();
  const enabled = formData.get("enabled") === "true";

  let config;
  try {
    config = JSON.parse(String(formData.get("config") || "{}"));
  } catch {
    return { errors: [{ message: "Invalid rule configuration." }] };
  }

  config.enabled = enabled;

  if (!title) {
    return { errors: [{ message: "Rule name is required." }] };
  }

  const tagsList = collectTags(config);

  const paymentCustomizationInput = {
    functionHandle,
    title,
    enabled,
    metafields: [
      {
        namespace: METAFIELD_NAMESPACE,
        key: CONFIG_KEY,
        type: "json",
        value: JSON.stringify(config),
      },
      {
        namespace: METAFIELD_NAMESPACE,
        key: VARIABLES_KEY,
        type: "json",
        value: JSON.stringify({ tags_list: tagsList }),
      },
    ],
  };

  if (id === "new") {
    const response = await admin.graphql(
      `#graphql
        mutation createPaymentCustomization($input: PaymentCustomizationInput!) {
          paymentCustomizationCreate(paymentCustomization: $input) {
            paymentCustomization {
              id
            }
            userErrors {
              message
            }
          }
        }`,
      {
        variables: { input: paymentCustomizationInput },
      },
    );

    const responseJson = await response.json();
    const errors =
      responseJson.data?.paymentCustomizationCreate?.userErrors || [];

    if (errors.length === 0) {
      return {
        errors: [],
        redirectTo: "/app",
      };
    }
    return { errors };
  }

  const response = await admin.graphql(
    `#graphql
      mutation updatePaymentCustomization($id: ID!, $input: PaymentCustomizationInput!) {
        paymentCustomizationUpdate(id: $id, paymentCustomization: $input) {
          paymentCustomization {
            id
          }
          userErrors {
            message
          }
        }
      }`,
    {
      variables: {
        id: `gid://shopify/PaymentCustomization/${id}`,
        input: paymentCustomizationInput,
      },
    },
  );

  const responseJson = await response.json();
  const errors =
    responseJson.data?.paymentCustomizationUpdate?.userErrors || [];

  if (errors.length === 0) {
    return { errors: [], redirectTo: "/app" };
  }
  return { errors };
};

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default function RuleEditor() {
  const submit = useSubmit();
  const actionData = useActionData();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const loaderData = useLoaderData();

  const [title, setTitle] = useState(loaderData.title);
  const [enabled, setEnabled] = useState(loaderData.config.enabled !== false);
  const [config, setConfig] = useState(loaderData.config);

  const isLoading = navigation.state === "submitting";

  useEffect(() => {
    if (actionData?.redirectTo && actionData?.errors?.length === 0) {
      navigate(actionData.redirectTo);
    }
  }, [actionData, navigate]);

  const hideText = useMemo(
    () => (config.actions.hide || []).join(", "),
    [config.actions.hide],
  );

  const updateCondition = (index, patch) => {
    setConfig((prev) => {
      const items = [...(prev.conditions.items || [])];
      items[index] = { ...items[index], ...patch };
      return {
        ...prev,
        conditions: { ...prev.conditions, items },
      };
    });
  };

  const removeCondition = (index) => {
    setConfig((prev) => ({
      ...prev,
      conditions: {
        ...prev.conditions,
        items: (prev.conditions.items || []).filter((_, i) => i !== index),
      },
    }));
  };

  const addCondition = (type) => {
    setConfig((prev) => ({
      ...prev,
      conditions: {
        ...prev.conditions,
        items: [...(prev.conditions.items || []), defaultCondition(type)],
      },
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    submit(
      {
        title,
        enabled: String(enabled),
        config: JSON.stringify(config),
      },
      { method: "post" },
    );
  };

  const handleReset = () => {
    setTitle(loaderData.title);
    setEnabled(loaderData.config.enabled !== false);
    setConfig(loaderData.config);
  };

  const errorBanner =
    actionData?.errors?.length > 0 ? (
      <s-banner tone="critical" heading="Could not save rule">
        <ul>
          {actionData.errors.map((error, index) => (
            <li key={index}>{error.message}</li>
          ))}
        </ul>
      </s-banner>
    ) : null;

  return (
    <form data-save-bar onSubmit={handleSubmit} onReset={handleReset}>
      <s-page heading={title || "New payment rule"}>
        <s-link href="/app" variant="breadcrumb" slot="breadcrumb-actions">
          Payment rules
        </s-link>

        {errorBanner}

        <s-section heading="Rule details">
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Rule name"
              value={title}
              onInput={(e) => setTitle(e.currentTarget.value)}
              disabled={isLoading}
              required
              autocomplete="off"
            />
            <s-checkbox
              label="Rule is active"
              checked={enabled}
              onChange={(e) => setEnabled(e.currentTarget.checked)}
              disabled={isLoading}
            />
          </s-stack>
        </s-section>

        <s-section heading="Conditions (AND)">
          <s-paragraph>
            All conditions must match for actions to apply. Leave empty to
            always apply.
          </s-paragraph>

          <s-stack direction="block" gap="base">
            {(config.conditions.items || []).map((item, index) => (
              <s-box
                key={index}
                padding="base"
                borderWidth="base"
                borderRadius="base"
                borderColor="auto"
              >
                <s-stack direction="block" gap="base">
                  <s-stack direction="inline" gap="base" alignItems="end">
                    <s-select
                      label="Condition type"
                      value={item.type}
                      onChange={(e) => {
                        const nextType = e.currentTarget.value;
                        setConfig((prev) => {
                          const items = [...prev.conditions.items];
                          items[index] = defaultCondition(nextType);
                          return {
                            ...prev,
                            conditions: { ...prev.conditions, items },
                          };
                        });
                      }}
                    >
                      <s-option value="country">Country</s-option>
                      <s-option value="cart_total">Cart total</s-option>
                      <s-option value="product">Products</s-option>
                      <s-option value="customer_tag">Customer tags</s-option>
                    </s-select>
                    <s-button
                      tone="critical"
                      variant="tertiary"
                      onClick={() => removeCondition(index)}
                    >
                      Remove
                    </s-button>
                  </s-stack>

                  {item.type === "country" && (
                    <>
                      <s-select
                        label="Operator"
                        value={item.operator || "in"}
                        onChange={(e) =>
                          updateCondition(index, {
                            operator: e.currentTarget.value,
                          })
                        }
                      >
                        <s-option value="in">Is one of</s-option>
                        <s-option value="not_in">Is not one of</s-option>
                      </s-select>
                      <s-text-field
                        label="Country codes (comma-separated)"
                        details="Example: US, CA, GB"
                        value={(item.values || []).join(", ")}
                        onInput={(e) =>
                          updateCondition(index, {
                            values: parseCsv(e.currentTarget.value).map((c) =>
                              c.toUpperCase(),
                            ),
                          })
                        }
                      />
                    </>
                  )}

                  {item.type === "cart_total" && (
                    <s-grid gap="base" gridTemplateColumns="1fr 1fr">
                      <s-select
                        label="Operator"
                        value={item.operator || "gte"}
                        onChange={(e) =>
                          updateCondition(index, {
                            operator: e.currentTarget.value,
                          })
                        }
                      >
                        <s-option value="gte">Greater than or equal</s-option>
                        <s-option value="gt">Greater than</s-option>
                        <s-option value="lte">Less than or equal</s-option>
                        <s-option value="lt">Less than</s-option>
                        <s-option value="eq">Equal to</s-option>
                      </s-select>
                      <s-number-field
                        label="Amount"
                        value={String(item.value ?? 0)}
                        min="0"
                        step="0.01"
                        onInput={(e) =>
                          updateCondition(index, {
                            value: parseFloat(e.currentTarget.value) || 0,
                          })
                        }
                      />
                    </s-grid>
                  )}

                  {item.type === "product" && (
                    <>
                      <s-select
                        label="Operator"
                        value={item.operator || "includes_any"}
                        onChange={(e) =>
                          updateCondition(index, {
                            operator: e.currentTarget.value,
                          })
                        }
                      >
                        <s-option value="includes_any">
                          Cart includes any
                        </s-option>
                        <s-option value="includes_all">
                          Cart includes all
                        </s-option>
                        <s-option value="excludes_all">
                          Cart includes none
                        </s-option>
                      </s-select>
                      <s-text-field
                        label="Product GIDs (comma-separated)"
                        details="Example: gid://shopify/Product/123"
                        value={(item.productIds || []).join(", ")}
                        onInput={(e) =>
                          updateCondition(index, {
                            productIds: parseCsv(e.currentTarget.value),
                          })
                        }
                      />
                    </>
                  )}

                  {item.type === "customer_tag" && (
                    <s-text-field
                      label="Customer tags (comma-separated)"
                      details="Guest checkouts will not match this condition."
                      value={(item.values || []).join(", ")}
                      onInput={(e) =>
                        updateCondition(index, {
                          values: parseCsv(e.currentTarget.value),
                        })
                      }
                    />
                  )}
                </s-stack>
              </s-box>
            ))}
          </s-stack>

          <s-stack direction="inline" gap="base">
            <s-button onClick={() => addCondition("country")}>
              Add country
            </s-button>
            <s-button onClick={() => addCondition("cart_total")}>
              Add cart total
            </s-button>
            <s-button onClick={() => addCondition("product")}>
              Add products
            </s-button>
            <s-button onClick={() => addCondition("customer_tag")}>
              Add customer tags
            </s-button>
          </s-stack>
        </s-section>

        <s-section heading="Actions">
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Hide payment methods"
              details="Comma-separated names (partial match). Example: Cash on Delivery, Money Order"
              value={hideText}
              onInput={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  actions: {
                    ...prev.actions,
                    hide: parseCsv(e.currentTarget.value),
                  },
                }))
              }
            />
          </s-stack>
        </s-section>
      </s-page>
    </form>
  );
}
