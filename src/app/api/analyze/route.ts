import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { BrandProfileSchema } from "@/lib/types";
import { createJob, triggerBackground } from "@/lib/jobs";

export const runtime = "nodejs";
// This sync route just enqueues a job — the heavy AI work runs in
// netlify/functions/analyze-background.mts (15-minute timeout).
export const maxDuration = 30;

const RequestSchema = z.object({
  brand: BrandProfileSchema,
  imageBase64: z.string().min(1),
  imageMediaType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  brandId: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    const job = await createJob("analyze", session.user.id, parsed.data);
    // Fire-and-forget. The background function picks up the job by id and
    // updates the blob with the result; client polls /api/analyze/[jobId].
    await triggerBackground("analyze", job.id);
    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
