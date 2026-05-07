"use client";

import { useEffect } from "react";
import type { Block, BrandProfile, DocumentStructure } from "@/lib/types";

// In-browser preview of a DocumentStructure rendered in a brand's identity.
// Same block schema as the Satori PNG renderer (lib/render-jsx.ts), so what
// the user sees here matches what they download. Sizes are scaled down — the
// preview frame is 360px wide, the export is 1080px wide (3×).

const SCALE = 360 / 1080; // preview width vs render canvas width

function scale(px: number): number {
  return Math.round(px * SCALE);
}

interface BrandStyle {
  bgColor: string;
  fgColor: string;
  primary: string;
  accent: string;
  headingFont: string;
  bodyFont: string;
}

function brandStyle(brand: BrandProfile): BrandStyle {
  return {
    bgColor: brand.colors.background,
    fgColor: brand.colors.foreground,
    primary: brand.colors.primary,
    accent: brand.colors.accent ?? brand.colors.primary,
    headingFont: brand.fonts.heading.family,
    bodyFont: brand.fonts.body.family,
  };
}

// Dynamically inject a Google Fonts <link> tag for the brand's typefaces so
// the preview actually uses them (otherwise the browser falls back to system
// serif). Server-side PNG export already fetches font bytes via fetchFont
// and embeds them into the PDF/PNG — this hook just brings the in-browser
// preview into agreement with the exported result.
function useBrandFontLink(headingFamily: string, bodyFamily: string) {
  useEffect(() => {
    if (!headingFamily && !bodyFamily) return;
    const familyParam = (name: string) =>
      `family=${encodeURIComponent(name).replace(/%20/g, "+")}`;
    const families = [headingFamily, bodyFamily]
      .filter(Boolean)
      .map(familyParam)
      .join("&");
    const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;

    // Reuse a single <link> per BrandRenderer instance.
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [headingFamily, bodyFamily]);
}

export function BrandRenderer({
  brand,
  doc,
  width = 360,
}: {
  brand: BrandProfile;
  doc: DocumentStructure;
  width?: number;
}) {
  useBrandFontLink(brand.fonts.heading.family, brand.fonts.body.family);
  const height = (width * 3) / 2;
  const s = brandStyle(brand);
  const padding = scale(64);
  const isCentered = doc.layout === "centered";

  return (
    <div
      style={{
        width,
        height,
        background: s.bgColor,
        color: s.fgColor,
        padding,
        display: "flex",
        flexDirection: "column",
        alignItems: isCentered ? "center" : "stretch",
        justifyContent: isCentered ? "center" : "flex-start",
        textAlign: isCentered ? "center" : "left",
        fontFamily: s.bodyFont,
        borderRadius: 12,
        boxShadow: "0 10px 40px -10px rgba(0,0,0,0.2)",
        overflow: "hidden",
      }}
    >
      {doc.blocks.map((block, i) => (
        <RenderBlock key={i} block={block} s={s} />
      ))}
    </div>
  );
}

function RenderBlock({ block, s }: { block: Block; s: BrandStyle }) {
  switch (block.kind) {
    case "heading":
      return <Heading block={block} s={s} />;
    case "body":
      return <Body block={block} s={s} />;
    case "list":
      return <List block={block} s={s} />;
    case "table":
      return <Table block={block} s={s} />;
    case "quote":
      return <Quote block={block} s={s} />;
    case "callout":
      return <Callout block={block} s={s} />;
    case "stat":
      return <Stat block={block} s={s} />;
    case "step":
      return <Step block={block} s={s} />;
    case "keyvalue":
      return <KeyValue block={block} s={s} />;
    case "checklist":
      return <Checklist block={block} s={s} />;
    case "comparison":
      return <Comparison block={block} s={s} />;
    case "sectionLabel":
      return <SectionLabel block={block} s={s} />;
    case "divider":
      return <Divider s={s} />;
    case "footer":
      return <Footer block={block} s={s} />;
    case "logoSlot":
      return null; // logos not yet wired
  }
}

function Heading({
  block,
  s,
}: {
  block: Extract<Block, { kind: "heading" }>;
  s: BrandStyle;
}) {
  const sizes: Record<1 | 2 | 3, number> = { 1: 88, 2: 56, 3: 38 };
  return (
    <div
      style={{
        fontFamily: s.headingFont,
        fontSize: scale(sizes[block.level]),
        fontWeight: 700,
        color: s.primary,
        lineHeight: 1.05,
        letterSpacing: "-0.01em",
        marginBottom: scale(24),
      }}
    >
      {block.text}
    </div>
  );
}

function Body({
  block,
  s,
}: {
  block: Extract<Block, { kind: "body" }>;
  s: BrandStyle;
}) {
  return (
    <div
      style={{
        fontFamily: s.bodyFont,
        fontSize: scale(28),
        color: s.fgColor,
        lineHeight: 1.4,
        marginBottom: scale(18),
      }}
    >
      {block.text}
    </div>
  );
}

function List({
  block,
  s,
}: {
  block: Extract<Block, { kind: "list" }>;
  s: BrandStyle;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: scale(24) }}>
      {block.items.map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            fontFamily: s.bodyFont,
            fontSize: scale(28),
            color: s.fgColor,
            lineHeight: 1.35,
            marginBottom: scale(10),
            gap: scale(14),
          }}
        >
          <span
            style={{
              fontWeight: 700,
              color: s.accent,
              minWidth: scale(block.ordered ? 48 : 24),
            }}
          >
            {block.ordered ? `${i + 1}.` : "•"}
          </span>
          <span style={{ flex: 1 }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

function Table({
  block,
  s,
}: {
  block: Extract<Block, { kind: "table" }>;
  s: BrandStyle;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        marginBottom: scale(28),
        border: `${scale(2)}px solid ${s.primary}`,
      }}
    >
      {block.columnHeaders ? (
        <div
          style={{
            display: "flex",
            background: s.primary,
            color: s.bgColor,
            fontFamily: s.headingFont,
            fontWeight: 700,
            fontSize: scale(22),
            padding: `${scale(12)}px 0`,
          }}
        >
          {block.columnHeaders.map((h, i) => (
            <div key={i} style={{ flex: 1, paddingLeft: scale(16), paddingRight: scale(16) }}>
              {h}
            </div>
          ))}
        </div>
      ) : null}
      {block.rows.map((row, ri) => (
        <div
          key={ri}
          style={{
            display: "flex",
            fontFamily: s.bodyFont,
            fontSize: scale(22),
            color: s.fgColor,
            borderTop:
              ri === 0 && block.columnHeaders ? "none" : `${scale(1)}px solid ${s.primary}`,
            padding: `${scale(10)}px 0`,
          }}
        >
          {row.map((cell, ci) => (
            <div
              key={ci}
              style={{
                flex: 1,
                paddingLeft: scale(16),
                paddingRight: scale(16),
                borderLeft: ci === 0 ? "none" : `${scale(1)}px solid ${s.primary}`,
              }}
            >
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Quote({
  block,
  s,
}: {
  block: Extract<Block, { kind: "quote" }>;
  s: BrandStyle;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        marginBottom: scale(28),
        paddingLeft: scale(24),
        borderLeft: `${scale(6)}px solid ${s.accent}`,
      }}
    >
      <div
        style={{
          fontFamily: s.headingFont,
          fontSize: scale(38),
          fontStyle: "italic",
          color: s.primary,
          lineHeight: 1.25,
          marginBottom: scale(8),
        }}
      >
        &ldquo;{block.text}&rdquo;
      </div>
      {block.attribution ? (
        <div
          style={{
            fontFamily: s.bodyFont,
            fontSize: scale(22),
            color: s.fgColor,
            opacity: 0.7,
          }}
        >
          — {block.attribution}
        </div>
      ) : null}
    </div>
  );
}

function Callout({
  block,
  s,
}: {
  block: Extract<Block, { kind: "callout" }>;
  s: BrandStyle;
}) {
  const bg = block.tone === "neutral" ? s.primary : s.accent;
  return (
    <div
      style={{
        background: bg,
        color: s.bgColor,
        fontFamily: s.bodyFont,
        fontSize: scale(26),
        fontWeight: 600,
        padding: `${scale(20)}px ${scale(28)}px`,
        borderRadius: scale(14),
        marginBottom: scale(24),
        lineHeight: 1.3,
      }}
    >
      {block.text}
    </div>
  );
}

function Stat({
  block,
  s,
}: {
  block: Extract<Block, { kind: "stat" }>;
  s: BrandStyle;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: scale(28),
      }}
    >
      <div
        style={{
          fontFamily: s.headingFont,
          fontSize: scale(140),
          fontWeight: 800,
          color: s.accent,
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {block.value}
      </div>
      <div
        style={{
          fontFamily: s.bodyFont,
          fontSize: scale(28),
          color: s.fgColor,
          marginTop: scale(8),
        }}
      >
        {block.label}
      </div>
    </div>
  );
}

function Step({
  block,
  s,
}: {
  block: Extract<Block, { kind: "step" }>;
  s: BrandStyle;
}) {
  return (
    <div style={{ display: "flex", gap: scale(20), marginBottom: scale(20) }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: scale(48),
          height: scale(48),
          borderRadius: scale(24),
          background: s.accent,
          color: s.bgColor,
          fontFamily: s.headingFont,
          fontWeight: 700,
          fontSize: scale(24),
        }}
      >
        {block.index}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div
          style={{
            fontFamily: s.headingFont,
            fontSize: scale(30),
            fontWeight: 700,
            color: s.primary,
            marginBottom: scale(4),
          }}
        >
          {block.title}
        </div>
        {block.body ? (
          <div
            style={{
              fontFamily: s.bodyFont,
              fontSize: scale(24),
              color: s.fgColor,
              opacity: 0.85,
              lineHeight: 1.35,
            }}
          >
            {block.body}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function KeyValue({
  block,
  s,
}: {
  block: Extract<Block, { kind: "keyvalue" }>;
  s: BrandStyle;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        marginBottom: scale(24),
        gap: scale(14),
      }}
    >
      {block.pairs.map((pair, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: scale(4) }}>
          <div
            style={{
              fontFamily: s.headingFont,
              fontSize: scale(26),
              fontWeight: 700,
              color: s.accent,
            }}
          >
            {pair.term}
          </div>
          <div
            style={{
              fontFamily: s.bodyFont,
              fontSize: scale(24),
              color: s.fgColor,
              lineHeight: 1.35,
            }}
          >
            {pair.definition}
          </div>
        </div>
      ))}
    </div>
  );
}

function Checklist({
  block,
  s,
}: {
  block: Extract<Block, { kind: "checklist" }>;
  s: BrandStyle;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: scale(24) }}>
      {block.checkItems.map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: scale(14),
            fontFamily: s.bodyFont,
            fontSize: scale(26),
            color: s.fgColor,
            marginBottom: scale(10),
            opacity: item.checked ? 0.6 : 1,
            textDecoration: item.checked ? "line-through" : "none",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: scale(28),
              height: scale(28),
              border: `${scale(3)}px solid ${s.accent}`,
              borderRadius: scale(4),
              color: s.accent,
              fontWeight: 800,
              fontSize: scale(22),
            }}
          >
            {item.checked ? "✓" : ""}
          </span>
          <span style={{ flex: 1 }}>{item.text}</span>
        </div>
      ))}
    </div>
  );
}

function Comparison({
  block,
  s,
}: {
  block: Extract<Block, { kind: "comparison" }>;
  s: BrandStyle;
}) {
  const Column = ({
    label,
    items,
    color,
  }: {
    label: string;
    items: string[];
    color: string;
  }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        padding: scale(24),
        background: s.bgColor,
        border: `${scale(3)}px solid ${color}`,
        borderRadius: scale(12),
      }}
    >
      <div
        style={{
          fontFamily: s.headingFont,
          fontWeight: 700,
          fontSize: scale(28),
          color,
          marginBottom: scale(14),
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            fontFamily: s.bodyFont,
            fontSize: scale(24),
            color: s.fgColor,
            lineHeight: 1.3,
            marginBottom: scale(8),
          }}
        >
          {it}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: "flex", gap: scale(18), marginBottom: scale(24) }}>
      <Column label={block.leftLabel} items={block.leftItems} color={s.primary} />
      <Column label={block.rightLabel} items={block.rightItems} color={s.accent} />
    </div>
  );
}

function SectionLabel({
  block,
  s,
}: {
  block: Extract<Block, { kind: "sectionLabel" }>;
  s: BrandStyle;
}) {
  return (
    <div
      style={{
        fontFamily: s.headingFont,
        fontSize: scale(18),
        fontWeight: 700,
        color: s.accent,
        textTransform: "uppercase",
        letterSpacing: "0.18em",
        marginTop: scale(12),
        marginBottom: scale(14),
      }}
    >
      {block.text}
    </div>
  );
}

function Divider({ s }: { s: BrandStyle }) {
  return (
    <div
      style={{
        height: scale(2),
        background: s.accent,
        opacity: 0.4,
        marginTop: scale(18),
        marginBottom: scale(24),
      }}
    />
  );
}

function Footer({
  block,
  s,
}: {
  block: Extract<Block, { kind: "footer" }>;
  s: BrandStyle;
}) {
  return (
    <div
      style={{
        fontFamily: s.bodyFont,
        fontSize: scale(18),
        color: s.fgColor,
        opacity: 0.55,
        marginTop: scale(28),
      }}
    >
      {block.text}
    </div>
  );
}
