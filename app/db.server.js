import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "./utils/database-url.server.js";

const databaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL);

/** @type {PrismaClient | undefined} */
let prismaGlobal;

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient(
      databaseUrl
        ? { datasources: { db: { url: databaseUrl } } }
        : undefined,
    );
  }
  prismaGlobal = global.prismaGlobal;
}

const prisma =
  prismaGlobal ??
  new PrismaClient(
    databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined,
  );

export default prisma;
