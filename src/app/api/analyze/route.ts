import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { createJob, triggerBackground } from "@/lib/jobs";

export const runtime = "nodejs";
// Sync route — just enqueues. The actual analysis runs in
// netlify/functions/analyze-background.mts (15-min timeout).
export const maxDuration = 30;

// Preservation-mode analyzer just needs the template image — brand is a
// render-time concern, no longer fed into structure extraction.
const RequestSchema = z.object({
  imageBase64: z.string().min(1),
  imageMediaType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
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
    await triggerBackground("analyze", job.id);
    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
