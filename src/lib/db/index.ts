import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getConnectionString } from "@netlify/database";
import * as schema from "../../../db/schema";

// `@netlify/database` exposes a connection string that works against:
//   - the local embedded Postgres (under `netlify dev`)
//   - the production Netlify Database branch (during a deploy)
// We build a plain `pg.Pool` from it so the Drizzle node-postgres adapter
// has the exact client type Auth.js's DrizzleAdapter expects.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function buildDb(): ReturnType<typeof drizzle<typeof schema>> {
  // During `next build` static generation, no DB env may be set. The Auth.js
  // DrizzleAdapter introspects the drizzle instance at construction time but
  // doesn't query until a request fires, so a stub URL is safe here.
  const connectionString =
    process.env.NEXT_PHASE === "phase-production-build" &&
    !process.env.NETLIFY_DATABASE_URL
      ? "postgresql://stub:stub@localhost:5432/stub"
      : getConnectionString();
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

export function getDb() {
  if (_db) return _db;
  _db = buildDb();
  return _db;
}

export { schema };
