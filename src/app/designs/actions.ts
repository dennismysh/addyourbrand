"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, schema } from "@/lib/db";
import { templatesStore } from "@/lib/blobs";
import {
  DocumentStructureSchema,
  type BrandProfile,
  type DocumentStructure,
} from "@/lib/types";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return session.user.id;
}

const SUPPORTED_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export interface SavedDesign {
  id: string;
  brandId: string;
  brandName: string;
  // Full brand profile so the gallery can render a live preview of the
  // branded result (BrandRenderer needs colors + fonts).
  brandProfile: BrandProfile;
  title: string;
  templateContentType: string;
  doc: DocumentStructure;
  createdAt: Date;
  updatedAt: Date;
}

// Persist a successfully-analyzed design. Stores the source template image to
// Netlify Blobs and inserts a row in `design`. Called automatically from the
// AppClient after a successful analyze pass — designs accumulate per
// (brand, template, analysis) so users can revisit + re-render.
export async function saveDesign(input: {
  brandId: string;
  templateImageBase64: string;
  templateMime: string;
  doc: DocumentStructure;
}): Promise<{ id: string }> {
  const userId = await requireUserId();
  const db = getDb();

  // Verify the brand belongs to this user.
  const [brand] = await db
    .select({ id: schema.brands.id })
    .from(schema.brands)
    .where(
      and(
        eq(schema.brands.id, input.brandId),
        eq(schema.brands.userId, userId),
      ),
    )
    .limit(1);
  if (!brand) throw new Error("Brand not found");

  if (!(SUPPORTED_MIMES as readonly string[]).includes(input.templateMime)) {
    throw new Error(`Unsupported template MIME type: ${input.templateMime}`);
  }
  const validated = DocumentStructureSchema.parse(input.doc);

  const designId = crypto.randomUUID();
  // Key by user so even if the brand is deleted later, blob ownership remains
  // attributable. Cleanup happens on design-row delete.
  const blobKey = `${userId}/${designId}.${input.templateMime.split("/")[1] ?? "bin"}`;
  const buf = Buffer.from(input.templateImageBase64, "base64");

  await templatesStore().set(blobKey, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), {
    metadata: {
      designId,
      brandId: input.brandId,
      contentType: input.templateMime,
    },
  });

  await db.insert(schema.designs).values({
    id: designId,
    brandId: input.brandId,
    title: validated.title,
    templateBlobKey: blobKey,
    templateContentType: input.templateMime,
    doc: validated,
  });

  revalidatePath("/designs");
  revalidatePath(`/brands/${input.brandId}`);
  return { id: designId };
}

// All designs across the user's brands, newest first. Joined with brand for
// display.
export async function listMyDesigns(): Promise<SavedDesign[]> {
  const userId = await requireUserId();
  const db = getDb();
  const rows = await db
    .select({
      id: schema.designs.id,
      brandId: schema.designs.brandId,
      brandName: schema.brands.name,
      brandProfile: schema.brands.profile,
      title: schema.designs.title,
      templateContentType: schema.designs.templateContentType,
      doc: schema.designs.doc,
      createdAt: schema.designs.createdAt,
      updatedAt: schema.designs.updatedAt,
    })
    .from(schema.designs)
    .innerJoin(schema.brands, eq(schema.designs.brandId, schema.brands.id))
    .where(eq(schema.brands.userId, userId))
    .orderBy(desc(schema.designs.createdAt));
  return rows as SavedDesign[];
}

// One specific design plus its brand profile, ready to restore in /app.
export async function getDesign(id: string): Promise<{
  design: SavedDesign;
  // Caller can use this to reload the BrandProfile into the form.
  brand: typeof schema.brands.$inferSelect;
} | null> {
  const userId = await requireUserId();
  const db = getDb();
  const [row] = await db
    .select({
      design: schema.designs,
      brand: schema.brands,
    })
    .from(schema.designs)
    .innerJoin(schema.brands, eq(schema.designs.brandId, schema.brands.id))
    .where(
      and(eq(schema.designs.id, id), eq(schema.brands.userId, userId)),
    )
    .limit(1);
  if (!row) return null;

  return {
    design: {
      id: row.design.id,
      brandId: row.design.brandId,
      brandName: row.brand.name,
      brandProfile: row.brand.profile,
      title: row.design.title,
      templateContentType: row.design.templateContentType,
      doc: row.design.doc as DocumentStructure,
      createdAt: row.design.createdAt,
      updatedAt: row.design.updatedAt,
    },
    brand: row.brand,
  };
}

export async function deleteDesign(id: string) {
  const userId = await requireUserId();
  const db = getDb();
  // Owner check via join; also fetch the blob key so we can clean it up.
  const [row] = await db
    .select({
      id: schema.designs.id,
      brandId: schema.designs.brandId,
      blobKey: schema.designs.templateBlobKey,
    })
    .from(schema.designs)
    .innerJoin(schema.brands, eq(schema.designs.brandId, schema.brands.id))
    .where(and(eq(schema.designs.id, id), eq(schema.brands.userId, userId)))
    .limit(1);
  if (!row) throw new Error("Design not found");

  await templatesStore()
    .delete(row.blobKey)
    .catch(() => undefined);
  await db.delete(schema.designs).where(eq(schema.designs.id, id));
  revalidatePath("/designs");
  revalidatePath(`/brands/${row.brandId}`);
}
