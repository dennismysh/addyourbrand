import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "./anthropic";
import {
  TemplateAnalysisSchema,
  TEMPLATE_ANALYSIS_JSON_SCHEMA,
  type BrandProfile,
  type TemplateAnalysis,
} from "./types";

// Stable across every analysis call — defines the analyzer's job and the
// rewriting rules. Long, deliberate, and frozen so it caches cleanly.
const SYSTEM_PROMPT = `You are a senior brand designer + copywriter. Your job is to look at a 2:3 template image (Pinterest-style design intended for Canva) and produce a structured analysis the user's tooling will use to render a rebranded version.

You do TWO things in one pass:

1. **Layout analysis.** Identify every visible text block. For each, output:
   - Its role (headline, subheadline, body, list_item, numbered_step, callout, cta, footer, quote, label, decorative).
   - Its verbatim transcribed text in the "original" field.
   - Its approximate normalized position on the canvas: x and y are the top-left corner from 0–1, w and h are width/height also from 0–1.
   - Its emphasis tier: primary (the dominant text), secondary (supporting), tertiary (fine-print).

2. **Brand-voice rewrite.** For each text block, produce a "rewritten" version that:
   - Keeps the SAME role and approximately the same length (so it fits the original layout).
   - Applies the user's brand voice — the tone and rhythm of their voice samples.
   - Uses the brand's facts and formulas where applicable. If the original template says "5 ways to grow your audience" and the brand teaches sourdough, rewrite to "5 ways to nail your starter" using the brand's domain.
   - Preserves the *intent* of each block (a headline stays a hook, a CTA stays an action, a list item stays a discrete point).

Also output:
- The closest layout archetype.
- A one-line "mood" describing the aesthetic vibe.
- A one-line "topic" describing what the brand-voice version will teach/promote.
- Background style + a short description.

Rules:
- Be faithful to the visible layout. Do not hallucinate text blocks that aren't in the image.
- Transcribe text VERBATIM into "original". Don't fix typos, capitalization, or punctuation.
- Don't translate. Match the original language.
- Rewrites must read naturally — never name-drop the brand, never use phrases like "as a [niche] expert".
- Keep rewrites within ±20% of the original length. Layout stability matters.
- If a block looks decorative (a stray dot, a flourish, a shape with no copy), label its role "decorative" and leave both original and rewritten as empty strings.

Return only the structured output requested. No preamble. No commentary.

When the user has attached **reference images** (their past branded work), study them first. Internalize the brand's visual style — composition rhythm, how white space is used, how colors land in the layout, which text gets large vs small, the mood and energy. Then apply that style awareness to the rewrite (mood field) and to your interpretation of which text elements are primary/secondary/tertiary. References inform *how* the brand uses a layout, not *what* text the new template should have — the new text still comes from the brand voice + facts.`;

function buildBrandContext(brand: BrandProfile): string {
  const voiceLines = brand.voiceSamples.length
    ? brand.voiceSamples
        .map((s, i) => `Sample ${i + 1}:\n${s}`)
        .join("\n\n---\n\n")
    : "(none provided — infer a clean, neutral voice)";

  const formulas = brand.formulas.length
    ? brand.formulas.map((f) => `  - ${f}`).join("\n")
    : "  - (none provided)";

  return `# Brand: ${brand.name}

## Voice samples (write in this voice)
${voiceLines}

## Signature formulas
${formulas}

## Brand facts (use these for content; don't invent details outside this)
${brand.brandFacts || "(none provided)"}

## Visual identity (informational only — used by the renderer)
- Heading font: ${brand.fonts.heading.family}
- Body font: ${brand.fonts.body.family}
- Primary color: ${brand.colors.primary}${brand.colors.accent ? `\n- Accent color: ${brand.colors.accent}` : ""}`;
}

type SupportedMime = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

export interface ReferenceImage {
  base64: string;
  mediaType: SupportedMime;
}

export async function analyzeTemplate({
  brand,
  imageBase64,
  imageMediaType,
  references = [],
}: {
  brand: BrandProfile;
  imageBase64: string;
  imageMediaType: SupportedMime;
  references?: ReferenceImage[];
}): Promise<TemplateAnalysis> {
  const brandContext = buildBrandContext(brand);

  // Build user-message content: references first (with a labeling text block),
  // then the actual template image, then the instruction. Reference images go
  // BEFORE the template so the model establishes brand-style context before
  // it starts analyzing the new layout.
  const userContent: Anthropic.Messages.ContentBlockParam[] = [];

  if (references.length > 0) {
    userContent.push({
      type: "text",
      text: `The next ${references.length} image${references.length === 1 ? " is" : "s are"} this brand's past work — study the visual style before analyzing the template.`,
    });
    for (const ref of references) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: ref.mediaType,
          data: ref.base64,
        },
      });
    }
    userContent.push({
      type: "text",
      text: "Now here is the new template to rebrand:",
    });
  }

  userContent.push({
    type: "image",
    source: {
      type: "base64",
      media_type: imageMediaType,
      data: imageBase64,
    },
  });
  userContent.push({
    type: "text",
    text: "Analyze this 2:3 template and return the structured rebrand plan.",
  });

  // Stream and accumulate. Output may be long with adaptive thinking + xhigh
  // effort; streaming avoids HTTP timeouts and lets us call finalMessage().
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    // `xhigh` is the recommended effort for coding/agentic work on Opus 4.7
    // (between `high` and `max`). The SDK types haven't caught up — cast through.
    output_config: {
      effort: "xhigh",
      format: {
        type: "json_schema",
        schema: TEMPLATE_ANALYSIS_JSON_SCHEMA as unknown as Record<string, unknown>,
      },
    } as unknown as Anthropic.Messages.MessageCreateParams["output_config"],
    system: [
      // Position 1: globally stable analyzer instructions.
      { type: "text", text: SYSTEM_PROMPT },
      // Position 2: per-brand context. Cache from here back — repeat analyses
      // for the same brand reuse this prefix. Tools render before system, so
      // putting the breakpoint on the last system block caches everything.
      {
        type: "text",
        text: brandContext,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
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
      `Failed to parse model output as JSON: ${(err as Error).message}\n\nRaw: ${textBlock.text.slice(0, 500)}`,
    );
  }

  const result = TemplateAnalysisSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Model output didn't match schema: ${result.error.message}`,
    );
  }

  return result.data;
}
