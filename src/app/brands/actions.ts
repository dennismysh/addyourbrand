"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, schema } from "@/lib/db";
import { brandAssetsStore } from "@/lib/blobs";
import { BrandProfileSchema, type BrandProfile } from "@/lib/types";
import {
  extractBrandFromPdf,
  mergeExtractionIntoProfile,
  type ExtractedBrandFields,
} from "@/lib/extract-brand";
import { emptyBrand } from "@/lib/empty-brand";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return session.user.id;
}

export async function listMyBrands() {
  const userId = await requireUserId();
  const db = getDb();
  return db
    .select()
    .from(schema.brands)
    .where(eq(schema.brands.userId, userId))
    .orderBy(desc(schema.brands.updatedAt));
}

export async function getBrand(id: string) {
  const userId = await requireUserId();
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.brands)
    .where(and(eq(schema.brands.id, id), eq(schema.brands.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function saveBrand(input: {
  id?: string;
  profile: BrandProfile;
}) {
  const userId = await requireUserId();
  const db = getDb();
  const parsed = BrandProfileSchema.parse(input.profile);

  if (input.id) {
    await db
      .update(schema.brands)
      .set({ name: parsed.name, profile: parsed, updatedAt: new Date() })
      .where(
        and(eq(schema.brands.id, input.id), eq(schema.brands.userId, userId)),
      );
    revalidatePath("/brands");
    revalidatePath(`/brands/${input.id}`);
    return { id: input.id };
  }

  const [created] = await db
    .insert(schema.brands)
    .values({ userId, name: parsed.name, profile: parsed })
    .returning({ id: schema.brands.id });
  revalidatePath("/brands");
  return { id: created.id };
}

export async function deleteBrand(id: string) {
  const userId = await requireUserId();
  const db = getDb();
  // Cascade deletes asset rows via FK, but the actual blob bytes need an
  // explicit pass before we drop the rows.
  const ownedAssets = await db
    .select({ blobKey: schema.assets.blobKey })
    .from(schema.assets)
    .innerJoin(schema.brands, eq(schema.assets.brandId, schema.brands.id))
    .where(and(eq(schema.brands.id, id), eq(schema.brands.userId, userId)));
  const store = brandAssetsStore();
  await Promise.all(
    ownedAssets.map((a) => store.delete(a.blobKey).catch(() => undefined)),
  );
  await db
    .delete(schema.brands)
    .where(and(eq(schema.brands.id, id), eq(schema.brands.userId, userId)));
  revalidatePath("/brands");
  redirect("/brands");
}

// --- Assets ----------------------------------------------------------------

const ASSET_KINDS = ["logo", "font", "reference", "brand_guide", "other"] as const;
type AssetKind = (typeof ASSET_KINDS)[number];

const MAX_ASSET_BYTES = 10 * 1024 * 1024; // 10 MB — matches next.config bodySizeLimit

function inferKind(filename: string, contentType: string): AssetKind {
  const lower = filename.toLowerCase();
  if (contentType === "application/pdf" || lower.endsWith(".pdf"))
    return "brand_guide";
  if (
    contentType === "font/ttf" ||
    contentType === "font/otf" ||
    contentType === "application/x-font-ttf" ||
    /\.(ttf|otf|woff2?)$/.test(lower)
  )
    return "font";
  if (contentType.startsWith("image/")) {
    if (lower.includes("logo")) return "logo";
    return "reference";
  }
  return "other";
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
}

async function requireBrandOwnership(brandId: string): Promise<string> {
  const userId = await requireUserId();
  const db = getDb();
  const [row] = await db
    .select({ id: schema.brands.id })
    .from(schema.brands)
    .where(and(eq(schema.brands.id, brandId), eq(schema.brands.userId, userId)))
    .limit(1);
  if (!row) throw new Error("Brand not found");
  return userId;
}

export async function listBrandAssets(brandId: string) {
  await requireBrandOwnership(brandId);
  const db = getDb();
  return db
    .select()
    .from(schema.assets)
    .where(eq(schema.assets.brandId, brandId))
    .orderBy(desc(schema.assets.createdAt));
}

export async function uploadAsset(brandId: string, formData: FormData) {
  await requireBrandOwnership(brandId);
  const file = formData.get("file");
  const kindOverride = formData.get("kind");
  if (!(file instanceof File)) {
    throw new Error("No file provided");
  }
  if (file.size === 0) throw new Error("Empty file");
  if (file.size > MAX_ASSET_BYTES) {
    throw new Error(
      `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 10 MB.`,
    );
  }

  const kind: AssetKind =
    typeof kindOverride === "string" &&
    (ASSET_KINDS as readonly string[]).includes(kindOverride)
      ? (kindOverride as AssetKind)
      : inferKind(file.name, file.type);

  const assetId = crypto.randomUUID();
  const safeName = sanitizeFilename(file.name);
  const blobKey = `${brandId}/${assetId}-${safeName}`;

  // Netlify Blobs accepts ArrayBuffer | Blob | ReadableStream | string.
  // Pass the ArrayBuffer directly — no need to wrap in Node's Buffer.
  await brandAssetsStore().set(blobKey, await file.arrayBuffer(), {
    metadata: {
      brandId,
      kind,
      contentType: file.type || "application/octet-stream",
      filename: file.name,
    },
  });

  const db = getDb();
  await db.insert(schema.assets).values({
    id: assetId,
    brandId,
    kind,
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    blobKey,
    sizeBytes: file.size,
  });

  revalidatePath(`/brands/${brandId}`);
  return { id: assetId, kind, filename: file.name };
}

// Create a brand from a brand-guide PDF in one shot:
//   draft brand row → upload PDF as asset → run extraction → merge → save.
// Returns the new brand id so the client can redirect to /brands/[id].
export async function createBrandFromPdf(
  formData: FormData,
): Promise<{ brandId: string; notes?: string }> {
  const userId = await requireUserId();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided");
  if (file.type !== "application/pdf") {
    throw new Error("Must be a PDF (application/pdf).");
  }
  if (file.size === 0) throw new Error("Empty PDF");
  if (file.size > MAX_ASSET_BYTES) {
    throw new Error(
      `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 10 MB.`,
    );
  }

  // Read the bytes once — used for both blob upload and extraction.
  const pdfBytes = await file.arrayBuffer();

  // 1. Draft brand row. Name will get overwritten by the extracted brand
  //    name if the model returns one.
  const draftProfile: BrandProfile = { ...emptyBrand(), name: "Untitled brand" };
  const db = getDb();
  const [created] = await db
    .insert(schema.brands)
    .values({ userId, name: draftProfile.name, profile: draftProfile })
    .returning({ id: schema.brands.id });
  const brandId = created.id;

  // 2. Attach the PDF as an asset.
  const assetId = crypto.randomUUID();
  const safeName = sanitizeFilename(file.name);
  const blobKey = `${brandId}/${assetId}-${safeName}`;
  await brandAssetsStore().set(blobKey, pdfBytes, {
    metadata: {
      brandId,
      kind: "brand_guide",
      contentType: "application/pdf",
      filename: file.name,
    },
  });
  await db.insert(schema.assets).values({
    id: assetId,
    brandId,
    kind: "brand_guide",
    filename: file.name,
    contentType: "application/pdf",
    blobKey,
    sizeBytes: file.size,
  });

  // 3. Run extraction. Failure here is non-fatal — the user still has a
  //    draft brand with the PDF attached; they can re-run extraction from
  //    the brand page or fill fields manually.
  let notes: string | undefined;
  try {
    const extracted = await extractBrandFromPdf(pdfBytes);
    const merged = mergeExtractionIntoProfile(draftProfile, extracted);
    // If the model returned a name, hoist it onto the brand row too.
    if (extracted.name) merged.name = extracted.name;
    const validated = BrandProfileSchema.parse(merged);
    await db
      .update(schema.brands)
      .set({
        name: validated.name,
        profile: validated,
        updatedAt: new Date(),
      })
      .where(eq(schema.brands.id, brandId));
    notes = extracted.notes;
  } catch (err) {
    notes = `Extraction failed: ${err instanceof Error ? err.message : "unknown"}. The PDF is attached — you can retry from the brand page or fill the fields by hand.`;
  }

  revalidatePath("/brands");
  revalidatePath(`/brands/${brandId}`);
  return { brandId, notes };
}

// Run a brand_guide PDF through Claude, get back a partial brand profile,
// merge into the brand row, and revalidate the page so fields show up
// pre-filled. Returns the model's notes so the UI can surface them.
export async function extractBrandFromAsset(
  assetId: string,
): Promise<{ notes?: string; extracted: ExtractedBrandFields }> {
  const userId = await requireUserId();
  const db = getDb();

  const [row] = await db
    .select({
      assetId: schema.assets.id,
      brandId: schema.assets.brandId,
      blobKey: schema.assets.blobKey,
      contentType: schema.assets.contentType,
      kind: schema.assets.kind,
      profile: schema.brands.profile,
    })
    .from(schema.assets)
    .innerJoin(schema.brands, eq(schema.assets.brandId, schema.brands.id))
    .where(
      and(eq(schema.assets.id, assetId), eq(schema.brands.userId, userId)),
    )
    .limit(1);

  if (!row) throw new Error("Asset not found");
  if (row.contentType !== "application/pdf") {
    throw new Error("Asset is not a PDF — only brand-guide PDFs can be extracted from.");
  }

  const pdfBytes = await brandAssetsStore().get(row.blobKey, {
    type: "arrayBuffer",
  });
  if (!pdfBytes) throw new Error("Blob missing");

  const extracted = await extractBrandFromPdf(pdfBytes);
  const merged = mergeExtractionIntoProfile(row.profile, extracted);
  // Validate merged shape before persisting — guards against the model
  // returning malformed values that would corrupt the DB row.
  const validated = BrandProfileSchema.parse(merged);

  await db
    .update(schema.brands)
    .set({ name: validated.name, profile: validated, updatedAt: new Date() })
    .where(eq(schema.brands.id, row.brandId));

  revalidatePath(`/brands/${row.brandId}`);
  return { notes: extracted.notes, extracted };
}

export async function deleteAsset(assetId: string) {
  const userId = await requireUserId();
  const db = getDb();
  // Verify the asset belongs to a brand the user owns. Single round-trip via join.
  const [row] = await db
    .select({
      id: schema.assets.id,
      brandId: schema.assets.brandId,
      blobKey: schema.assets.blobKey,
    })
    .from(schema.assets)
    .innerJoin(schema.brands, eq(schema.assets.brandId, schema.brands.id))
    .where(
      and(eq(schema.assets.id, assetId), eq(schema.brands.userId, userId)),
    )
    .limit(1);
  if (!row) throw new Error("Asset not found");

  await brandAssetsStore()
    .delete(row.blobKey)
    .catch(() => undefined);
  await db.delete(schema.assets).where(eq(schema.assets.id, assetId));
  revalidatePath(`/brands/${row.brandId}`);
}
