import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, schema } from "@/lib/db";
import { templatesStore } from "@/lib/blobs";

export const runtime = "nodejs";

// Streams a saved design's template image bytes back to the browser. Auth-
// gated by ownership of the parent brand.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const db = getDb();
  const [row] = await db
    .select({
      blobKey: schema.designs.templateBlobKey,
      contentType: schema.designs.templateContentType,
    })
    .from(schema.designs)
    .innerJoin(schema.brands, eq(schema.designs.brandId, schema.brands.id))
    .where(
      and(
        eq(schema.designs.id, id),
        eq(schema.brands.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!row) return new NextResponse("Not found", { status: 404 });

  const blob = await templatesStore().get(row.blobKey, { type: "arrayBuffer" });
  if (!blob) return new NextResponse("Blob missing", { status: 404 });

  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": row.contentType || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
