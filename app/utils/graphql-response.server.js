/**
 * @param {unknown} json
 * @param {(json: Record<string, unknown>) => { message?: string }[] | undefined} [getUserErrors]
 * @returns {{ message: string }[]}
 */
export function getGraphqlErrors(json, getUserErrors) {
  /** @type {{ message: string }[]} */
  const errors = [];

  if (json && typeof json === "object" && Array.isArray(json.errors)) {
    for (const entry of json.errors) {
      const message =
        entry && typeof entry === "object" && typeof entry.message === "string"
          ? entry.message
          : "Shopify API error.";
      errors.push({ message });
    }
  }

  const userErrors = getUserErrors?.(json) || [];
  for (const entry of userErrors) {
    if (entry?.message) {
      errors.push({ message: entry.message });
    }
  }

  return errors;
}

/**
 * @param {Response} response
 */
export async function readGraphqlJson(response) {
  let json;
  try {
    json = await response.json();
  } catch {
    throw new Response("Could not read Shopify API response.", { status: 502 });
  }

  if (!response.ok) {
    const message =
      getGraphqlErrors(json)[0]?.message ||
      `Shopify API request failed (${response.status}).`;
    throw new Response(message, { status: response.status });
  }

  return json;
}

/**
 * @param {Record<string, unknown>} json
 * @param {(json: Record<string, unknown>) => { message?: string }[] | undefined} [getUserErrors]
 */
export function throwIfGraphqlErrors(json, getUserErrors) {
  const errors = getGraphqlErrors(json, getUserErrors);
  if (errors.length > 0) {
    throw new Response(errors[0].message, { status: 422 });
  }
}

/**
 * @param {Response} response
 * @param {(json: Record<string, unknown>) => { message?: string }[] | undefined} [getUserErrors]
 */
export async function parseGraphqlResponse(response, getUserErrors) {
  const json = await readGraphqlJson(response);
  throwIfGraphqlErrors(json, getUserErrors);
  return json;
}

/**
 * @param {{ message: string }[]} errors
 */
export function firstGraphqlErrorMessage(errors) {
  return errors[0]?.message || "Something went wrong.";
}
