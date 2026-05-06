import {
  pgTable,
  text,
  timestamp,
  jsonb,
  primaryKey,
  integer,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";
import type { BrandProfile } from "../src/lib/types";

// --- Auth.js tables (Drizzle adapter shape) ---------------------------------

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// --- Domain tables ----------------------------------------------------------

export const brands = pgTable("brand", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Full BrandProfile JSON. Single column keeps the schema flexible during MVP.
  profile: jsonb("profile").$type<BrandProfile>().notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
});

export const assets = pgTable("asset", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  brandId: text("brandId")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  // logo | font | reference | brand_guide | other
  kind: text("kind").notNull(),
  filename: text("filename").notNull(),
  contentType: text("contentType").notNull(),
  // Netlify Blobs key — fetch via getStore("brand-assets").get(blobKey)
  blobKey: text("blobKey").notNull(),
  sizeBytes: integer("sizeBytes").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const designs = pgTable("design", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  brandId: text("brandId")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  // The original template the user uploaded (Blob key).
  templateBlobKey: text("templateBlobKey").notNull(),
  // The analysis JSON Claude returned.
  analysis: jsonb("analysis").notNull(),
  // The rendered output PNG (Blob key), set once render completes.
  outputBlobKey: text("outputBlobKey"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});
