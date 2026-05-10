import { GoogleGenAI } from "@google/genai";

// Gemini client. Netlify AI Gateway auto-injects GEMINI_API_KEY in
// production; locally, set it in .env.local to test.
//
// Defaults to Flash for image generation — see the discussion in
// project memory: Flash is good enough for decorative/ornamental motifs
// and 2.5× cheaper than Pro. Switch on a per-use-case basis if a specific
// caller needs Pro-level quality (logos, hero illustrations).
let _client: GoogleGenAI | null = null;
export function gemini(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Netlify AI Gateway should inject it in production; set it in .env.local for local dev.",
    );
  }
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

// Image-generation model defaults. Distinct constants per use case so we can
// upgrade individual cases to Pro without touching others.
export const MODEL_MOTIF = "gemini-3.1-flash-image-preview";
export const MODEL_LOGO = "gemini-3.1-flash-image-preview";
export const MODEL_HERO_ILLUSTRATION = "gemini-3-pro-image-preview";

// Generate one image from a text prompt. Returns the raw PNG bytes from the
// first inline_data part in the response. Throws if the model returns text
// only or no image data — the model occasionally falls back to refusing /
// describing instead of generating, so callers should wrap in retry/fallback.
export async function generateImage(
  prompt: string,
  options?: { model?: string },
): Promise<Uint8Array> {
  const model = options?.model ?? MODEL_MOTIF;
  const result = await gemini().models.generateContent({
    model,
    // Gemini requires an explicit role on every contents entry — "user" or
    // "model". Omitting it returns INVALID_ARGUMENT.
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseModalities: ["IMAGE"],
    },
  });

  const candidates = result.candidates ?? [];
  for (const candidate of candidates) {
    const parts = candidate.content?.parts ?? [];
    for (const part of parts) {
      const inline = part.inlineData;
      if (inline?.data) {
        // Inline data is base64 PNG bytes. Decode to Uint8Array.
        const buf = Buffer.from(inline.data, "base64");
        return new Uint8Array(buf);
      }
    }
  }
  throw new Error(
    `Gemini ${model} returned no image data. Response candidates: ${candidates.length}`,
  );
}
