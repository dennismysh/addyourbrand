import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, schema } from "@/lib/db";
import { brandAssetsStore } from "@/lib/blobs";

export const runtime = "nodejs";

// Streams an asset's bytes back to the browser. Auth-gated by brand ownership.
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
      blobKey: schema.assets.blobKey,
      contentType: schema.assets.contentType,
      filename: schema.assets.filename,
    })
    .from(schema.assets)
    .innerJoin(schema.brands, eq(schema.assets.brandId, schema.brands.id))
    .where(
      and(
        eq(schema.assets.id, id),
        eq(schema.brands.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!row) return new NextResponse("Not found", { status: 404 });

  const blob = await brandAssetsStore().get(row.blobKey, { type: "arrayBuffer" });
  if (!blob) return new NextResponse("Blob missing", { status: 404 });

  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": row.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(row.filename)}"`,
      // Cache per-user for an hour. Auth.js cookies make this safe to cache.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
