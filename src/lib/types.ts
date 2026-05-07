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
  items: z.array(z.object({ text: z.string(), checked: z.boolean() })),
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

// JSON Schema for Claude's structured outputs. Hand-written to keep tight
// descriptions and explicit `required` lists per block kind. Each block kind
// gets a separate object schema in the oneOf.
//
// Properties shared across all block kinds: `kind`, `emphasis`. Plus per-kind
// fields. Required list per kind enforces the model fills the right shape.
function blockSchema(
  kind: string,
  extraProperties: Record<string, unknown>,
  extraRequired: string[],
) {
  return {
    type: "object",
    properties: {
      kind: { type: "string", const: kind },
      emphasis: {
        type: "number",
        enum: [1, 2, 3],
        description:
          "1=primary (hero), 2=supporting, 3=fine-print. Reflects visual weight in the source.",
      },
      ...extraProperties,
    },
    required: ["kind", "emphasis", ...extraRequired],
    additionalProperties: false,
  };
}

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
      description: "Content blocks in document order (top to bottom).",
      items: {
        // Anthropic's structured outputs accepts `anyOf` but not `oneOf`.
        // Each branch has a const `kind` so the variants are mutually
        // exclusive in practice — anyOf and oneOf produce the same result.
        anyOf: [
          blockSchema(
            "heading",
            {
              level: { type: "number", enum: [1, 2, 3] },
              text: { type: "string", description: "Verbatim heading text." },
            },
            ["level", "text"],
          ),
          blockSchema(
            "body",
            {
              text: {
                type: "string",
                description: "A paragraph of body text, verbatim.",
              },
            },
            ["text"],
          ),
          blockSchema(
            "list",
            {
              ordered: {
                type: "boolean",
                description: "true for numbered lists, false for bullets.",
              },
              items: {
                type: "array",
                items: { type: "string" },
                description: "Each list item, verbatim.",
              },
            },
            ["ordered", "items"],
          ),
          blockSchema(
            "table",
            {
              columnHeaders: {
                type: ["array", "null"],
                items: { type: "string" },
                description: "Column header row, verbatim. null if no headers.",
              },
              rows: {
                type: "array",
                items: { type: "array", items: { type: "string" } },
                description:
                  "Each row's cell strings, verbatim, same length as columnHeaders.",
              },
            },
            ["columnHeaders", "rows"],
          ),
          blockSchema(
            "quote",
            {
              text: { type: "string", description: "The quote, verbatim." },
              attribution: {
                type: ["string", "null"],
                description: "Quote attribution if shown. null otherwise.",
              },
            },
            ["text", "attribution"],
          ),
          blockSchema(
            "callout",
            {
              tone: {
                type: "string",
                enum: ["info", "warn", "success", "neutral"],
              },
              text: { type: "string" },
            },
            ["tone", "text"],
          ),
          blockSchema(
            "stat",
            {
              value: {
                type: "string",
                description:
                  "The big number / phrase, verbatim ('5x', '$10K', '3 days').",
              },
              label: {
                type: "string",
                description: "Caption underneath the value.",
              },
            },
            ["value", "label"],
          ),
          blockSchema(
            "step",
            {
              index: { type: "integer", minimum: 1 },
              title: { type: "string" },
              body: {
                type: ["string", "null"],
                description: "Step description if any. null if just a title.",
              },
            },
            ["index", "title", "body"],
          ),
          blockSchema(
            "keyvalue",
            {
              pairs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    term: { type: "string" },
                    definition: { type: "string" },
                  },
                  required: ["term", "definition"],
                  additionalProperties: false,
                },
                description:
                  "Term/definition pairs (glossary, spec sheet, do/don't).",
              },
            },
            ["pairs"],
          ),
          blockSchema(
            "checklist",
            {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    checked: { type: "boolean" },
                  },
                  required: ["text", "checked"],
                  additionalProperties: false,
                },
              },
            },
            ["items"],
          ),
          blockSchema(
            "comparison",
            {
              leftLabel: { type: "string" },
              rightLabel: { type: "string" },
              leftItems: { type: "array", items: { type: "string" } },
              rightItems: { type: "array", items: { type: "string" } },
            },
            ["leftLabel", "rightLabel", "leftItems", "rightItems"],
          ),
          blockSchema(
            "sectionLabel",
            { text: { type: "string" } },
            ["text"],
          ),
          blockSchema("divider", {}, []),
          blockSchema("footer", { text: { type: "string" } }, ["text"]),
          blockSchema(
            "logoSlot",
            {
              position: {
                type: "string",
                enum: [
                  "top",
                  "bottom",
                  "topLeft",
                  "topRight",
                  "bottomLeft",
                  "bottomRight",
                ],
              },
            },
            ["position"],
          ),
        ],
      },
    },
  },
  required: ["layout", "title", "blocks"],
  additionalProperties: false,
} as const;
