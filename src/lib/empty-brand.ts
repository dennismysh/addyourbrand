import type { BrandProfile } from "./types";

export function emptyBrand(): BrandProfile {
  return {
    name: "",
    colors: {
      primary: "#111111",
      accent: "#D97706",
      background: "#FFFFFF",
      foreground: "#111111",
    },
    fonts: {
      heading: { family: "Fraunces", source: "google" },
      body: { family: "Inter", source: "google" },
    },
    voiceSamples: [],
    formulas: [],
    brandFacts: "",
    assetIds: [],
  };
}
