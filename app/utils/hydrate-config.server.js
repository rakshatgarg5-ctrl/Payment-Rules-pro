import {
  collectPaymentMethodNamesFromConfigs,
  parseRuleConfigValue,
} from "./payment-method-options.js";

const METAFIELD_NAMESPACE = "$app:payment-rules";
const CONFIG_KEY = "function-configuration";

function collectProductIds(config) {
  const ids = [];
  for (const item of config?.conditions?.items || []) {
    if (item.type === "product" && Array.isArray(item.productIds)) {
      for (const id of item.productIds) {
        const trimmed = String(id).trim();
        if (trimmed && !ids.includes(trimmed)) ids.push(trimmed);
      }
    }
  }
  return ids;
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

/**
 * @param {import("@shopify/shopify-app-react-router/server").AdminApiContext["graphql"]} graphql
 * @param {string[]} ids
 */
async function fetchResourceTitles(graphql, ids) {
  if (ids.length === 0) return new Map();

  const response = await graphql(
    `#graphql
      query getResourceTitles($ids: [ID!]!) {
        nodes(ids: $ids) {
          id
          ... on Product {
            title
          }
          ... on Collection {
            title
          }
        }
      }`,
    { variables: { ids } },
  );

  const responseJson = await response.json();
  /** @type {Map<string, string>} */
  const titles = new Map();

  for (const node of responseJson.data?.nodes || []) {
    if (node?.id && node.title) {
      titles.set(node.id, node.title);
    }
  }

  return titles;
}

/**
 * @param {object} item
 * @param {Map<string, string>} titles
 * @param {"product" | "collection"} resourceType
 */
function hydrateResourceCondition(item, titles, resourceType) {
  const isProduct = resourceType === "product";
  const idsKey = isProduct ? "productIds" : "collectionIds";
  const selectionsKey = isProduct ? "productSelections" : "collectionSelections";
  const ids = item[idsKey] || [];
  const existingSelections = item[selectionsKey] || [];
  const existingById = new Map(
    existingSelections.map((selection) => [selection.id, selection.title]),
  );

  const selections = ids.map((id) => ({
    id,
    title: titles.get(id) || existingById.get(id) || id,
  }));

  return {
    ...item,
    [idsKey]: ids,
    [selectionsKey]: selections,
  };
}

/**
 * @param {import("@shopify/shopify-app-react-router/server").AdminApiContext} admin
 * @param {object} config
 */
export async function hydrateConfigSelections(admin, config) {
  const productIds = collectProductIds(config);
  const collectionIds = collectCollectionIds(config);
  const allIds = [...productIds, ...collectionIds];
  const titles = await fetchResourceTitles(admin.graphql, allIds);

  const items = (config?.conditions?.items || []).map((item) => {
    if (item.type === "product") {
      return hydrateResourceCondition(item, titles, "product");
    }
    if (item.type === "collection") {
      return hydrateResourceCondition(item, titles, "collection");
    }
    return item;
  });

  return {
    ...config,
    conditions: {
      ...config.conditions,
      items,
    },
  };
}

/**
 * @param {import("@shopify/shopify-app-react-router/server").AdminApiContext} admin
 */
export async function loadPaymentMethodOptions(admin) {
  const response = await admin.graphql(
    `#graphql
      query getPaymentCustomizationConfigs {
        paymentCustomizations(first: 50) {
          nodes {
            metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${CONFIG_KEY}") {
              value
            }
          }
        }
      }`,
  );

  const responseJson = await response.json();
  const nodes = responseJson.data?.paymentCustomizations?.nodes || [];
  const configs = nodes.map((node) => parseRuleConfigValue(node.metafield?.value));

  return collectPaymentMethodNamesFromConfigs(configs);
}
