import { eq, and } from "drizzle-orm";
import { getDb, schema } from "./db";
import { brandAssetsStore } from "./blobs";
import type { FontDef } from "./types";

const FONT_CACHE = new Map<string, ArrayBuffer>();

export async function fetchFont(
  font: FontDef,
  weight: number,
  text?: string,
  brandId?: string,
): Promise<ArrayBuffer> {
  if (font.source === "asset" && font.assetId) {
    return fetchUploadedFont(font.assetId, brandId);
  }
  return fetchGoogleFont(font.family, weight, text);
}

async function fetchUploadedFont(
  assetId: string,
  brandId?: string,
): Promise<ArrayBuffer> {
  const cacheKey = `asset:${assetId}`;
  const cached = FONT_CACHE.get(cacheKey);
  if (cached) return cached;

  const db = getDb();
  const where = brandId
    ? and(eq(schema.assets.id, assetId), eq(schema.assets.brandId, brandId))
    : eq(schema.assets.id, assetId);
  const [row] = await db
    .select({ blobKey: schema.assets.blobKey })
    .from(schema.assets)
    .where(where)
    .limit(1);
  if (!row) throw new Error(`Font asset ${assetId} not found`);

  const buf = await brandAssetsStore().get(row.blobKey, { type: "arrayBuffer" });
  if (!buf) throw new Error(`Font asset ${assetId} blob missing`);
  FONT_CACHE.set(cacheKey, buf);
  return buf;
}

export async function fetchGoogleFont(
  family: string,
  weight: number = 400,
  text?: string,
): Promise<ArrayBuffer> {
  // Try the requested weight first, fall back to 400 if unavailable. Pixel
  // fonts like "Press Start 2P" only ship weight 400 — asking for 700
  // would otherwise crash the render with no useful error.
  try {
    return await fetchGoogleFontInner(family, weight, text);
  } catch (err) {
    if (weight === 400) throw err;
    return fetchGoogleFontInner(family, 400, text);
  }
}

async function fetchGoogleFontInner(
  family: string,
  weight: number,
  text?: string,
): Promise<ArrayBuffer> {
  const key = `google:${family}|${weight}|${text ?? ""}`;
  const cached = FONT_CACHE.get(key);
  if (cached) return cached;

  // Hit the Google Fonts CSS API, parse out the TTF URL, fetch the font.
  // The `text=` parameter narrows the served subset — a big speedup when
  // we only need the actual rendered glyphs.
  const cssUrl = new URL("https://fonts.googleapis.com/css2");
  cssUrl.searchParams.set("family", `${family}:wght@${weight}`);
  if (text) cssUrl.searchParams.set("text", text);

  const cssResp = await fetch(cssUrl.toString(), {
    headers: {
      // Older UAs typically get TTF served. Some fonts (especially with
      // many unicode-range subsets) still come back as multi-format.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.30 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1",
    },
  });
  if (!cssResp.ok) {
    throw new Error(
      `Failed to load Google Font CSS for ${family} (weight ${weight})`,
    );
  }
  const css = await cssResp.text();

  // Pick a URL out of the CSS. Google's response varies:
  //  - Static fonts (no `text=`): src: url(.../HASH.ttf) format('truetype')
  //  - Subsetted fonts (with `text=`): src: url(.../l/font?kit=HASH) format('truetype')
  //  - Multi-format Asian fonts: woff2 first, ttf later in the same src
  //
  // Strategy: collect every url(...) in the CSS, prefer one that obviously
  // ends in .ttf, then fall back to the subset URL pattern, then the first
  // URL period. Old-UA requests return TTF bytes from /l/font?kit= URLs
  // even though the URL has no extension, so passing those to Satori works.
  const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) =>
    m[1].replace(/^['"]|['"]$/g, ""),
  );
  const ttfUrl = urls.find((u) => /\.ttf(\?|$)/.test(u));
  const subsetUrl = urls.find((u) => u.includes("/l/font"));
  const url = ttfUrl ?? subsetUrl ?? urls[0];
  if (!url) {
    throw new Error(
      `No font URL found in Google Fonts CSS for ${family} (weight ${weight}). CSS preview: ${css.slice(0, 200)}`,
    );
  }
  const fontResp = await fetch(url);
  if (!fontResp.ok) {
    throw new Error(
      `Failed to download font bytes for ${family} (weight ${weight}) at ${url}`,
    );
  }
  const buf = await fontResp.arrayBuffer();
  FONT_CACHE.set(key, buf);
  return buf;
}
