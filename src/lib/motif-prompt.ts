import type { BrandProfile } from "./types";

// Catalogue of decorative motif kinds the analyzer can request. Each maps
// to a parametric prompt template. Keep this small + opinionated: too many
// kinds means more inconsistency. Better to ship 5 motifs that look great
// than 30 that look mediocre.
export type MotifKind =
  | "quote_marks_giant"
  | "ornamental_frame"
  | "corner_flourish"
  | "divider_pattern"
  | "background_pattern";

interface MotifPromptInput {
  kind: MotifKind;
  brand: BrandProfile;
  // Optional brand-style hints — usually pulled from brandFacts and voice.
  styleHint?: string;
}

// Build a Gemini prompt for one motif against the brand. Designed to bias
// hard toward "isolated decorative element on transparent/solid background"
// so the renderer can layer it without battling baked-in scenery.
export function buildMotifPrompt(input: MotifPromptInput): string {
  const { kind, brand, styleHint } = input;
  const accent = brand.colors.accent ?? brand.colors.primary;
  const palette = `palette: primary ${brand.colors.primary}, accent ${accent}, background ${brand.colors.background}, foreground ${brand.colors.foreground}`;

  const styleLine = styleHint
    ? `Visual style: ${styleHint}.`
    : `Visual style: matches a brand named "${brand.name}". Heading typeface is "${brand.fonts.heading.family}" — let that influence the style (e.g., pixel font → arcade/retro motif; serif → editorial/classic motif).`;

  const baseRules = [
    "Isolated decorative motif on a flat solid background that exactly matches the brand background color.",
    "No people, no objects, no text, no letters, no logos, no UI chrome, no scenery.",
    "Pure geometric or graphic shape only.",
    "High contrast — accent color on background color.",
    "Square 1:1 aspect ratio.",
    "Minimal, intentional, single-color or two-color silhouette.",
  ];

  const kindSpec: Record<MotifKind, string> = {
    quote_marks_giant:
      "Subject: a single oversized opening quotation mark (66) in the brand's accent color. Bold, geometric, takes up 60-80% of the frame. Suitable for placement as a hero element on a quote card.",
    ornamental_frame:
      "Subject: a thin rectangular frame border in the accent color, with a subtle corner ornament at each corner. The frame outlines the canvas; the interior is the brand background color (transparent visually). Suitable for surrounding text content.",
    corner_flourish:
      "Subject: an asymmetric ornamental flourish positioned in the top-left corner — short curved or geometric strokes radiating from the corner. Empty in the rest of the frame. Suitable for layering over a corner of a design.",
    divider_pattern:
      "Subject: a horizontal divider band — a single row of small repeated abstract geometric shapes (dots OR small dashes OR small ticks OR tiny stars — pick ONE), in the accent color, centered, taking up the middle 60% of the frame width and only the middle 10% of the frame height. Empty above and below the band. Strictly NO figurative imagery — no cars, no objects, no glyphs of any subject. Only abstract geometric punctuation.",
    background_pattern:
      "Subject: a TILED REPEATING pattern that fills the ENTIRE frame edge-to-edge with the same small motif repeated many times in a regular grid (think wallpaper or wrapping paper). The motif itself is tiny (1-3% of frame width each), the same shape repeated in a grid of 8x8 or denser. Low contrast: motifs in accent color at low visual weight against the brand background. NOT a single hero subject. NOT a centered illustration. Picture: subtle textured paper, not a poster.",
  };

  return [
    kindSpec[kind],
    styleLine,
    palette,
    ...baseRules,
  ].join(" ");
}
