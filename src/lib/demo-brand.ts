import type { BrandProfile } from "./types";

// Hard-coded demo brand so the tool flow is testable without setting up a brand.
export const DEMO_BRAND: BrandProfile = {
  name: "Sourdough Sundays",
  colors: {
    primary: "#3D2914",
    accent: "#D97706",
    background: "#F4F1EA",
    foreground: "#3D2914",
  },
  fonts: {
    heading: { family: "Fraunces", source: "google" },
    body: { family: "Inter", source: "google" },
  },
  voiceSamples: [
    "Look — sourdough is not a science fair project. Stop measuring grams to the decimal. Your starter wants warmth, time, and not much else.",
    "The hardest part of bread isn't the bread. It's trusting the dough when it looks like nothing is happening for six hours.",
    "If your loaf came out flat: it's not the flour, it's not the oven, it's that you didn't let the bulk go long enough. Push past the fear.",
  ],
  formulas: [
    "The truth about [common sourdough belief]",
    "[N] signs your starter is actually ready",
    "Stop doing [common mistake] — do this instead",
    "Why your [bread step] keeps failing",
  ],
  brandFacts: `Bread educator on Instagram (@sourdoughsundays). 60K followers, mostly home bakers, 25-45. Niche: demystifying sourdough for non-perfectionists. Hates the precision-obsessed corner of bread Instagram. Teaches by feel and visual cues, not weight ratios. Lives in Portland, Oregon. Bakes in a regular home oven, not a deck oven. First book "Loaves Without Lectures" comes out next year.`,
  assetIds: [],
};
