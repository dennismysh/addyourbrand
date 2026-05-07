import { NextResponse } from "next/server";
import { z } from "zod";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { BrandProfileSchema, DocumentStructureSchema } from "@/lib/types";
import type { FontDef } from "@/lib/types";
import { buildDesignJsx, RENDER_DIMS } from "@/lib/render-jsx";
import { fetchFont, fetchGoogleFont } from "@/lib/fonts";

// If the brand's font can't be fetched (e.g., a pixel font with weird CSS,
// or a Japanese font with multi-format declarations our regex misses), fall
// back to Inter. Better to render something with a generic typeface than to
// fail the entire export.
async function fetchFontOrFallback(
  font: FontDef,
  weight: number,
  text: string,
): Promise<ArrayBuffer> {
  try {
    return await fetchFont(font, weight, text);
  } catch (err) {
    console.warn(
      `[render] font fetch failed for ${font.family} weight ${weight}, falling back to Inter:`,
      err instanceof Error ? err.message : err,
    );
    return fetchGoogleFont("Inter", weight, text);
  }
}

export const runtime = "nodejs";
export const maxDuration = 60;

const RequestSchema = z.object({
  brand: BrandProfileSchema,
  doc: DocumentStructureSchema,
});

// Best-effort glyph collection: walk the document tree and join every visible
// text token. Subsetting the Google Font response to these glyphs only is
// a meaningful speedup for big pages.
function collectAllText(doc: import("@/lib/types").DocumentStructure): string {
  const parts: string[] = [doc.title];
  for (const b of doc.blocks) {
    switch (b.kind) {
      case "heading":
      case "body":
      case "callout":
      case "footer":
      case "sectionLabel":
        parts.push(b.text);
        break;
      case "list":
        parts.push(...b.items);
        break;
      case "table":
        if (b.columnHeaders) parts.push(...b.columnHeaders);
        for (const row of b.rows) parts.push(...row);
        break;
      case "quote":
        parts.push(b.text);
        if (b.attribution) parts.push(b.attribution);
        break;
      case "stat":
        parts.push(b.value, b.label);
        break;
      case "step":
        parts.push(b.title);
        if (b.body) parts.push(b.body);
        break;
      case "keyvalue":
        for (const p of b.pairs) parts.push(p.term, p.definition);
        break;
      case "checklist":
        parts.push(...b.checkItems.map((i) => i.text));
        break;
      case "comparison":
        parts.push(b.leftLabel, b.rightLabel);
        parts.push(...b.leftItems, ...b.rightItems);
        break;
      case "divider":
      case "logoSlot":
        break;
    }
  }
  return parts.join(" ");
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { brand, doc } = parsed.data;
  const allText = collectAllText(doc);

  try {
    const [headingRegular, headingBold, bodyRegular, bodyBold] =
      await Promise.all([
        fetchFontOrFallback(brand.fonts.heading, 400, allText),
        fetchFontOrFallback(brand.fonts.heading, 700, allText),
        fetchFontOrFallback(brand.fonts.body, 400, allText),
        fetchFontOrFallback(brand.fonts.body, 600, allText),
      ]);

    const tree = buildDesignJsx(brand, doc) as unknown as React.ReactElement;

    const svg = await satori(tree, {
      width: RENDER_DIMS.width,
      height: RENDER_DIMS.height,
      fonts: [
        { name: brand.fonts.heading.family, data: headingRegular, weight: 400, style: "normal" },
        { name: brand.fonts.heading.family, data: headingBold, weight: 700, style: "normal" },
        { name: brand.fonts.body.family, data: bodyRegular, weight: 400, style: "normal" },
        { name: brand.fonts.body.family, data: bodyBold, weight: 600, style: "normal" },
      ],
    });

    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: RENDER_DIMS.width },
    })
      .render()
      .asPng();

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${brand.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-design.png"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Render failed: ${message}` },
      { status: 500 },
    );
  }
}
