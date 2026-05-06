"use client";

import type { BrandProfile, TemplateAnalysis, TextRole } from "@/lib/types";

// Renders a TemplateAnalysis applied to a BrandProfile in a 2:3 canvas (1080×1620).
// The canvas itself is sized to whatever container we put it in; we use absolute
// positioning with normalized coordinates from the analyzer.
export function BrandRenderer({
  brand,
  analysis,
  width = 360,
}: {
  brand: BrandProfile;
  analysis: TemplateAnalysis;
  width?: number;
}) {
  const height = (width * 3) / 2;
  const headingFont = brand.fonts.heading.family;
  const bodyFont = brand.fonts.body.family;

  const bg = analysis.background.style === "gradient"
    ? `linear-gradient(135deg, ${brand.colors.primary}, ${brand.colors.accent ?? brand.colors.primary})`
    : brand.colors.background;

  return (
    <div
      style={{
        width,
        height,
        background: bg,
        color: brand.colors.foreground,
        position: "relative",
        overflow: "hidden",
        fontFamily: bodyFont,
        borderRadius: 12,
        boxShadow: "0 10px 40px -10px rgba(0,0,0,0.2)",
      }}
    >
      {analysis.blocks
        .filter((b) => b.role !== "decorative" && b.rewritten.trim().length > 0)
        .map((block, i) => {
          const styles = roleStyles(block.role, block.emphasis, brand);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${block.position.x * 100}%`,
                top: `${block.position.y * 100}%`,
                width: `${block.position.w * 100}%`,
                minHeight: `${block.position.h * 100}%`,
                fontFamily: isHeadingRole(block.role) ? headingFont : bodyFont,
                ...styles,
              }}
            >
              {block.role === "list_item" || block.role === "numbered_step" ? (
                <ListMarker
                  index={i}
                  numbered={block.role === "numbered_step"}
                  color={brand.colors.accent ?? brand.colors.primary}
                />
              ) : null}
              {block.rewritten}
            </div>
          );
        })}
    </div>
  );
}

function isHeadingRole(role: TextRole): boolean {
  return (
    role === "headline" ||
    role === "subheadline" ||
    role === "callout" ||
    role === "quote"
  );
}

function roleStyles(
  role: TextRole,
  emphasis: "primary" | "secondary" | "tertiary",
  brand: BrandProfile,
): React.CSSProperties {
  const accent = brand.colors.accent ?? brand.colors.primary;
  const sizeScale = emphasis === "primary" ? 1 : emphasis === "secondary" ? 0.7 : 0.5;

  switch (role) {
    case "headline":
      return {
        fontSize: `${28 * sizeScale}px`,
        fontWeight: 700,
        lineHeight: 1.05,
        letterSpacing: "-0.02em",
        color: brand.colors.primary,
      };
    case "subheadline":
      return {
        fontSize: `${18 * sizeScale}px`,
        fontWeight: 500,
        lineHeight: 1.2,
        color: brand.colors.foreground,
        opacity: 0.85,
      };
    case "body":
      return {
        fontSize: `${13 * sizeScale}px`,
        fontWeight: 400,
        lineHeight: 1.4,
      };
    case "list_item":
      return {
        fontSize: `${14 * sizeScale}px`,
        fontWeight: 500,
        lineHeight: 1.3,
        paddingLeft: 18,
      };
    case "numbered_step":
      return {
        fontSize: `${14 * sizeScale}px`,
        fontWeight: 600,
        lineHeight: 1.3,
        paddingLeft: 26,
      };
    case "callout":
      return {
        fontSize: `${16 * sizeScale}px`,
        fontWeight: 600,
        background: accent,
        color: "#fff",
        padding: "6px 10px",
        borderRadius: 6,
      };
    case "cta":
      return {
        fontSize: `${14 * sizeScale}px`,
        fontWeight: 700,
        textTransform: "uppercase" as const,
        letterSpacing: "0.08em",
        color: accent,
      };
    case "footer":
      return {
        fontSize: `${10 * sizeScale}px`,
        fontWeight: 400,
        opacity: 0.6,
      };
    case "quote":
      return {
        fontSize: `${20 * sizeScale}px`,
        fontStyle: "italic" as const,
        fontWeight: 400,
        lineHeight: 1.25,
      };
    case "label":
      return {
        fontSize: `${10 * sizeScale}px`,
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.12em",
        opacity: 0.7,
      };
    default:
      return { fontSize: 12 };
  }
}

function ListMarker({
  index,
  numbered,
  color,
}: {
  index: number;
  numbered: boolean;
  color: string;
}) {
  return (
    <span
      style={{
        position: "absolute",
        left: 0,
        color,
        fontWeight: 700,
      }}
    >
      {numbered ? `${index + 1}.` : "•"}
    </span>
  );
}
