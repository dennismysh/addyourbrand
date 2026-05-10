import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { auth } from "@/auth";
import { motifsStore } from "@/lib/blobs";
import { generateImage } from "@/lib/gemini";
import { buildMotifPrompt } from "@/lib/motif-prompt";
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
  // Optional fine-tuning instruction, lets the analyzer pass extra context
  // without us mutating the catalogue.
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
  const prompt = buildMotifPrompt({ kind, brand, styleHint });

  // Cache key: hash of the prompt itself. Identical prompt → identical cached
  // image. Brand colors + style hint are baked into the prompt, so a brand
  // tweak naturally invalidates the cache.
  const cacheKey = createHash("sha256").update(prompt).digest("hex").slice(0, 32);
  const blobKey = `${kind}/${cacheKey}.png`;
  const store = motifsStore();

  const cached = await store.get(blobKey, { type: "arrayBuffer" });
  if (cached) {
    return new Response(cached, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        "X-Motif-Cache": "hit",
      },
    });
  }

  try {
    const png = await generateImage(prompt);
    // Slice into a fresh ArrayBuffer (excluding any SharedArrayBuffer-typed
    // backing buffer) so the Netlify Blobs setter type-checks cleanly.
    const ab = new ArrayBuffer(png.byteLength);
    new Uint8Array(ab).set(png);
    await store.set(blobKey, ab, {
      metadata: {
        kind,
        promptPreview: prompt.slice(0, 200),
        brandName: brand.name,
      },
    });
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        "X-Motif-Cache": "miss",
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
