# addyourbrand

Drop in any Pinterest-style template, get back a 2:3 design rebranded with your fonts, colors, and voice — ready to import into Canva.

## Stack

- **Next.js 16** (App Router, Turbopack) on **Netlify**
- **Claude Opus 4.7** via Netlify AI Gateway — vision analysis + brand-voice rewriting (adaptive thinking, `xhigh` effort, structured outputs, prompt caching)
- **Auth.js v5** with Google OAuth + Drizzle adapter
- **Drizzle ORM** + **Netlify DB** (Neon Postgres) for accounts, brands, designs
- **Netlify Blobs** for asset storage (logos, fonts, references)
- **Satori + resvg-js** for HTML/JSX → PNG export at exact 1080×1620

## Local development

```sh
cp .env.example .env.local
# Fill in:
#   AUTH_SECRET           — npx auth secret
#   AUTH_GOOGLE_ID        — from Google Cloud Console OAuth client
#   AUTH_GOOGLE_SECRET    — same
#   ANTHROPIC_API_KEY     — for local dev; in prod, Netlify AI Gateway injects it

npm install
netlify dev                    # spins up embedded Postgres + applies migrations + starts Next.js
```

## Database workflow (Netlify Database)

This project uses Netlify's managed Postgres. The flow:

- **Schema lives in `db/schema.ts`** (Drizzle). Edit there.
- **Migrations live in `netlify/database/migrations/`**. Generate with `npx drizzle-kit generate --name <change>` after editing the schema.
- **Apply locally** by running `netlify dev` — the embedded Postgres applies pending migrations on start.
- **Apply in production** automatically on deploy. Each preview gets its own Postgres branch forked from prod.

## Deploying to Netlify

1. **Enable AI Gateway** in site settings — `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` get auto-injected.
2. **Set env vars** in Netlify: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_TRUST_HOST=true`.
3. Add `<your-site>/api/auth/callback/google` to the Google OAuth client's authorized redirect URIs.
4. Push to `main`. Netlify builds, applies migrations, deploys.

## How it works

1. **Brand library** (`/brands`) — name, colors, fonts (Google Fonts by name), voice samples, signature formulas, brand facts, **brand assets** (logos, fonts, reference imagery, brand-guide PDFs). Persisted per-user in Postgres; asset bytes live in Netlify Blobs.
   - **Auto-fill from PDF**: drop in a brand-guide PDF and Claude Opus 4.7 extracts colors, fonts, voice samples, formulas, and brand facts in one shot.
2. **Tool** (`/app`) — pick a brand, drop a template image, hit "Rebrand."
3. **Analyze** (`/api/analyze`) — Claude Opus 4.7 vision call. The system prompt + brand context are prefix-cached so repeat analyses for the same brand are cheap. Returns a `TemplateAnalysis` JSON: layout archetype, mood, every text block with role + verbatim original + brand-voice rewrite + normalized 0–1 position.
4. **Render** (`/api/render`) — Satori turns the analysis into JSX-styled SVG using the brand's Google Fonts (subset to actually-rendered glyphs); resvg-js converts to PNG at 1080×1620.
5. **Export** — download the PNG and import into Canva as a background or layered design.

## Project layout

```
src/
  app/
    page.tsx                    # landing
    signin/                     # Google OAuth entry
    brands/                     # brand library (CRUD)
    app/                        # the tool (server shell + client island)
    api/
      analyze/                  # Claude Opus 4.7 vision analysis
      render/                   # Satori → PNG
      auth/[...nextauth]/       # Auth.js handlers
  auth.ts                       # Auth.js v5 config
  proxy.ts                      # route protection
  components/
    brand-form.tsx              # shared CRUD form
    brand-renderer.tsx          # in-browser preview
    ui/                         # shadcn-style primitives
  lib/
    anthropic.ts                # SDK client (auto-uses Netlify AI Gateway env)
    analyzer.ts                 # the system prompt + Claude call
    render-jsx.ts               # Satori-compatible JSX builder
    fonts.ts                    # runtime Google Fonts fetcher
    types.ts                    # BrandProfile + TemplateAnalysis schemas
    db/                         # @netlify/database adapter wired to Drizzle
    blobs.ts                    # Netlify Blobs stores
db/
  schema.ts                     # Drizzle schema (Auth.js + domain tables)
netlify/database/migrations/    # generated SQL migrations (committed)
```
