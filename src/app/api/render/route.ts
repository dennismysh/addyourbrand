import { NextResponse } from "next/server";
import { z } from "zod";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { BrandProfileSchema, TemplateAnalysisSchema } from "@/lib/types";
import { buildDesignJsx, RENDER_DIMS } from "@/lib/render-jsx";
import { fetchFont } from "@/lib/fonts";

export const runtime = "nodejs";
export const maxDuration = 60;

const RequestSchema = z.object({
  brand: BrandProfileSchema,
  analysis: TemplateAnalysisSchema,
});

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

  const { brand, analysis } = parsed.data;
  const headingFamily = brand.fonts.heading.family;
  const bodyFamily = brand.fonts.body.family;

  // Pull every glyph that actually appears so the Google Fonts subset is small.
  const allText = analysis.blocks.map((b) => b.rewritten).join(" ");

  try {
    // For asset-sourced fonts, weight requests don't really apply — there's
    // one TTF and Satori uses it for whatever weight it gets asked for. For
    // Google-sourced fonts, fetchFont still pulls separate weights so bold
    // looks bold. The result is registered under the same family name twice,
    // which Satori uses to pick the appropriate one.
    const [headingRegular, headingBold, bodyRegular, bodyBold] = await Promise.all([
      fetchFont(brand.fonts.heading, 400, allText),
      fetchFont(brand.fonts.heading, 700, allText),
      fetchFont(brand.fonts.body, 400, allText),
      fetchFont(brand.fonts.body, 600, allText),
    ]);

    const tree = buildDesignJsx(brand, analysis) as unknown as React.ReactElement;

    const svg = await satori(tree, {
      width: RENDER_DIMS.width,
      height: RENDER_DIMS.height,
      fonts: [
        { name: headingFamily, data: headingRegular, weight: 400, style: "normal" },
        { name: headingFamily, data: headingBold, weight: 700, style: "normal" },
        { name: bodyFamily, data: bodyRegular, weight: 400, style: "normal" },
        { name: bodyFamily, data: bodyBold, weight: 600, style: "normal" },
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
