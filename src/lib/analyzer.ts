import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "./anthropic";
import {
  DocumentStructureSchema,
  DOCUMENT_STRUCTURE_JSON_SCHEMA,
  type DocumentStructure,
} from "./types";

// Stable across every call. Preservation mode: the analyzer extracts the
// source template's content as a typed block sequence. Text is verbatim. The
// brand's identity is applied later by the renderer, not here.
const SYSTEM_PROMPT = `You are a document structure analyst. The user has uploaded an image of a 2:3 design template (Pinterest-style, intended for Canva). Your job is to extract the document's content as a sequence of typed blocks the rendering pipeline can re-typeset in any brand identity.

Critical rule: **transcribe every visible word verbatim.** Do not rewrite, paraphrase, summarize, translate, or substitute domains. The output is the SAME content as the source — only the rendering changes.

Block kinds available:

- **heading** (level 1-3): titles, section headers
- **body**: paragraph text
- **list**: bulleted (\`ordered: false\`) or numbered (\`ordered: true\`)
- **table**: rows × columns, with optional header row. Use this whenever the source shows a tabular grid with cell borders or aligned columns.
- **quote**: pulled or stylized quotation
- **callout**: highlighted box with key info — pick \`tone\` from info/warn/success/neutral
- **stat**: a big number/phrase with a small caption ("5x faster", "$10K saved")
- **step**: numbered process step with an index, title, optional body
- **keyvalue**: term-definition pairs (glossaries, spec sheets, do/don't lists)
- **checklist**: items with checked-state
- **comparison**: two-column layouts (before/after, do/don't, pros/cons)
- **sectionLabel**: small all-caps label introducing a new section ("Pros", "Step 1", "Inside this guide")
- **divider**: horizontal rule between sections
- **footer**: small fine-print at the bottom (handles, dates, sources, copyrights)
- **logoSlot**: an explicit logo placement on the source. Use \`position\` to indicate where on the canvas.

**Fields per block kind.** Each block object has \`kind\` and \`emphasis\` plus a flat list of optional fields. **Fill only the fields for the chosen kind** — leave the rest \`null\`.

| kind | fields to fill |
|---|---|
| heading | level (1/2/3), text |
| body | text |
| list | ordered, items (string array) |
| table | columnHeaders (string array or null), rows (array of string arrays) |
| quote | text, attribution (or null) |
| callout | tone (info/warn/success/neutral), text |
| stat | value, label |
| step | index (starts at 1), title, body (or null) |
| keyvalue | pairs (array of {term, definition}) |
| checklist | checkItems (array of {text, checked}) |
| comparison | leftLabel, rightLabel, leftItems, rightItems |
| sectionLabel | text |
| divider | (none) |
| footer | text |
| logoSlot | position (top/bottom/topLeft/topRight/bottomLeft/bottomRight) |

Picking the right kind:

- A 2-column grid with cell borders → table (do NOT flatten into list items)
- A numbered set of steps with arrows or progressive structure → multiple step blocks
- "Don't / Do" or "Before / After" two-column boxes → comparison
- A single hero number with a phrase under it → stat
- "How to make…" with 1, 2, 3 below → step blocks
- A bordered box with an icon and one line → callout
- "Definitions:" or "Glossary:" or paired terms → keyvalue

Output rules:

- Block order = document reading order (top to bottom; for split layouts, left column first).
- emphasis: 1 = hero/primary, 2 = supporting, 3 = fine-print.
- For tables: \`columnHeaders\` is the literal header row if present; otherwise null. \`rows\` is the data rows, each as an array of cell strings the same length as the headers (or each other if no headers).
- Verbatim means verbatim. If the source says "**text**" or has typos, keep them.
- Do not invent blocks that aren't on the page.
- Decorative elements (flourishes, dots, backgrounds without text) — omit. Don't synthesize a block for them.

Return only the structured output. No preamble, no commentary.`;

type SupportedMime = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

export interface ReferenceImage {
  base64: string;
  mediaType: SupportedMime;
}

export async function analyzeTemplate({
  imageBase64,
  imageMediaType,
}: {
  // The brand profile is no longer passed to the analyzer — the analyzer's
  // only job is structural extraction. Brand styling is the renderer's job.
  // (References + brand context for tone-aware modes will move into a
  // separate optional layer in a follow-up.)
  imageBase64: string;
  imageMediaType: SupportedMime;
}): Promise<DocumentStructure> {
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "xhigh",
      format: {
        type: "json_schema",
        schema: DOCUMENT_STRUCTURE_JSON_SCHEMA as unknown as Record<
          string,
          unknown
        >,
      },
    } as unknown as Anthropic.Messages.MessageCreateParams["output_config"],
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: imageMediaType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: "Extract the document structure of this 2:3 template. Verbatim text only.",
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
      `Failed to parse model output as JSON: ${(err as Error).message}\n\nRaw: ${textBlock.text.slice(0, 500)}`,
    );
  }

  const result = DocumentStructureSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Model output didn't match schema: ${result.error.message}\n\nRaw: ${textBlock.text.slice(0, 500)}`,
    );
  }

  return result.data;
}
