import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getJob } from "@/lib/jobs";
import type { TemplateAnalysis, BrandProfile } from "@/lib/types";

export const runtime = "nodejs";

interface AnalyzePayload {
  brand: BrandProfile;
  brandId?: string;
  imageBase64: string;
  imageMediaType: string;
}

// Polled by the client every couple seconds. Returns the job's current
// status. Owners only — checks userId on the job vs. session.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  const job = await getJob<AnalyzePayload, TemplateAnalysis>("analyze", jobId);
  if (!job || job.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Don't echo the imageBase64 payload back — clients only need status + result.
  return NextResponse.json({
    status: job.status,
    result: job.result,
    error: job.error,
  });
}
