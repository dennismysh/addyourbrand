import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "./anthropic";
import type { BrandProfile } from "./types";

// Required fields with explicit null escape hatch. The model can no longer
// silently omit fields it didn't feel like extracting — it must either
// provide a value or write null and explain in `notes`.
export interface ExtractedBrandFields {
  name: string | null;
  colors: {
    primary: string | null;
    secondary: string | null;
    accent: string | null;
    background: string | null;
    foreground: string | null;
  };
  fonts: {
    heading: string | null;
    body: string | null;
  };
  voiceSamples: string[];
  formulas: string[];
  brandFacts: string | null;
  notes: string;
}

// Marking these fields as required + nullable forces the model to either
// produce a value or explicitly write null (and explain in notes). Without
// `required`, structured outputs lets the model silently omit fields it
// finds inconvenient — which is what was happening: colors and fonts kept
// getting dropped despite explicit hex values in the source PDF.
const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    name: { type: ["string", "null"] },
    colors: {
      type: "object",
      properties: {
        primary: {
          type: ["string", "null"],
          description: "Hex like #RRGGBB. null only if the guide truly has no palette.",
        },
        secondary: { type: ["string", "null"] },
        accent: { type: ["string", "null"] },
        background: { type: ["string", "null"] },
        foreground: { type: ["string", "null"] },
      },
      required: [
        "primary",
        "secondary",
        "accent",
        "background",
        "foreground",
      ],
      additionalProperties: false,
    },
    fonts: {
      type: "object",
      properties: {
        heading: {
          type: ["string", "null"],
          description: "Font family name only — no weights or styles.",
        },
        body: { type: ["string", "null"] },
      },
      required: ["heading", "body"],
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
        "Reusable headline or content patterns the brand uses, e.g. 'The truth about [X]'. Empty array if none.",
    },
    brandFacts: {
      type: ["string", "null"],
      description:
        "Niche, audience, mission, products, distinctive POV — a 2-4 sentence summary. null only if the guide is purely visual with no descriptive content.",
    },
    notes: {
      type: "string",
      description:
        "One short paragraph noting what was extracted vs. what was set to null and why. If you returned null for any color or font, the notes MUST explain why (not present in guide, ambiguous, etc.). Required to be non-empty.",
    },
  },
  required: [
    "name",
    "colors",
    "fonts",
    "voiceSamples",
    "formulas",
    "brandFacts",
    "notes",
  ],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are a brand-systems analyst. The user has uploaded a brand guide PDF (a document the brand uses internally to govern its visual + verbal identity). Your job is to extract the structured fields we need to populate a brand profile in our tooling.

**Brand guides almost always contain explicit color palettes and named typefaces. Find them.** Most guides have a dedicated "color palette" or "swatches" page listing primary, secondary, accent, background, and foreground colors with hex codes (e.g. "BUDDY RED · HEX #D64545"). They also have a "typography" or "type stack" page listing heading and body font families. **If those sections exist in the guide, you MUST extract the values.** Do not skip them. Read every page visually — palette pages often use a grid of colored swatches with the hex code printed below each.

Output rules — read carefully:
- **Every field in the schema is required.** Use \`null\` ONLY when the guide genuinely does not contain that information. Never use \`null\` as an escape hatch for "I'd rather not extract this."
- **Colors**: 6-digit hex (#RRGGBB). The guide will usually list HEX values directly. Use those verbatim. If only CMYK/RGB/Pantone is shown, convert to the closest hex. \`null\` only if the guide has zero palette information at all.
- **Fonts**: just the typeface family name (e.g. "Press Start 2P", "Inter"). Strip weights, sizes, and styles ("Inter Bold 14px" → "Inter"). \`null\` only if no typeface is named anywhere in the guide.
- **Voice samples**: array of verbatim quoted sentences. Prefer the "tone of voice" / "voice & speech" / "sample lines" sections. 3-6 is ideal. Empty array if no example copy exists.
- **Formulas**: array of recurring patterns/templates the brand explicitly cites for headlines or social copy. Empty array if not present.
- **Brand facts**: a 2-4 sentence summary of niche, audience, mission, products, distinctive POV. Lift specifics from the guide. \`null\` only if the guide is purely visual.
- **Notes**: required, non-empty. One short paragraph. **If you returned \`null\` for any color or font field, you MUST explain why in the notes** — be specific about which field and what the guide actually contains in that section.

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
  const validHex = (v: string | null | undefined): string | undefined =>
    v && HEX_RE.test(v) ? v : undefined;
  const validFontFamily = (v: string | null | undefined): string | undefined => {
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
