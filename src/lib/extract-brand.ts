import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "./anthropic";
import type { BrandProfile } from "./types";

// What Claude returns. Everything optional — the model fills only what it
// can confidently extract from the brand guide. Empty fields are passed
// through and left alone on the merge.
export interface ExtractedBrandFields {
  name?: string;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    foreground?: string;
  };
  fonts?: {
    heading?: string;
    body?: string;
  };
  voiceSamples?: string[];
  formulas?: string[];
  brandFacts?: string;
  // Free-form note the model uses to flag what was missing or ambiguous.
  notes?: string;
}

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    colors: {
      type: "object",
      properties: {
        primary: { type: "string", description: "Hex like #RRGGBB" },
        secondary: { type: "string" },
        accent: { type: "string" },
        background: { type: "string" },
        foreground: { type: "string" },
      },
      additionalProperties: false,
    },
    fonts: {
      type: "object",
      properties: {
        heading: {
          type: "string",
          description: "Font family name only — no weights or styles.",
        },
        body: { type: "string" },
      },
      additionalProperties: false,
    },
    voiceSamples: {
      type: "array",
      items: { type: "string" },
      description:
        "Excerpts of actual brand copy or example sentences from the brand guide that demonstrate the voice. Verbatim where possible.",
    },
    formulas: {
      type: "array",
      items: { type: "string" },
      description:
        "Reusable headline or content patterns the brand uses, e.g. 'The truth about [X]'. Empty if none.",
    },
    brandFacts: {
      type: "string",
      description:
        "Niche, audience, mission, products, distinctive POV — anything the renderer needs to know about the brand to write in its voice.",
    },
    notes: {
      type: "string",
      description:
        "One short paragraph noting what was confidently extracted vs. what wasn't present in the guide. Helps the user know what to fill in by hand.",
    },
  },
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are a brand-systems analyst. The user has uploaded a brand guide PDF (a document the brand uses internally to govern its visual + verbal identity). Your job is to extract the structured fields we need to populate a brand profile in our tooling.

**Colors and fonts are nearly always present in a brand guide. Find them.** Brand guides almost always contain a color palette page (with named swatches like "Buddy Red", "Pixel Ink", etc.) and a typography page (named font stacks). If you don't see them in one pass, look harder — read the visible text on every page, including any palette tables, swatch grids, type-spec sheets, and footer text. Output what's actually shown on the pages, in the format below. Do NOT skip these fields just because they require visual parsing.

Rules:
- Only output values that are actually in the guide. If a field genuinely isn't there, omit it — do not invent.
- **Colors**: output as 6-digit hex (#RRGGBB). The guide will usually list HEX values directly (e.g. "HEX #D64545"). Use those verbatim. If only CMYK/RGB/Pantone is provided, convert to the closest hex.
- **Fonts**: just the typeface family name (e.g. "Press Start 2P", "Inter"). Strip weights, sizes, and styles ("Inter Bold 14px" → "Inter").
- **Voice samples**: pull verbatim sentences that demonstrate the brand's voice. Prefer the "tone of voice" / "voice & speech" / "sample lines" sections of the guide. 3-6 samples is ideal. Quote them exactly, including punctuation.
- **Formulas**: only include if the guide explicitly cites recurring patterns/templates the brand uses for headlines or social copy. Empty array if not present.
- **Brand facts**: a 2-4 sentence summary of niche, audience, mission, products. Lift specifics from the guide — don't paraphrase generically.
- **Notes**: one short paragraph. Be honest about what was extracted vs what wasn't present.

Return only the structured output. No preamble.`;

export async function extractBrandFromPdf(
  pdfBytes: ArrayBuffer,
): Promise<ExtractedBrandFields> {
  const base64 = Buffer.from(pdfBytes).toString("base64");

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: {
        type: "json_schema",
        schema: EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
      },
    } as unknown as Anthropic.Messages.MessageCreateParams["output_config"],
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Extract the brand profile fields from this guide. Return the structured output.",
          },
        ],
      },
    ],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error(
      `Refused: ${message.stop_details?.explanation ?? "unspecified reason"}`,
    );
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Model returned no text content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (err) {
    throw new Error(
      `Failed to parse extraction output: ${(err as Error).message}`,
    );
  }
  // Log the raw extraction so we can see in function logs what Claude
  // actually returned vs what made it through our merge. Helps debug
  // partial-extraction issues without re-running.
  console.log(
    "[extract-brand] raw extraction:",
    JSON.stringify(parsed).slice(0, 2000),
  );
  return parsed as ExtractedBrandFields;
}

// Merge an extraction into an existing BrandProfile. The extracted values win
// where present; existing values stay where the model returned nothing.
//
// Defensive: validates each extracted field individually before merging.
// A malformed color (e.g., "PANTONE 7406" instead of "#D64545") falls back
// to the current value rather than poisoning the entire profile via a
// downstream BrandProfileSchema.parse() throw.
export function mergeExtractionIntoProfile(
  current: BrandProfile,
  extracted: ExtractedBrandFields,
): BrandProfile {
  const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  const validHex = (v: string | undefined): string | undefined =>
    v && HEX_RE.test(v) ? v : undefined;
  const validFontFamily = (v: string | undefined): string | undefined => {
    if (!v) return undefined;
    // Strip weights/styles defensively in case the prompt didn't (e.g.
    // "Press Start 2P Regular" → "Press Start 2P").
    const cleaned = v
      .replace(/\b(regular|bold|italic|light|medium|semibold|black|thin|extralight|extrabold|heavy)\b/gi, "")
      .replace(/\b\d+\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned.length > 0 ? cleaned : undefined;
  };

  return {
    ...current,
    name: extracted.name?.trim() || current.name,
    colors: {
      primary: validHex(extracted.colors?.primary) ?? current.colors.primary,
      secondary: validHex(extracted.colors?.secondary) ?? current.colors.secondary,
      accent: validHex(extracted.colors?.accent) ?? current.colors.accent,
      background:
        validHex(extracted.colors?.background) ?? current.colors.background,
      foreground:
        validHex(extracted.colors?.foreground) ?? current.colors.foreground,
    },
    fonts: {
      heading: (() => {
        const family = validFontFamily(extracted.fonts?.heading);
        return family
          ? { ...current.fonts.heading, family, source: "google" as const }
          : current.fonts.heading;
      })(),
      body: (() => {
        const family = validFontFamily(extracted.fonts?.body);
        return family
          ? { ...current.fonts.body, family, source: "google" as const }
          : current.fonts.body;
      })(),
    },
    voiceSamples:
      extracted.voiceSamples && extracted.voiceSamples.length > 0
        ? extracted.voiceSamples
        : current.voiceSamples,
    formulas:
      extracted.formulas && extracted.formulas.length > 0
        ? extracted.formulas
        : current.formulas,
    brandFacts: extracted.brandFacts?.trim() || current.brandFacts,
  };
}
