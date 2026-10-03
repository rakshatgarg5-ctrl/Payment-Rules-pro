/**
 * Supabase transaction pooler (port 6543) requires pgbouncer=true for Prisma.
 * @see https://www.prisma.io/docs/guides/performance-and-optimization/connection-management/configure-pg-bouncer
 * @param {string | undefined} databaseUrl
 */
export function resolveDatabaseUrl(databaseUrl) {
  const url = String(databaseUrl || "").trim();
  if (!url) return url;

  if (url.includes("pgbouncer=true")) return url;

  const isPooler =
    url.includes("pooler.supabase.com") ||
    url.includes(":6543/") ||
    url.includes(":6543?");

  if (!isPooler) return url;

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}pgbouncer=true`;
}
