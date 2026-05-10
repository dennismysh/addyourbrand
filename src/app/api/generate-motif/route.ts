import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getMotifBytes } from "@/lib/motif";
import { BrandProfileSchema } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const RequestSchema = z.object({
  kind: z.enum([
    "quote_marks_giant",
    "ornamental_frame",
    "corner_flourish",
    "divider_pattern",
    "background_pattern",
  ]),
  brand: BrandProfileSchema,
  styleHint: z.string().optional(),
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

  const { kind, brand, styleHint } = parsed.data;
  try {
    const png = await getMotifBytes(kind, brand, styleHint);
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Motif generation failed: ${message}` },
      { status: 500 },
    );
  }
}
