import { createHash } from "crypto";
import { motifsStore } from "./blobs";
import { generateImage } from "./gemini";
import { buildMotifPrompt, type MotifKind } from "./motif-prompt";
import type { BrandProfile } from "./types";

// Get the bytes for a motif. Same cache semantics as /api/generate-motif:
// hash the prompt, check the blob store, generate-and-cache on miss.
//
// Reusable from anywhere server-side (the render route in particular needs
// motif bytes inline so they can be base64-embedded into the Satori SVG).
export async function getMotifBytes(
  kind: MotifKind,
  brand: BrandProfile,
  styleHint?: string,
): Promise<Uint8Array> {
  const prompt = buildMotifPrompt({ kind, brand, styleHint });
  const cacheKey = createHash("sha256")
    .update(prompt)
    .digest("hex")
    .slice(0, 32);
  const blobKey = `${kind}/${cacheKey}.png`;
  const store = motifsStore();

  const cached = await store.get(blobKey, { type: "arrayBuffer" });
  if (cached) return new Uint8Array(cached);

  const png = await generateImage(prompt);
  // Re-wrap into a fresh ArrayBuffer to satisfy the BlobInput strict type.
  const ab = new ArrayBuffer(png.byteLength);
  new Uint8Array(ab).set(png);
  await store.set(blobKey, ab, {
    metadata: {
      kind,
      promptPreview: prompt.slice(0, 200),
      brandName: brand.name,
    },
  });
  return png;
}

export type { MotifKind };
