import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "netlify/database/migrations",
  // Match the timestamp prefix Netlify Database uses, so drizzle-kit-generated
  // migrations sort correctly alongside ones created by `netlify database
  // migrations new`. Mixed prefixes ("0001_..." vs "20260506...") cause
  // "out of order" errors on apply.
  migrations: {
    prefix: "timestamp",
  },
  dbCredentials: {
    url: process.env.NETLIFY_DATABASE_URL!,
  },
});
