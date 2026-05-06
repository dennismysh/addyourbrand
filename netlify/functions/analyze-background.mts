import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getConnectionString } from "@netlify/database";
import * as schema from "../../db/schema";
import { brandAssetsStore } from "../../src/lib/blobs";
import { getJob, updateJob } from "../../src/lib/jobs";
import {
  analyzeTemplate,
  type ReferenceImage,
} from "../../src/lib/analyzer";
import type { BrandProfile, TemplateAnalysis } from "../../src/lib/types";

// Background function — runs up to 15 minutes per Netlify spec. Reads the
// job payload from Blobs, calls the Anthropic SDK with adaptive thinking +
// xhigh effort + structured outputs, and writes the result back to the
// same blob key. Client polls /api/analyze/[jobId] for status.

interface AnalyzePayload {
  brand: BrandProfile;
  brandId?: string;
  imageBase64: string;
  imageMediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
}

const REFERENCE_LIMIT = 3;
const SUPPORTED_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

function getDb() {
  const pool = new Pool({ connectionString: getConnectionString() });
  return drizzle(pool, { schema });
}

async function loadReferences(
  brandId: string,
  userId: string,
): Promise<ReferenceImage[]> {
  const db = getDb();
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
        eq(schema.brands.userId, userId),
        eq(schema.assets.kind, "reference"),
      ),
    )
    .orderBy(desc(schema.assets.createdAt))
    .limit(REFERENCE_LIMIT);

  const store = brandAssetsStore();
  const results: ReferenceImage[] = [];
  for (const row of rows) {
    if (!(SUPPORTED_MIMES as readonly string[]).includes(row.contentType)) {
      continue;
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

export default async (req: Request) => {
  let jobId: string | undefined;
  try {
    const body = (await req.json()) as { jobId?: string };
    jobId = body.jobId;
    if (!jobId) {
      return new Response("Missing jobId", { status: 400 });
    }

    const job = await getJob<AnalyzePayload, TemplateAnalysis>(
      "analyze",
      jobId,
    );
    if (!job) {
      return new Response("Job not found", { status: 404 });
    }

    await updateJob<AnalyzePayload, TemplateAnalysis>("analyze", jobId, {
      status: "running",
    });

    const references = job.payload.brandId
      ? await loadReferences(job.payload.brandId, job.userId)
      : [];

    const analysis = await analyzeTemplate({
      brand: job.payload.brand,
      imageBase64: job.payload.imageBase64,
      imageMediaType: job.payload.imageMediaType,
      references,
    });

    await updateJob<AnalyzePayload, TemplateAnalysis>("analyze", jobId, {
      status: "done",
      result: analysis,
    });

    return new Response("OK", { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (jobId) {
      await updateJob<AnalyzePayload, TemplateAnalysis>(
        "analyze",
        jobId,
        { status: "error", error: message },
      ).catch(() => undefined);
    }
    return new Response(`Error: ${message}`, { status: 500 });
  }
};

export const config = {
  // Netlify reads timeout from `function-name-background.*` filename
  // convention automatically — 15 minutes.
};
