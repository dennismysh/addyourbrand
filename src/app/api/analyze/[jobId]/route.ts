import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getJob } from "@/lib/jobs";
import type { DocumentStructure } from "@/lib/types";

export const runtime = "nodejs";

interface AnalyzePayload {
  imageBase64: string;
  imageMediaType: string;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  const job = await getJob<AnalyzePayload, DocumentStructure>(
    "analyze",
    jobId,
  );
  if (!job || job.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: job.status,
    result: job.result,
    error: job.error,
  });
}
