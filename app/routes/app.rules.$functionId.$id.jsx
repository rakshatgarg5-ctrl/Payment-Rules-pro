import { useEffect, useMemo, useState } from "react";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import {
  useActionData,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
  useSubmit,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server.js";
import { CountryConditionFields } from "../components/CountryConditionFields.jsx";
import { PaymentMethodPicker } from "../components/PaymentMethodPicker.jsx";
import { ResourcePickerField } from "../components/ResourcePickerField.jsx";
import { searchFromRequest, withSearch } from "../utils/app-path.js";
import { readEventChecked, readEventValue } from "../utils/events.js";
import {
  hydrateConfigSelections,
  loadPaymentMethodOptions,
} from "../utils/hydrate-config.server.js";
import {
  formatRuleSummary,
  validateRuleConfig,
} from "../utils/rule-config.js";

const METAFIELD_NAMESPACE = "$app:payment-rules";
const CONFIG_KEY = "function-configuration";
const VARIABLES_KEY = "input-variables";

const EMPTY_CONFIG = {
  enabled: true,
  conditions: {
    logic: "AND",
    items: [{ type: "always" }],
  },
  actions: {
    matchMode: "contains",
    mode: "hide",
    hide: [],
  },
};

function defaultCondition(type) {
  switch (type) {
    case "always":
      return { type: "always" };
    case "cart_total":
    case "cart_subtotal":
    case "cart_weight":
    case "cart_quantity":
      return { type, operator: "gte", value: 0 };
    case "country":
      return { type: "country", operator: "in", values: [] };
    case "province":
      return { type: "province", operator: "in", values: [] };
    case "zip":
    case "city":
    case "address":
      return { type, operator: "in", values: [] };
    case "sku":
      return { type: "sku", operator: "includes_any", values: [] };
    case "collection":
      return {
        type: "collection",
        operator: "includes_any",
        collectionIds: [],
        collectionSelections: [],
      };
    case "product":
      return {
        type: "product",
        operator: "includes_any",
        productIds: [],
        productSelections: [],
      };
    case "customer_tag":
      return { type: "customer_tag", operator: "includes_any", values: [] };
    default:
      return { type: "always" };
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

function collectCollectionIds(config) {
  const ids = [];
  for (const item of config?.conditions?.items || []) {
    if (item.type === "collection" && Array.isArray(item.collectionIds)) {
      for (const id of item.collectionIds) {
        const trimmed = String(id).trim();
        if (trimmed && !ids.includes(trimmed)) ids.push(trimmed);
      }
    }
  }
  return ids;
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function TypeOptions() {
  return (
    <>
      <s-option-group label="Cart Details">
        <s-option value="always">Always</s-option>
        <s-option value="cart_total">Total Amount</s-option>
        <s-option value="cart_subtotal">Subtotal Amount</s-option>
        <s-option value="cart_weight">Total Weight</s-option>
        <s-option value="cart_quantity">Total Quantity</s-option>
      </s-option-group>
      <s-option-group label="Address">
        <s-option value="country">Country</s-option>
        <s-option value="province">Province / State Code</s-option>
        <s-option value="zip">Zip / Postal Code</s-option>
        <s-option value="city">City / Area</s-option>
        <s-option value="address">Address line</s-option>
      </s-option-group>
      <s-option-group label="Cart Item">
        <s-option value="sku">SKU</s-option>
        <s-option value="collection">Specific Collection</s-option>
        <s-option value="product">Specific Product</s-option>
      </s-option-group>
      <s-option-group label="Customer">
        <s-option value="customer_tag">Customer Tag</s-option>
      </s-option-group>
    </>
  );
}

function NumericConditionFields({ item, index, updateCondition }) {
  const label =
    item.type === "cart_weight"
      ? "Weight (grams)"
      : item.type === "cart_quantity"
        ? "Quantity"
        : "Amount";

  return (
    <s-grid gap="base" gridTemplateColumns="1fr 1fr">
      <s-select
        label="Operator"
        value={item.operator || "gte"}
        onChange={(e) =>
          updateCondition(index, { operator: readEventValue(e) })
        }
      >
        <s-option value="gte">Greater than or equal</s-option>
        <s-option value="gt">Greater than</s-option>
        <s-option value="lte">Less than or equal</s-option>
        <s-option value="lt">Less than</s-option>
        <s-option value="eq">Equal to</s-option>
      </s-select>
      <s-number-field
        label={label}
        value={String(item.value ?? 0)}
        min="0"
        step={item.type === "cart_quantity" ? "1" : "0.01"}
        onInput={(e) =>
          updateCondition(index, {
            value: parseFloat(readEventValue(e)) || 0,
          })
        }
      />
    </s-grid>
  );
}

function ListConditionFields({
  item,
  index,
  updateCondition,
  label,
  details,
  uppercase = false,
}) {
  return (
    <>
      <s-select
        label="Operator"
        value={item.operator || "in"}
        onChange={(e) =>
          updateCondition(index, { operator: readEventValue(e) })
        }
      >
        <s-option value="in">Is one of</s-option>
        <s-option value="not_in">Is not one of</s-option>
      </s-select>
      <s-text-field
        label={label}
        details={details}
        value={(item.values || []).join(", ")}
        onInput={(e) =>
          updateCondition(index, {
            values: parseCsv(readEventValue(e)).map((value) =>
              uppercase ? value.toUpperCase() : value,
            ),
          })
        }
      />
    </>
  );
}

function MembershipConditionFields({
  item,
  index,
  updateCondition,
  fieldKey,
  label,
  details,
}) {
  return (
    <>
      <s-select
        label="Operator"
        value={item.operator || "includes_any"}
        onChange={(e) =>
          updateCondition(index, { operator: readEventValue(e) })
        }
      >
        <s-option value="includes_any">Cart includes any</s-option>
        <s-option value="includes_all">Cart includes all</s-option>
        <s-option value="excludes_all">Cart includes none</s-option>
      </s-select>
      <s-text-field
        label={label}
        details={details}
        value={(item[fieldKey] || item.values || []).join(", ")}
        onInput={(e) =>
          updateCondition(index, {
            [fieldKey]: parseCsv(readEventValue(e)),
          })
        }
      />
    </>
  );
}

function ResourceConditionFields({
  item,
  index,
  updateCondition,
  resourceType,
  disabled,
}) {
  const isProduct = resourceType === "product";
  const selectionsKey = isProduct ? "productSelections" : "collectionSelections";
  const idsKey = isProduct ? "productIds" : "collectionIds";
  const selections = item[selectionsKey] || [];

  return (
    <>
      <s-select
        label="Operator"
        value={item.operator || "includes_any"}
        onChange={(e) =>
          updateCondition(index, { operator: readEventValue(e) })
        }
      >
        <s-option value="includes_any">Cart includes any</s-option>
        <s-option value="includes_all">Cart includes all</s-option>
        <s-option value="excludes_all">Cart includes none</s-option>
      </s-select>
      <ResourcePickerField
        type={resourceType}
        label={isProduct ? "Products" : "Collections"}
        selections={selections}
        disabled={disabled}
        onChange={(nextSelections) =>
          updateCondition(index, {
            [selectionsKey]: nextSelections,
            [idsKey]: nextSelections.map((selection) => selection.id),
          })
        }
      />
    </>
  );
}

export const loader = async ({ params, request }) => {
  const { id } = params;
  const { admin } = await authenticate.admin(request);
  const paymentMethodOptions = await loadPaymentMethodOptions(admin);

  if (id === "new") {
    return {
      title: "",
      config: EMPTY_CONFIG,
      paymentMethodOptions,
    };
  }
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
      const parsed = JSON.parse(customization.metafield.value);
      config = {
        ...EMPTY_CONFIG,
        ...parsed,
        conditions: {
          ...EMPTY_CONFIG.conditions,
          ...(parsed.conditions || {}),
          items:
            parsed.conditions?.items?.length > 0
              ? parsed.conditions.items
              : EMPTY_CONFIG.conditions.items,
        },
        actions: {
          ...EMPTY_CONFIG.actions,
          ...(parsed.actions || {}),
        },
      };
    } catch {
      config = EMPTY_CONFIG;
    }
  }

  return {
    title: customization?.title || "",
    config: await hydrateConfigSelections(admin, {
      ...config,
      enabled: customization?.enabled ?? config.enabled,
    }),
    paymentMethodOptions,
  };
};

export const action = async ({ params, request }) => {
  const functionHandle = decodeURIComponent(params.functionId || "");
  const { id } = params;
  const { admin } = await authenticate.admin(request);
  const homePath = withSearch("/app", searchFromRequest(request));
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

  const validation = validateRuleConfig(config);
  if (validation.errors.length > 0) {
    return { errors: validation.errors };
  }

  const tagsList = collectTags(config);
  const collectionIds = collectCollectionIds(config);

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
        value: JSON.stringify({
          tags_list: tagsList,
          collection_ids: collectionIds,
        }),
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
        redirectTo: homePath,
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
    return { errors: [], redirectTo: homePath };
  }
  return { errors };
};

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

const SAVE_BAR_ID = "payment-rule-editor-save-bar";

export default function RuleEditor() {
  const submit = useSubmit();
  const actionData = useActionData();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const location = useLocation();
  const loaderData = useLoaderData();
  const shopify = useAppBridge();
  const homeHref = withSearch("/app", location.search);

  const [title, setTitle] = useState(loaderData.title);
  const [enabled, setEnabled] = useState(loaderData.config.enabled !== false);
  const [config, setConfig] = useState(loaderData.config);
  const [clientErrors, setClientErrors] = useState([]);

  const isLoading = navigation.state === "submitting";

  const savedState = useMemo(
    () => ({
      title: loaderData.title,
      enabled: loaderData.config.enabled !== false,
      config: loaderData.config,
    }),
    [loaderData],
  );

  const isDirty = useMemo(
    () =>
      title !== savedState.title ||
      enabled !== savedState.enabled ||
      JSON.stringify(config) !== JSON.stringify(savedState.config),
    [title, enabled, config, savedState],
  );

  const validation = useMemo(() => validateRuleConfig(config), [config]);
  const ruleSummary = useMemo(() => formatRuleSummary(config), [config]);
  const conditionLogic = config.conditions?.logic === "OR" ? "OR" : "AND";

  const saveSucceeded =
    Boolean(actionData?.redirectTo) && (actionData?.errors?.length ?? 0) === 0;

  const saveBarOpen = isDirty && !saveSucceeded;

  useEffect(() => {
    if (!saveSucceeded) return;
    void shopify.saveBar.hide(SAVE_BAR_ID);
    const target = actionData.redirectTo.includes("?")
      ? actionData.redirectTo
      : withSearch(actionData.redirectTo, location.search);
    navigate(target, { replace: true });
  }, [
    actionData?.redirectTo,
    location.search,
    navigate,
    saveSucceeded,
    shopify,
  ]);

  useEffect(() => {
    return () => {
      void shopify.saveBar.hide(SAVE_BAR_ID);
    };
  }, [shopify]);

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

  const addCondition = () => {
    setConfig((prev) => ({
      ...prev,
      conditions: {
        ...prev.conditions,
        items: [...(prev.conditions.items || []), defaultCondition("always")],
      },
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!title.trim()) {
      setClientErrors([{ message: "Rule name is required." }]);
      return;
    }

    const nextValidation = validateRuleConfig(config);
    if (nextValidation.errors.length > 0) {
      setClientErrors(nextValidation.errors);
      return;
    }

    setClientErrors([]);
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
    setTitle(savedState.title);
    setEnabled(savedState.enabled);
    setConfig(savedState.config);
    setClientErrors([]);
  };

  const handleDiscard = (event) => {
    event.preventDefault();
    handleReset();
  };

  const displayErrors = clientErrors.length > 0 ? clientErrors : actionData?.errors || [];
  const errorBanner =
    displayErrors.length > 0 ? (
      <s-banner tone="critical" heading="Could not save rule">
        <ul>
          {displayErrors.map((error, index) => (
            <li key={index}>{error.message}</li>
          ))}
        </ul>
      </s-banner>
    ) : null;

  const warningBanner =
    validation.warnings.length > 0 ? (
      <s-banner tone="warning" heading="Review before saving">
        <ul>
          {validation.warnings.map((warning, index) => (
            <li key={index}>{warning.message}</li>
          ))}
        </ul>
      </s-banner>
    ) : null;

  return (
    <>
      <SaveBar id={SAVE_BAR_ID} open={saveBarOpen} discardConfirmation>
        <button
          variant="primary"
          disabled={isLoading}
          onClick={handleSubmit}
        >
          Save
        </button>
        <button type="button" disabled={isLoading} onClick={handleDiscard}>
          Discard
        </button>
      </SaveBar>

      <form onSubmit={handleSubmit} onReset={handleReset}>
        <s-page heading={title || "New payment rule"}>
        <s-link
          href={homeHref}
          variant="breadcrumb"
          slot="breadcrumb-actions"
          onClick={(event) => {
            event.preventDefault();
            navigate(homeHref);
          }}
        >
          Payment rules
        </s-link>

        {errorBanner}
        {warningBanner}

        <s-section slot="aside" heading="Rule summary">
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-paragraph>{ruleSummary}</s-paragraph>
          </s-box>
        </s-section>

        <s-section heading="Rule details">
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Rule name"
              value={title}
              onInput={(e) => setTitle(readEventValue(e))}
              disabled={isLoading}
              required
              autocomplete="off"
            />
            <s-checkbox
              label="Rule is active"
              checked={enabled}
              onChange={(e) => setEnabled(readEventChecked(e))}
              disabled={isLoading}
            />
          </s-stack>
        </s-section>

        <s-section heading="Conditions">
          <s-stack direction="block" gap="base">
            <s-select
              label="Match when"
              value={conditionLogic}
              disabled={isLoading}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  conditions: {
                    ...prev.conditions,
                    logic: readEventValue(e),
                  },
                }))
              }
            >
              <s-option value="AND">All conditions match (AND)</s-option>
              <s-option value="OR">Any condition matches (OR)</s-option>
            </s-select>
            <s-paragraph>
              {conditionLogic === "OR"
                ? "Actions apply when at least one condition below matches."
                : "Actions apply only when every condition below matches."}{" "}
              Use Always to apply with no extra checks.
            </s-paragraph>
          </s-stack>

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
                      label="Type"
                      value={item.type || "always"}
                      onChange={(e) => {
                        const nextType = readEventValue(e);
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
                      <TypeOptions />
                    </s-select>
                    <s-button
                      tone="critical"
                      variant="tertiary"
                      onClick={() => removeCondition(index)}
                    >
                      Remove
                    </s-button>
                  </s-stack>

                  {item.type === "always" && (
                    <s-paragraph>
                      This condition always matches.
                    </s-paragraph>
                  )}

                  {(item.type === "cart_total" ||
                    item.type === "cart_subtotal" ||
                    item.type === "cart_weight" ||
                    item.type === "cart_quantity") && (
                    <NumericConditionFields
                      item={item}
                      index={index}
                      updateCondition={updateCondition}
                    />
                  )}

                  {item.type === "country" && (
                    <CountryConditionFields
                      item={item}
                      index={index}
                      updateCondition={updateCondition}
                    />
                  )}

                  {item.type === "province" && (
                    <ListConditionFields
                      item={item}
                      index={index}
                      updateCondition={updateCondition}
                      label="Province / state codes (comma-separated)"
                      details="Example: CA, NY, ON"
                      uppercase
                    />
                  )}

                  {item.type === "zip" && (
                    <ListConditionFields
                      item={item}
                      index={index}
                      updateCondition={updateCondition}
                      label="Zip / postal codes (comma-separated)"
                      details="Partial match supported. Example: 10001, M5V"
                    />
                  )}

                  {item.type === "city" && (
                    <ListConditionFields
                      item={item}
                      index={index}
                      updateCondition={updateCondition}
                      label="Cities / areas (comma-separated)"
                      details="Partial match supported. Example: New York, Toronto"
                    />
                  )}

                  {item.type === "address" && (
                    <ListConditionFields
                      item={item}
                      index={index}
                      updateCondition={updateCondition}
                      label="Address line contains (comma-separated)"
                      details="Partial match against address line 1"
                    />
                  )}

                  {item.type === "sku" && (
                    <MembershipConditionFields
                      item={item}
                      index={index}
                      updateCondition={updateCondition}
                      fieldKey="values"
                      label="SKUs (comma-separated)"
                      details="Partial match supported. Example: ABC-1, XYZ"
                    />
                  )}

                  {item.type === "collection" && (
                    <ResourceConditionFields
                      item={item}
                      index={index}
                      updateCondition={updateCondition}
                      resourceType="collection"
                      disabled={isLoading}
                    />
                  )}

                  {item.type === "product" && (
                    <ResourceConditionFields
                      item={item}
                      index={index}
                      updateCondition={updateCondition}
                      resourceType="product"
                      disabled={isLoading}
                    />
                  )}

                  {item.type === "customer_tag" && (
                    <s-text-field
                      label="Customer tags (comma-separated)"
                      details="Guest checkouts will not match this condition."
                      value={(item.values || []).join(", ")}
                      onInput={(e) =>
                        updateCondition(index, {
                          values: parseCsv(readEventValue(e)),
                        })
                      }
                    />
                  )}
                </s-stack>
              </s-box>
            ))}
          </s-stack>

          <s-button onClick={addCondition}>Add condition</s-button>
        </s-section>

        <s-section heading="Actions">
          <PaymentMethodPicker
            selected={config.actions.hide || []}
            options={loaderData.paymentMethodOptions || []}
            disabled={isLoading}
            matchMode={config.actions.matchMode || "contains"}
            actionMode={config.actions.mode || "hide"}
            onMatchModeChange={(matchMode) =>
              setConfig((prev) => ({
                ...prev,
                actions: { ...prev.actions, matchMode },
              }))
            }
            onActionModeChange={(mode) =>
              setConfig((prev) => ({
                ...prev,
                actions: { ...prev.actions, mode },
              }))
            }
            onChange={(hide) =>
              setConfig((prev) => ({
                ...prev,
                actions: { ...prev.actions, hide },
              }))
            }
          />
        </s-section>
        </s-page>
      </form>
    </>
  );
}
