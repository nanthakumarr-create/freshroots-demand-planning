import "server-only";
import postgres from "postgres";

declare global {
  var __freshrootsSql: postgres.Sql | undefined;
}

// Supabase transaction pooler: prepared statements must be off.
export const sql =
  globalThis.__freshrootsSql ??
  postgres(process.env.DATABASE_URL!, { ssl: "require", prepare: false, max: 5, idle_timeout: 20 });

if (process.env.NODE_ENV !== "production") globalThis.__freshrootsSql = sql;
