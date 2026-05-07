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

  // Match any TTF URL in the CSS (not anchored to `src:`). Some font CSS
  // returns multi-format `src: url(...woff2) format(...), url(...ttf) format(...)`
  // declarations where the simpler regex anchored to `src:` would miss
  // the TTF buried after the woff2.
  const match = css.match(/(https?:\/\/[^\s)"]+\.ttf)/);
  if (!match) {
    throw new Error(
      `Couldn't find TTF in Google Fonts CSS for ${family} (weight ${weight}). CSS preview: ${css.slice(0, 200)}`,
    );
  }
  const fontResp = await fetch(match[1]);
  const buf = await fontResp.arrayBuffer();
  FONT_CACHE.set(key, buf);
  return buf;
}
