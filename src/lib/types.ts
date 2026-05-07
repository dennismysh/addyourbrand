import { z } from "zod";

// --- Brand profile -----------------------------------------------------------

export const HexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex color");

export const FontDef = z.object({
  family: z.string().min(1),
  // "google" → loaded by name; "asset" → uploaded font file referenced by assetId
  source: z.enum(["google", "asset"]),
  assetId: z.string().optional(),
  weights: z.array(z.number()).optional(),
});
export type FontDef = z.infer<typeof FontDef>;

export const BrandProfileSchema = z.object({
  name: z.string().min(1),
  colors: z.object({
    primary: HexColor,
    secondary: HexColor.optional(),
    accent: HexColor.optional(),
    background: HexColor.default("#FFFFFF"),
    foreground: HexColor.default("#111111"),
  }),
  fonts: z.object({
    heading: FontDef,
    body: FontDef,
  }),
  // Voice samples — pasted excerpts of the user's actual writing.
  voiceSamples: z.array(z.string()).default([]),
  // Reusable patterns the creator uses, e.g. "5 ways to ___", "the truth about ___".
  formulas: z.array(z.string()).default([]),
  // Free-form facts the creator drops in: bio, niche, target audience, products.
  brandFacts: z.string().default(""),
  // Asset references (logos, reference imagery) — actual files in Netlify Blobs.
  assetIds: z.array(z.string()).default([]),
});

export type BrandProfile = z.infer<typeof BrandProfileSchema>;

// --- Document structure (preservation mode) ---------------------------------
// The analyzer extracts the template's content as a sequence of typed blocks.
// Text is verbatim — no domain swaps, no voice rewrites at this stage.
// The brand renderer styles each block kind in the user's brand identity.

const BlockBase = {
  // 1 = primary (hero text), 2 = supporting, 3 = fine-print
  emphasis: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
};

export const HeadingBlockSchema = z.object({
  kind: z.literal("heading"),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: z.string(),
  ...BlockBase,
});

export const BodyBlockSchema = z.object({
  kind: z.literal("body"),
  text: z.string(),
  ...BlockBase,
});

export const ListBlockSchema = z.object({
  kind: z.literal("list"),
  ordered: z.boolean(),
  items: z.array(z.string()),
  ...BlockBase,
});

export const TableBlockSchema = z.object({
  kind: z.literal("table"),
  // Optional column headers row.
  columnHeaders: z.array(z.string()).nullable(),
  // Each row is an array of cell strings (same length as columnHeaders if present).
  rows: z.array(z.array(z.string())),
  ...BlockBase,
});

export const QuoteBlockSchema = z.object({
  kind: z.literal("quote"),
  text: z.string(),
  attribution: z.string().nullable(),
  ...BlockBase,
});

export const CalloutBlockSchema = z.object({
  kind: z.literal("callout"),
  // Tone hints help the renderer pick a brand color (info → accent, warn → red, etc.)
  tone: z.enum(["info", "warn", "success", "neutral"]),
  text: z.string(),
  ...BlockBase,
});

export const StatBlockSchema = z.object({
  kind: z.literal("stat"),
  // The big number / phrase ("5x", "$10K", "3 days")
  value: z.string(),
  // Caption underneath ("faster onboarding")
  label: z.string(),
  ...BlockBase,
});

export const StepBlockSchema = z.object({
  kind: z.literal("step"),
  index: z.number().int().min(1),
  title: z.string(),
  body: z.string().nullable(),
  ...BlockBase,
});

export const KeyValueBlockSchema = z.object({
  kind: z.literal("keyvalue"),
  // Term-definition pairs (glossary, spec sheet, do/don't lists)
  pairs: z.array(z.object({ term: z.string(), definition: z.string() })),
  ...BlockBase,
});

export const ChecklistBlockSchema = z.object({
  kind: z.literal("checklist"),
  // Renamed from `items` to avoid a field-type collision with list.items
  // (string[]) when serializing both kinds through a single flat JSON schema.
  checkItems: z.array(z.object({ text: z.string(), checked: z.boolean() })),
  ...BlockBase,
});

export const ComparisonBlockSchema = z.object({
  kind: z.literal("comparison"),
  // Two-column layouts (before/after, do/don't, pros/cons)
  leftLabel: z.string(),
  rightLabel: z.string(),
  leftItems: z.array(z.string()),
  rightItems: z.array(z.string()),
  ...BlockBase,
});

export const SectionLabelBlockSchema = z.object({
  kind: z.literal("sectionLabel"),
  // Small all-caps label that introduces a new section ("Pros", "Step 1", "Inside this guide")
  text: z.string(),
  ...BlockBase,
});

export const DividerBlockSchema = z.object({
  kind: z.literal("divider"),
  ...BlockBase,
});

export const FooterBlockSchema = z.object({
  kind: z.literal("footer"),
  text: z.string(),
  ...BlockBase,
});

export const LogoSlotBlockSchema = z.object({
  kind: z.literal("logoSlot"),
  position: z.enum(["top", "bottom", "topLeft", "topRight", "bottomLeft", "bottomRight"]),
  ...BlockBase,
});

export const BlockSchema = z.discriminatedUnion("kind", [
  HeadingBlockSchema,
  BodyBlockSchema,
  ListBlockSchema,
  TableBlockSchema,
  QuoteBlockSchema,
  CalloutBlockSchema,
  StatBlockSchema,
  StepBlockSchema,
  KeyValueBlockSchema,
  ChecklistBlockSchema,
  ComparisonBlockSchema,
  SectionLabelBlockSchema,
  DividerBlockSchema,
  FooterBlockSchema,
  LogoSlotBlockSchema,
]);

export type Block = z.infer<typeof BlockSchema>;

export const DocumentStructureSchema = z.object({
  // Overall layout intent.
  // "flow" = top-to-bottom (most templates), "centered" = single hero on a card
  layout: z.enum(["flow", "centered"]),
  // Verbatim title, surfaced for filename + page metadata.
  title: z.string(),
  // Content blocks in document order.
  blocks: z.array(BlockSchema),
});

export type DocumentStructure = z.infer<typeof DocumentStructureSchema>;

// JSON Schema for Claude's structured outputs.
//
// Flat single-block schema. Anthropic's grammar compiler choked on a 15-branch
// anyOf with per-branch required lists ("compiled grammar too large"), so all
// per-kind fields live as nullable optional siblings on one object. The `kind`
// discriminator + the prompt tell the model which fields to populate. Zod's
// `BlockSchema` discriminated union enforces correctness post-parse — the
// model can't, e.g., return kind=heading without `level` and slip through.
export const DOCUMENT_STRUCTURE_JSON_SCHEMA = {
  type: "object",
  properties: {
    layout: {
      type: "string",
      enum: ["flow", "centered"],
      description:
        "'flow' for top-to-bottom multi-block templates (most cases). 'centered' for single-hero cards.",
    },
    title: {
      type: "string",
      description:
        "Verbatim title of the source template. The first heading or the most prominent text.",
    },
    blocks: {
      type: "array",
      description:
        "Content blocks in document order. Each block has a `kind` discriminator and fills only the fields relevant to that kind (others stay null).",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: [
              "heading",
              "body",
              "list",
              "table",
              "quote",
              "callout",
              "stat",
              "step",
              "keyvalue",
              "checklist",
              "comparison",
              "sectionLabel",
              "divider",
              "footer",
              "logoSlot",
            ],
          },
          emphasis: {
            type: "number",
            enum: [1, 2, 3],
            description:
              "1=primary (hero), 2=supporting, 3=fine-print. Reflects visual weight in the source.",
          },
          // Per-kind fields. All nullable. Fill ONLY the ones for the chosen `kind`.
          level: {
            type: ["number", "null"],
            enum: [1, 2, 3, null],
            description: "heading: 1, 2, or 3. null otherwise.",
          },
          text: {
            type: ["string", "null"],
            description:
              "Verbatim text for: heading, body, quote, callout, sectionLabel, footer. null for other kinds.",
          },
          ordered: {
            type: ["boolean", "null"],
            description: "list: true for numbered, false for bullets. null otherwise.",
          },
          items: {
            type: ["array", "null"],
            items: { type: "string" },
            description: "list: array of item strings, verbatim. null for other kinds.",
          },
          columnHeaders: {
            type: ["array", "null"],
            items: { type: "string" },
            description:
              "table: column header row, verbatim. Set to null if the table has no header row.",
          },
          rows: {
            type: ["array", "null"],
            items: { type: "array", items: { type: "string" } },
            description:
              "table: each row's cells, verbatim. Same length as columnHeaders if present. null for other kinds.",
          },
          attribution: {
            type: ["string", "null"],
            description: "quote: attribution if shown. null otherwise.",
          },
          tone: {
            type: ["string", "null"],
            enum: ["info", "warn", "success", "neutral", null],
            description: "callout: pick one. null for other kinds.",
          },
          value: {
            type: ["string", "null"],
            description:
              "stat: the big number/phrase, verbatim ('5x', '$10K'). null for other kinds.",
          },
          label: {
            type: ["string", "null"],
            description: "stat: caption under the value. null for other kinds.",
          },
          index: {
            type: ["integer", "null"],
            description: "step: 1-based index. null for other kinds.",
          },
          title: {
            type: ["string", "null"],
            description: "step: step title. null for other kinds.",
          },
          body: {
            type: ["string", "null"],
            description: "step: optional description under the title. null for other kinds.",
          },
          pairs: {
            type: ["array", "null"],
            items: {
              type: "object",
              properties: {
                term: { type: "string" },
                definition: { type: "string" },
              },
              required: ["term", "definition"],
              additionalProperties: false,
            },
            description: "keyvalue: term/definition pairs. null for other kinds.",
          },
          checkItems: {
            type: ["array", "null"],
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                checked: { type: "boolean" },
              },
              required: ["text", "checked"],
              additionalProperties: false,
            },
            description: "checklist: items with checked-state. null for other kinds.",
          },
          leftLabel: {
            type: ["string", "null"],
            description: "comparison: left column label. null for other kinds.",
          },
          rightLabel: {
            type: ["string", "null"],
            description: "comparison: right column label. null for other kinds.",
          },
          leftItems: {
            type: ["array", "null"],
            items: { type: "string" },
            description: "comparison: left column items, verbatim.",
          },
          rightItems: {
            type: ["array", "null"],
            items: { type: "string" },
            description: "comparison: right column items, verbatim.",
          },
          position: {
            type: ["string", "null"],
            enum: [
              "top",
              "bottom",
              "topLeft",
              "topRight",
              "bottomLeft",
              "bottomRight",
              null,
            ],
            description: "logoSlot: where the logo sits on the canvas. null for other kinds.",
          },
        },
        required: ["kind", "emphasis"],
        additionalProperties: false,
      },
    },
  },
  required: ["layout", "title", "blocks"],
  additionalProperties: false,
} as const;
