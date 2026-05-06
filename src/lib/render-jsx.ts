import type { BrandProfile, TemplateAnalysis, TextRole } from "./types";

// Satori-compatible JSX builder. We don't use the React component because
// Satori has its own (limited) layout engine — Tailwind classes won't work,
// and only a subset of CSS is honored. Everything here is inline styles.
//
// Output dimensions: 1080×1620 (true 2:3). The renderer scales to that exact size.

const CANVAS_W = 1080;
const CANVAS_H = 1620;

export function buildDesignJsx(
  brand: BrandProfile,
  analysis: TemplateAnalysis,
) {
  const accent = brand.colors.accent ?? brand.colors.primary;
  const bg =
    analysis.background.style === "gradient"
      ? `linear-gradient(135deg, ${brand.colors.primary}, ${accent})`
      : brand.colors.background;

  const headingFont = brand.fonts.heading.family;
  const bodyFont = brand.fonts.body.family;

  const blocks = analysis.blocks
    .filter((b) => b.role !== "decorative" && b.rewritten.trim().length > 0)
    .map((block, i) => {
      const styles = roleStyles(block.role, block.emphasis, brand);
      const x = block.position.x * CANVAS_W;
      const y = block.position.y * CANVAS_H;
      const w = block.position.w * CANVAS_W;
      const h = Math.max(block.position.h * CANVAS_H, 60);

      const isHeading =
        block.role === "headline" ||
        block.role === "subheadline" ||
        block.role === "callout" ||
        block.role === "quote";

      const prefix =
        block.role === "numbered_step"
          ? `${i + 1}. `
          : block.role === "list_item"
            ? "• "
            : "";

      return {
        type: "div",
        key: i,
        props: {
          style: {
            position: "absolute",
            left: x,
            top: y,
            width: w,
            height: h,
            display: "flex",
            fontFamily: isHeading ? headingFont : bodyFont,
            ...styles,
          },
          children: `${prefix}${block.rewritten}`,
        },
      };
    });

  return {
    type: "div",
    props: {
      style: {
        width: CANVAS_W,
        height: CANVAS_H,
        background: bg,
        color: brand.colors.foreground,
        position: "relative",
        display: "flex",
        fontFamily: bodyFont,
      },
      children: blocks,
    },
  };
}

function roleStyles(
  role: TextRole,
  emphasis: "primary" | "secondary" | "tertiary",
  brand: BrandProfile,
): Record<string, string | number> {
  const accent = brand.colors.accent ?? brand.colors.primary;
  const scale = emphasis === "primary" ? 1 : emphasis === "secondary" ? 0.7 : 0.5;

  switch (role) {
    case "headline":
      return {
        fontSize: 84 * scale,
        fontWeight: 700,
        lineHeight: 1.05,
        letterSpacing: "-0.02em",
        color: brand.colors.primary,
      };
    case "subheadline":
      return {
        fontSize: 54 * scale,
        fontWeight: 500,
        lineHeight: 1.2,
        color: brand.colors.foreground,
      };
    case "body":
      return {
        fontSize: 36 * scale,
        fontWeight: 400,
        lineHeight: 1.4,
      };
    case "list_item":
      return {
        fontSize: 42 * scale,
        fontWeight: 500,
        lineHeight: 1.3,
      };
    case "numbered_step":
      return {
        fontSize: 42 * scale,
        fontWeight: 600,
        lineHeight: 1.3,
      };
    case "callout":
      return {
        fontSize: 48 * scale,
        fontWeight: 600,
        background: accent,
        color: "#ffffff",
        padding: "12px 24px",
        borderRadius: 16,
      };
    case "cta":
      return {
        fontSize: 36 * scale,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: accent,
      };
    case "footer":
      return {
        fontSize: 24 * scale,
        fontWeight: 400,
        opacity: 0.6,
      };
    case "quote":
      return {
        fontSize: 60 * scale,
        fontStyle: "italic",
        fontWeight: 400,
        lineHeight: 1.25,
      };
    case "label":
      return {
        fontSize: 24 * scale,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        opacity: 0.7,
      };
    default:
      return { fontSize: 32 };
  }
}

export const RENDER_DIMS = { width: CANVAS_W, height: CANVAS_H };
