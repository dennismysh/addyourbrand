import { getJob, updateJob } from "../../src/lib/jobs";
import { analyzeTemplate } from "../../src/lib/analyzer";
import type { DocumentStructure } from "../../src/lib/types";

// Background function — runs up to 15 minutes per Netlify spec. Reads the
// job payload from Blobs, calls the analyzer (Claude Opus 4.7 with
// adaptive thinking + xhigh effort + structured outputs), and writes the
// DocumentStructure back to the same blob key. Client polls
// /api/analyze/[jobId] for status.

interface AnalyzePayload {
  imageBase64: string;
  imageMediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
}

export default async (req: Request) => {
  let jobId: string | undefined;
  try {
    const body = (await req.json()) as { jobId?: string };
    jobId = body.jobId;
    if (!jobId) {
      return new Response("Missing jobId", { status: 400 });
    }

    const job = await getJob<AnalyzePayload, DocumentStructure>(
      "analyze",
      jobId,
    );
    if (!job) {
      return new Response("Job not found", { status: 404 });
    }

    await updateJob<AnalyzePayload, DocumentStructure>("analyze", jobId, {
      status: "running",
    });

    const doc = await analyzeTemplate({
      imageBase64: job.payload.imageBase64,
      imageMediaType: job.payload.imageMediaType,
    });

    await updateJob<AnalyzePayload, DocumentStructure>("analyze", jobId, {
      status: "done",
      result: doc,
    });

    return new Response("OK", { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (jobId) {
      await updateJob<AnalyzePayload, DocumentStructure>(
        "analyze",
        jobId,
        { status: "error", error: message },
      ).catch(() => undefined);
    }
    return new Response(`Error: ${message}`, { status: 500 });
  }
};
