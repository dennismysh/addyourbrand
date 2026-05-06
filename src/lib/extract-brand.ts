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

Rules:
- Only output values that are actually in the guide. If a field isn't present, omit it entirely — do not invent.
- Colors: output as hex (#RRGGBB). Convert from CMYK/RGB/Pantone if needed.
- Fonts: just the family name. Strip weights and styles ("Inter Bold" → "Inter").
- Voice samples: pull verbatim sentences that demonstrate the brand's voice. Prefer the "tone of voice" or "writing style" sections. 2–6 samples is ideal.
- Formulas: only include if the guide explicitly cites recurring patterns/templates the brand uses for headlines or social copy.
- Brand facts: a paragraph-form summary of niche, audience, mission, products. Useful context for downstream copy generation.
- Notes: one paragraph. Be honest about what's missing — don't pad.

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
  return parsed as ExtractedBrandFields;
}

// Merge an extraction into an existing BrandProfile. The extracted values win
// where present; existing values stay where the model returned nothing.
export function mergeExtractionIntoProfile(
  current: BrandProfile,
  extracted: ExtractedBrandFields,
): BrandProfile {
  return {
    ...current,
    name: extracted.name ?? current.name,
    colors: {
      primary: extracted.colors?.primary ?? current.colors.primary,
      secondary: extracted.colors?.secondary ?? current.colors.secondary,
      accent: extracted.colors?.accent ?? current.colors.accent,
      background: extracted.colors?.background ?? current.colors.background,
      foreground: extracted.colors?.foreground ?? current.colors.foreground,
    },
    fonts: {
      heading: extracted.fonts?.heading
        ? { ...current.fonts.heading, family: extracted.fonts.heading }
        : current.fonts.heading,
      body: extracted.fonts?.body
        ? { ...current.fonts.body, family: extracted.fonts.body }
        : current.fonts.body,
    },
    voiceSamples:
      extracted.voiceSamples && extracted.voiceSamples.length > 0
        ? extracted.voiceSamples
        : current.voiceSamples,
    formulas:
      extracted.formulas && extracted.formulas.length > 0
        ? extracted.formulas
        : current.formulas,
    brandFacts: extracted.brandFacts ?? current.brandFacts,
  };
}
