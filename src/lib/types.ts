import { z } from "zod";

// --- Brand profile -----------------------------------------------------------

export const HexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex color");

export const FontDef = z.object({
  family: z.string().min(1),
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
  voiceSamples: z.array(z.string()).default([]),
  formulas: z.array(z.string()).default([]),
  brandFacts: z.string().default(""),
  assetIds: z.array(z.string()).default([]),
});

export type BrandProfile = z.infer<typeof BrandProfileSchema>;

// --- Document structure (preservation mode) ---------------------------------
//
// Wire shape (sent to Claude / parsed back): per-kind fields are grouped under
// nullable sub-objects to keep the count of union-typed parameters under
// Anthropic's structured-outputs limit of 16. The block kind = which sub-object
// is non-null.
//
// Runtime shape (the discriminated union below): flat, easy for the renderer
// to consume. We transform from wire → runtime in `flattenBlock` after parse.

const BlockBase = {
  emphasis: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
};

// Runtime block shapes — flat, used by the renderer.
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
  columnHeaders: z.array(z.string()).nullable(),
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
  tone: z.enum(["info", "warn", "success", "neutral"]),
  text: z.string(),
  ...BlockBase,
});

export const StatBlockSchema = z.object({
  kind: z.literal("stat"),
  value: z.string(),
  label: z.string(),
  ...BlockBase,
});

export const StepBlockSchema = z.object({
  kind: z.literal("step"),
  index: z.number().int(),
  title: z.string(),
  body: z.string().nullable(),
  ...BlockBase,
});

export const KeyValueBlockSchema = z.object({
  kind: z.literal("keyvalue"),
  pairs: z.array(z.object({ term: z.string(), definition: z.string() })),
  ...BlockBase,
});

export const ChecklistBlockSchema = z.object({
  kind: z.literal("checklist"),
  checkItems: z.array(z.object({ text: z.string(), checked: z.boolean() })),
  ...BlockBase,
});

export const ComparisonBlockSchema = z.object({
  kind: z.literal("comparison"),
  leftLabel: z.string(),
  rightLabel: z.string(),
  leftItems: z.array(z.string()),
  rightItems: z.array(z.string()),
  ...BlockBase,
});

export const SectionLabelBlockSchema = z.object({
  kind: z.literal("sectionLabel"),
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
  position: z.enum([
    "top",
    "bottom",
    "topLeft",
    "topRight",
    "bottomLeft",
    "bottomRight",
  ]),
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

// --- Wire shape (what Claude returns; we flatten it post-parse) -------------
//
// One nullable sub-object per block kind that has multi-field data.
// `text` is shared across kinds that just need a single string.
// `kind` discriminates which sub-object is filled.

export const WireBlockSchema = z.object({
  kind: z.enum([
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
  ]),
  emphasis: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  // Shared single-string field used by simple kinds (heading, body, callout,
  // quote, sectionLabel, footer). null for compound kinds.
  text: z.string().nullable(),
  // Per-kind data sub-objects. The block's `kind` says which one is non-null.
  heading: z.object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]) }).nullable(),
  list: z.object({ ordered: z.boolean(), items: z.array(z.string()) }).nullable(),
  table: z
    .object({
      columnHeaders: z.array(z.string()).nullable(),
      rows: z.array(z.array(z.string())),
    })
    .nullable(),
  quote: z.object({ attribution: z.string().nullable() }).nullable(),
  callout: z
    .object({ tone: z.enum(["info", "warn", "success", "neutral"]) })
    .nullable(),
  stat: z.object({ value: z.string(), label: z.string() }).nullable(),
  step: z
    .object({
      index: z.number().int(),
      title: z.string(),
      body: z.string().nullable(),
    })
    .nullable(),
  keyvalue: z
    .object({
      pairs: z.array(z.object({ term: z.string(), definition: z.string() })),
    })
    .nullable(),
  checklist: z
    .object({
      checkItems: z.array(
        z.object({ text: z.string(), checked: z.boolean() }),
      ),
    })
    .nullable(),
  comparison: z
    .object({
      leftLabel: z.string(),
      rightLabel: z.string(),
      leftItems: z.array(z.string()),
      rightItems: z.array(z.string()),
    })
    .nullable(),
  logoSlot: z
    .object({
      position: z.enum([
        "top",
        "bottom",
        "topLeft",
        "topRight",
        "bottomLeft",
        "bottomRight",
      ]),
    })
    .nullable(),
});

export type WireBlock = z.infer<typeof WireBlockSchema>;

// Convert a WireBlock (nested per-kind sub-objects) to a Block (flat
// discriminated-union variant). Throws if the wire shape is missing the data
// for its declared kind.
export function flattenBlock(w: WireBlock): Block {
  const e = w.emphasis;
  switch (w.kind) {
    case "heading":
      if (!w.heading || w.text == null)
        throw new Error("heading block missing data");
      return { kind: "heading", emphasis: e, level: w.heading.level, text: w.text };
    case "body":
      if (w.text == null) throw new Error("body block missing text");
      return { kind: "body", emphasis: e, text: w.text };
    case "list":
      if (!w.list) throw new Error("list block missing data");
      return {
        kind: "list",
        emphasis: e,
        ordered: w.list.ordered,
        items: w.list.items,
      };
    case "table":
      if (!w.table) throw new Error("table block missing data");
      return {
        kind: "table",
        emphasis: e,
        columnHeaders: w.table.columnHeaders,
        rows: w.table.rows,
      };
    case "quote":
      if (!w.quote || w.text == null)
        throw new Error("quote block missing data");
      return {
        kind: "quote",
        emphasis: e,
        text: w.text,
        attribution: w.quote.attribution,
      };
    case "callout":
      if (!w.callout || w.text == null)
        throw new Error("callout block missing data");
      return { kind: "callout", emphasis: e, tone: w.callout.tone, text: w.text };
    case "stat":
      if (!w.stat) throw new Error("stat block missing data");
      return {
        kind: "stat",
        emphasis: e,
        value: w.stat.value,
        label: w.stat.label,
      };
    case "step":
      if (!w.step) throw new Error("step block missing data");
      return {
        kind: "step",
        emphasis: e,
        index: w.step.index,
        title: w.step.title,
        body: w.step.body,
      };
    case "keyvalue":
      if (!w.keyvalue) throw new Error("keyvalue block missing data");
      return { kind: "keyvalue", emphasis: e, pairs: w.keyvalue.pairs };
    case "checklist":
      if (!w.checklist) throw new Error("checklist block missing data");
      return {
        kind: "checklist",
        emphasis: e,
        checkItems: w.checklist.checkItems,
      };
    case "comparison":
      if (!w.comparison) throw new Error("comparison block missing data");
      return {
        kind: "comparison",
        emphasis: e,
        leftLabel: w.comparison.leftLabel,
        rightLabel: w.comparison.rightLabel,
        leftItems: w.comparison.leftItems,
        rightItems: w.comparison.rightItems,
      };
    case "sectionLabel":
      if (w.text == null)
        throw new Error("sectionLabel block missing text");
      return { kind: "sectionLabel", emphasis: e, text: w.text };
    case "divider":
      return { kind: "divider", emphasis: e };
    case "footer":
      if (w.text == null) throw new Error("footer block missing text");
      return { kind: "footer", emphasis: e, text: w.text };
    case "logoSlot":
      if (!w.logoSlot) throw new Error("logoSlot block missing data");
      return { kind: "logoSlot", emphasis: e, position: w.logoSlot.position };
  }
}

export const WireDocumentStructureSchema = z.object({
  layout: z.enum(["flow", "centered"]),
  title: z.string(),
  blocks: z.array(WireBlockSchema),
});

export const DocumentStructureSchema = z.object({
  layout: z.enum(["flow", "centered"]),
  title: z.string(),
  blocks: z.array(BlockSchema),
});

export type DocumentStructure = z.infer<typeof DocumentStructureSchema>;

// JSON Schema for Claude's structured outputs. Nested-per-kind shape: each
// block has `kind` + `emphasis` + a single shared `text` + one nullable
// sub-object per multi-field kind. Parameter count: 13 nullable params at the
// block level (under Anthropic's 16 limit).

const subObject = (
  properties: Record<string, unknown>,
  required: string[],
) => ({
  type: ["object", "null"],
  properties,
  required,
  additionalProperties: false,
});

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
              "1=primary (hero), 2=supporting, 3=fine-print.",
          },
          text: {
            type: ["string", "null"],
            description:
              "Verbatim text for kinds that need just one string: heading, body, quote, callout, sectionLabel, footer. null for compound kinds.",
          },
          heading: subObject(
            { level: { type: "number", enum: [1, 2, 3] } },
            ["level"],
          ),
          list: subObject(
            {
              ordered: { type: "boolean" },
              items: { type: "array", items: { type: "string" } },
            },
            ["ordered", "items"],
          ),
          table: subObject(
            {
              columnHeaders: {
                type: ["array", "null"],
                items: { type: "string" },
              },
              rows: {
                type: "array",
                items: { type: "array", items: { type: "string" } },
              },
            },
            ["columnHeaders", "rows"],
          ),
          quote: subObject(
            { attribution: { type: ["string", "null"] } },
            ["attribution"],
          ),
          callout: subObject(
            {
              tone: {
                type: "string",
                enum: ["info", "warn", "success", "neutral"],
              },
            },
            ["tone"],
          ),
          stat: subObject(
            { value: { type: "string" }, label: { type: "string" } },
            ["value", "label"],
          ),
          step: subObject(
            {
              index: { type: "integer" },
              title: { type: "string" },
              body: { type: ["string", "null"] },
            },
            ["index", "title", "body"],
          ),
          keyvalue: subObject(
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
              },
            },
            ["pairs"],
          ),
          checklist: subObject(
            {
              checkItems: {
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
            ["checkItems"],
          ),
          comparison: subObject(
            {
              leftLabel: { type: "string" },
              rightLabel: { type: "string" },
              leftItems: { type: "array", items: { type: "string" } },
              rightItems: { type: "array", items: { type: "string" } },
            },
            ["leftLabel", "rightLabel", "leftItems", "rightItems"],
          ),
          logoSlot: subObject(
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
        },
        required: [
          "kind",
          "emphasis",
          "text",
          "heading",
          "list",
          "table",
          "quote",
          "callout",
          "stat",
          "step",
          "keyvalue",
          "checklist",
          "comparison",
          "logoSlot",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["layout", "title", "blocks"],
  additionalProperties: false,
} as const;
