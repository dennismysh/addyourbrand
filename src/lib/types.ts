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

// --- Template analysis output (what Claude returns) --------------------------

export const TextRoleEnum = z.enum([
  "headline",
  "subheadline",
  "body",
  "list_item",
  "numbered_step",
  "callout",
  "cta",
  "footer",
  "quote",
  "label",
  "decorative",
]);
export type TextRole = z.infer<typeof TextRoleEnum>;

export const TextBlockSchema = z.object({
  role: TextRoleEnum,
  // Original copy from the template (transcribed by the model).
  original: z.string(),
  // Brand-voice rewrite using the brand's facts/formulas.
  rewritten: z.string(),
  // What this text block is *for* — informs the layout decision later.
  intent: z.string(),
  // Approximate position on the canvas (0–1 normalized).
  position: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  }),
  emphasis: z.enum(["primary", "secondary", "tertiary"]),
});

export const LayoutArchetypeEnum = z.enum([
  "hero_single",
  "list_5_tips",
  "list_3_steps",
  "quote_card",
  "before_after",
  "framework_diagram",
  "stat_callout",
  "checklist",
  "mixed",
]);

export const TemplateAnalysisSchema = z.object({
  archetype: LayoutArchetypeEnum,
  // Overall design vibe (informs how brand colors are mapped).
  mood: z.string(),
  background: z.object({
    style: z.enum(["solid", "gradient", "image", "patterned"]),
    description: z.string(),
  }),
  blocks: z.array(TextBlockSchema),
  // What the original template appears to be promoting / teaching.
  topic: z.string(),
});

export type TemplateAnalysis = z.infer<typeof TemplateAnalysisSchema>;

// JSON Schema (for Claude's structured outputs) — derived shape, kept in sync manually.
// We hand-write this rather than auto-deriving so the model gets clean descriptions.
export const TEMPLATE_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    archetype: {
      type: "string",
      enum: [
        "hero_single",
        "list_5_tips",
        "list_3_steps",
        "quote_card",
        "before_after",
        "framework_diagram",
        "stat_callout",
        "checklist",
        "mixed",
      ],
      description: "The closest layout archetype this template fits",
    },
    mood: {
      type: "string",
      description:
        "Overall vibe: e.g., 'minimal editorial', 'playful y2k', 'serious professional'",
    },
    topic: {
      type: "string",
      description: "What the template is teaching or promoting",
    },
    background: {
      type: "object",
      properties: {
        style: {
          type: "string",
          enum: ["solid", "gradient", "image", "patterned"],
        },
        description: { type: "string" },
      },
      required: ["style", "description"],
      additionalProperties: false,
    },
    blocks: {
      type: "array",
      description:
        "Each text block on the template, in reading order, with brand-voice rewrites",
      items: {
        type: "object",
        properties: {
          role: {
            type: "string",
            enum: [
              "headline",
              "subheadline",
              "body",
              "list_item",
              "numbered_step",
              "callout",
              "cta",
              "footer",
              "quote",
              "label",
              "decorative",
            ],
          },
          original: {
            type: "string",
            description: "Verbatim text from the template",
          },
          rewritten: {
            type: "string",
            description:
              "Same role/length, rewritten in the brand's voice using the brand facts/formulas",
          },
          intent: {
            type: "string",
            description: "What this block accomplishes in the design",
          },
          position: {
            type: "object",
            properties: {
              x: { type: "number" },
              y: { type: "number" },
              w: { type: "number" },
              h: { type: "number" },
            },
            required: ["x", "y", "w", "h"],
            additionalProperties: false,
          },
          emphasis: {
            type: "string",
            enum: ["primary", "secondary", "tertiary"],
          },
        },
        required: [
          "role",
          "original",
          "rewritten",
          "intent",
          "position",
          "emphasis",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["archetype", "mood", "topic", "background", "blocks"],
  additionalProperties: false,
} as const;
