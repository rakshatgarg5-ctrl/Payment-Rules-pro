/**
 * Keep Shopify embedded auth query params (shop, host, embedded, id_token)
 * on in-app paths so a full document navigation does not hit /auth/login.
 */
export function withSearch(pathname, search = "") {
  if (!search) return pathname;
  const query = search.startsWith("?") ? search : `?${search}`;
  return `${pathname}${query}`;
}

export function searchFromRequest(request) {
  return new URL(request.url).search;
}
