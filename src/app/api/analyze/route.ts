import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, schema } from "@/lib/db";
import { brandAssetsStore } from "@/lib/blobs";
import { analyzeTemplate, type ReferenceImage } from "@/lib/analyzer";
import { BrandProfileSchema } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // analysis can run several minutes at xhigh effort

const REFERENCE_LIMIT = 3;
const SUPPORTED_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

const RequestSchema = z.object({
  brand: BrandProfileSchema,
  imageBase64: z.string().min(1),
  imageMediaType: z.enum(SUPPORTED_MIMES),
  // Optional: when present, server-side fetches up to 3 reference-kind
  // assets for this brand and feeds them to the model alongside the template.
  brandId: z.string().optional(),
});

async function loadReferences(brandId: string): Promise<ReferenceImage[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const db = getDb();
  // Most-recent references first, owned by the signed-in user.
  const rows = await db
    .select({
      blobKey: schema.assets.blobKey,
      contentType: schema.assets.contentType,
    })
    .from(schema.assets)
    .innerJoin(schema.brands, eq(schema.assets.brandId, schema.brands.id))
    .where(
      and(
        eq(schema.assets.brandId, brandId),
        eq(schema.brands.userId, session.user.id),
        eq(schema.assets.kind, "reference"),
      ),
    )
    .orderBy(desc(schema.assets.createdAt))
    .limit(REFERENCE_LIMIT);

  const store = brandAssetsStore();
  const results: ReferenceImage[] = [];
  for (const row of rows) {
    if (!(SUPPORTED_MIMES as readonly string[]).includes(row.contentType)) {
      continue; // skip non-image references (shouldn't happen, but defensive)
    }
    const buf = await store.get(row.blobKey, { type: "arrayBuffer" });
    if (!buf) continue;
    results.push({
      base64: Buffer.from(buf).toString("base64"),
      mediaType: row.contentType as ReferenceImage["mediaType"],
    });
  }
  return results;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const references = parsed.data.brandId
      ? await loadReferences(parsed.data.brandId)
      : [];
    const analysis = await analyzeTemplate({
      brand: parsed.data.brand,
      imageBase64: parsed.data.imageBase64,
      imageMediaType: parsed.data.imageMediaType,
      references,
    });
    return NextResponse.json({
      analysis,
      referencesUsed: references.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
