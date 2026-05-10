import type { Block, BrandProfile, DocumentStructure } from "./types";

// Satori-compatible JSX builder for preservation-mode rendering. Flow layout:
// blocks render top-to-bottom in document order, with per-kind styling that
// pulls from the brand's identity.
//
// Output dimensions: 1080×1620 (true 2:3). Same constants used by /api/render.

const CANVAS_W = 1080;
const CANVAS_H = 1620;
const PAGE_PADDING = 64;

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

// --- Per-block renderers ---------------------------------------------------

function renderHeading(block: Extract<Block, { kind: "heading" }>, s: BrandStyle): unknown {
  const sizes: Record<1 | 2 | 3, number> = { 1: 88, 2: 56, 3: 38 };
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        fontFamily: s.headingFont,
        fontSize: sizes[block.level],
        fontWeight: 700,
        color: s.primary,
        lineHeight: 1.05,
        letterSpacing: "-0.01em",
        marginBottom: 24,
        wordWrap: "break-word",
      },
      children: block.text,
    },
  };
}

function renderBody(block: Extract<Block, { kind: "body" }>, s: BrandStyle): unknown {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        fontFamily: s.bodyFont,
        fontSize: 28,
        fontWeight: 400,
        color: s.fgColor,
        lineHeight: 1.4,
        marginBottom: 18,
      },
      children: block.text,
    },
  };
}

function renderList(block: Extract<Block, { kind: "list" }>, s: BrandStyle): unknown {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        marginBottom: 24,
      },
      children: block.items.map((item, i) => ({
        type: "div",
        key: i,
        props: {
          style: {
            display: "flex",
            fontFamily: s.bodyFont,
            fontSize: 28,
            color: s.fgColor,
            lineHeight: 1.35,
            marginBottom: 10,
            gap: 14,
          },
          children: [
            {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  fontWeight: 700,
                  color: s.accent,
                  minWidth: block.ordered ? 48 : 24,
                },
                children: block.ordered ? `${i + 1}.` : "•",
              },
            },
            { type: "div", props: { style: { display: "flex", flex: 1 }, children: item } },
          ],
        },
      })),
    },
  };
}

function renderTable(block: Extract<Block, { kind: "table" }>, s: BrandStyle): unknown {
  const cols = block.columnHeaders?.length ?? block.rows[0]?.length ?? 1;
  const colPercent = `${100 / cols}%`;

  const headerRow = block.columnHeaders
    ? {
        type: "div",
        props: {
          style: {
            display: "flex",
            background: s.primary,
            color: s.bgColor,
            fontFamily: s.headingFont,
            fontWeight: 700,
            fontSize: 22,
            padding: "12px 0",
          },
          children: block.columnHeaders.map((h, i) => ({
            type: "div",
            key: i,
            props: {
              style: {
                display: "flex",
                width: colPercent,
                paddingLeft: 16,
                paddingRight: 16,
              },
              children: h,
            },
          })),
        },
      }
    : null;

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        marginBottom: 28,
        border: `2px solid ${s.primary}`,
      },
      children: [
        headerRow,
        ...block.rows.map((row, ri) => ({
          type: "div",
          key: ri,
          props: {
            style: {
              display: "flex",
              fontFamily: s.bodyFont,
              fontSize: 22,
              color: s.fgColor,
              borderTop: ri === 0 && headerRow ? "none" : `1px solid ${s.primary}`,
              minHeight: 50,
              padding: "10px 0",
            },
            children: row.map((cell, ci) => ({
              type: "div",
              key: ci,
              props: {
                style: {
                  display: "flex",
                  width: colPercent,
                  paddingLeft: 16,
                  paddingRight: 16,
                  borderLeft: ci === 0 ? "none" : `1px solid ${s.primary}`,
                },
                children: cell,
              },
            })),
          },
        })),
      ].filter(Boolean),
    },
  };
}

function renderQuote(block: Extract<Block, { kind: "quote" }>, s: BrandStyle): unknown {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        marginBottom: 28,
        paddingLeft: 24,
        borderLeft: `6px solid ${s.accent}`,
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontFamily: s.headingFont,
              fontSize: 38,
              fontStyle: "italic",
              color: s.primary,
              lineHeight: 1.25,
              marginBottom: 8,
            },
            children: `"${block.text}"`,
          },
        },
        block.attribution
          ? {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  fontFamily: s.bodyFont,
                  fontSize: 22,
                  color: s.fgColor,
                  opacity: 0.7,
                },
                children: `— ${block.attribution}`,
              },
            }
          : null,
      ].filter(Boolean),
    },
  };
}

function renderCallout(
  block: Extract<Block, { kind: "callout" }>,
  s: BrandStyle,
): unknown {
  // Tone-aware background: success/warn could pull additional brand colors;
  // for now use accent for everything except neutral.
  const bg = block.tone === "neutral" ? s.primary : s.accent;
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        background: bg,
        color: s.bgColor,
        fontFamily: s.bodyFont,
        fontSize: 26,
        fontWeight: 600,
        padding: "20px 28px",
        borderRadius: 14,
        marginBottom: 24,
        lineHeight: 1.3,
      },
      children: block.text,
    },
  };
}

function renderStat(block: Extract<Block, { kind: "stat" }>, s: BrandStyle): unknown {
  // Hero stats (emphasis=1) get the dramatic display treatment they deserve.
  // 320px lets a "85%" or "$10K" eat the page the way the source intended.
  const valueSize = block.emphasis === 1 ? 320 : block.emphasis === 2 ? 140 : 80;
  const labelSize = block.emphasis === 1 ? 44 : block.emphasis === 2 ? 28 : 22;
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: 28,
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontFamily: s.headingFont,
              fontSize: valueSize,
              fontWeight: 800,
              color: s.accent,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            },
            children: block.value,
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontFamily: s.bodyFont,
              fontSize: labelSize,
              color: s.fgColor,
              marginTop: 12,
              textAlign: "center" as const,
            },
            children: block.label,
          },
        },
      ],
    },
  };
}

function renderStep(block: Extract<Block, { kind: "step" }>, s: BrandStyle): unknown {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        gap: 20,
        marginBottom: 20,
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 48,
              height: 48,
              borderRadius: 24,
              background: s.accent,
              color: s.bgColor,
              fontFamily: s.headingFont,
              fontWeight: 700,
              fontSize: 24,
            },
            children: String(block.index),
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              flex: 1,
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontFamily: s.headingFont,
                    fontSize: 30,
                    fontWeight: 700,
                    color: s.primary,
                    marginBottom: 4,
                  },
                  children: block.title,
                },
              },
              block.body
                ? {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        fontFamily: s.bodyFont,
                        fontSize: 24,
                        color: s.fgColor,
                        opacity: 0.85,
                        lineHeight: 1.35,
                      },
                      children: block.body,
                    },
                  }
                : null,
            ].filter(Boolean),
          },
        },
      ],
    },
  };
}

function renderKeyValue(
  block: Extract<Block, { kind: "keyvalue" }>,
  s: BrandStyle,
): unknown {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        marginBottom: 24,
        gap: 14,
      },
      children: block.pairs.map((pair, i) => ({
        type: "div",
        key: i,
        props: {
          style: { display: "flex", flexDirection: "column", gap: 4 },
          children: [
            {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  fontFamily: s.headingFont,
                  fontSize: 26,
                  fontWeight: 700,
                  color: s.accent,
                },
                children: pair.term,
              },
            },
            {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  fontFamily: s.bodyFont,
                  fontSize: 24,
                  color: s.fgColor,
                  lineHeight: 1.35,
                },
                children: pair.definition,
              },
            },
          ],
        },
      })),
    },
  };
}

function renderChecklist(
  block: Extract<Block, { kind: "checklist" }>,
  s: BrandStyle,
): unknown {
  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", marginBottom: 24 },
      children: block.checkItems.map((item, i) => ({
        type: "div",
        key: i,
        props: {
          style: {
            display: "flex",
            gap: 14,
            fontFamily: s.bodyFont,
            fontSize: 26,
            color: s.fgColor,
            marginBottom: 10,
            opacity: item.checked ? 0.6 : 1,
            textDecoration: item.checked ? "line-through" : "none",
          },
          children: [
            {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  border: `3px solid ${s.accent}`,
                  borderRadius: 4,
                  color: s.accent,
                  fontWeight: 800,
                  fontSize: 22,
                },
                children: item.checked ? "✓" : "",
              },
            },
            { type: "div", props: { style: { display: "flex", flex: 1 }, children: item.text } },
          ],
        },
      })),
    },
  };
}

function renderComparison(
  block: Extract<Block, { kind: "comparison" }>,
  s: BrandStyle,
): unknown {
  const column = (label: string, items: string[], color: string) => ({
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        flex: 1,
        padding: 24,
        background: s.bgColor,
        border: `3px solid ${color}`,
        borderRadius: 12,
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontFamily: s.headingFont,
              fontWeight: 700,
              fontSize: 28,
              color,
              marginBottom: 14,
              textTransform: "uppercase" as const,
              letterSpacing: "0.08em",
            },
            children: label,
          },
        },
        ...items.map((it, i) => ({
          type: "div",
          key: i,
          props: {
            style: {
              display: "flex",
              fontFamily: s.bodyFont,
              fontSize: 24,
              color: s.fgColor,
              lineHeight: 1.3,
              marginBottom: 8,
            },
            children: it,
          },
        })),
      ],
    },
  });
  return {
    type: "div",
    props: {
      style: { display: "flex", gap: 18, marginBottom: 24 },
      children: [
        column(block.leftLabel, block.leftItems, s.primary),
        column(block.rightLabel, block.rightItems, s.accent),
      ],
    },
  };
}

function renderSectionLabel(
  block: Extract<Block, { kind: "sectionLabel" }>,
  s: BrandStyle,
): unknown {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        fontFamily: s.headingFont,
        fontSize: 18,
        fontWeight: 700,
        color: s.accent,
        textTransform: "uppercase",
        letterSpacing: "0.18em",
        marginTop: 12,
        marginBottom: 14,
      },
      children: block.text,
    },
  };
}

function renderDivider(s: BrandStyle): unknown {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        height: 2,
        background: s.accent,
        opacity: 0.4,
        marginTop: 18,
        marginBottom: 24,
      },
      children: "",
    },
  };
}

function renderFooter(
  block: Extract<Block, { kind: "footer" }>,
  s: BrandStyle,
): unknown {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        fontFamily: s.bodyFont,
        fontSize: 18,
        color: s.fgColor,
        opacity: 0.55,
        marginTop: 28,
      },
      children: block.text,
    },
  };
}

function renderBlock(block: Block, s: BrandStyle): unknown {
  switch (block.kind) {
    case "heading":
      return renderHeading(block, s);
    case "body":
      return renderBody(block, s);
    case "list":
      return renderList(block, s);
    case "table":
      return renderTable(block, s);
    case "quote":
      return renderQuote(block, s);
    case "callout":
      return renderCallout(block, s);
    case "stat":
      return renderStat(block, s);
    case "step":
      return renderStep(block, s);
    case "keyvalue":
      return renderKeyValue(block, s);
    case "checklist":
      return renderChecklist(block, s);
    case "comparison":
      return renderComparison(block, s);
    case "sectionLabel":
      return renderSectionLabel(block, s);
    case "divider":
      return renderDivider(s);
    case "footer":
      return renderFooter(block, s);
  }
}

// Compute the absolute-positioning style for a motif image given the
// document's chosen placement. Returns a style object the caller spreads onto
// the motif's position-absolute wrapper.
function motifPositionStyle(
  placement: import("./types").MotifPlacement,
): Record<string, string | number> {
  const cornerSize = 380; // px — large enough to read at 1080×1620
  const base = {
    position: "absolute" as const,
    display: "flex",
    pointerEvents: "none" as const,
  };
  switch (placement) {
    case "behind":
      // Full canvas backdrop. Stretch to canvas dims behind everything.
      return { ...base, left: 0, top: 0, width: CANVAS_W, height: CANVAS_H, opacity: 0.18 };
    case "frame":
      // Full canvas border element — same dims, rendered as overlay (frame
      // motif itself has transparent center).
      return { ...base, left: 0, top: 0, width: CANVAS_W, height: CANVAS_H };
    case "topLeft":
      return { ...base, left: 0, top: 0, width: cornerSize, height: cornerSize };
    case "topRight":
      return { ...base, right: 0, top: 0, width: cornerSize, height: cornerSize };
    case "bottomLeft":
      return { ...base, left: 0, bottom: 0, width: cornerSize, height: cornerSize };
    case "bottomRight":
      return { ...base, right: 0, bottom: 0, width: cornerSize, height: cornerSize };
  }
}

export function buildDesignJsx(
  brand: BrandProfile,
  doc: DocumentStructure,
  // Optional pre-fetched motif PNG bytes. The render route fetches these
  // server-side and passes them in so Satori can embed via data URL.
  motifBytes?: Uint8Array,
) {
  const s = brandStyle(brand);
  const isCentered = doc.layout === "centered";

  // Build the inner content stack (everything except the motif).
  const contentStack = {
    type: "div",
    props: {
      style: {
        position: "relative" as const,
        display: "flex",
        flexDirection: "column" as const,
        flex: 1,
        width: "100%",
        padding: PAGE_PADDING,
        justifyContent: "center" as const,
        alignItems: isCentered ? "center" : "stretch",
        textAlign: isCentered ? ("center" as const) : ("left" as const),
      },
      children: doc.blocks.map((block, i) => ({
        ...(renderBlock(block, s) as Record<string, unknown>),
        key: i,
      })),
    },
  };

  // If we have a motif + bytes, layer it absolutely beneath/around the content.
  const children: unknown[] = [];
  if (doc.motif && motifBytes) {
    const dataUrl = `data:image/png;base64,${Buffer.from(motifBytes).toString("base64")}`;
    children.push({
      type: "div",
      props: {
        style: motifPositionStyle(doc.motif.placement),
        children: {
          type: "img",
          props: {
            src: dataUrl,
            width: "100%" as const,
            height: "100%" as const,
            style: {
              objectFit: "contain" as const,
            },
          },
        },
      },
    });
  }
  children.push(contentStack);

  return {
    type: "div",
    props: {
      style: {
        position: "relative" as const,
        width: CANVAS_W,
        height: CANVAS_H,
        background: s.bgColor,
        color: s.fgColor,
        display: "flex",
        flexDirection: "column" as const,
        fontFamily: s.bodyFont,
        overflow: "hidden" as const,
      },
      children,
    },
  };
}

export const RENDER_DIMS = { width: CANVAS_W, height: CANVAS_H };
