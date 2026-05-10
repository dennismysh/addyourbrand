"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { BrandProfile } from "@/lib/types";
import { ArrowLeft, Loader2, Wand2 } from "lucide-react";

const KINDS = [
  "quote_marks_giant",
  "ornamental_frame",
  "corner_flourish",
  "divider_pattern",
  "background_pattern",
] as const;

type Kind = (typeof KINDS)[number];

interface BrandOption {
  id: string;
  name: string;
  profile: BrandProfile;
}

interface Result {
  kind: Kind;
  url: string;
  cache: string;
  ms: number;
}

export function MotifTestClient({ brands }: { brands: BrandOption[] }) {
  const [brandId, setBrandId] = useState(brands[0].id);
  const [styleHint, setStyleHint] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loadingKind, setLoadingKind] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const brand = brands.find((b) => b.id === brandId)?.profile;

  async function generate(kind: Kind) {
    if (!brand) return;
    setError(null);
    setLoadingKind(kind);
    const start = Date.now();
    try {
      const res = await fetch("/api/generate-motif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          brand,
          styleHint: styleHint.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const cache = res.headers.get("X-Motif-Cache") ?? "?";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const ms = Date.now() - start;
      setResults((prev) => [{ kind, url, cache, ms }, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoadingKind(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/brands">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <span className="font-serif text-lg font-semibold">addyourbrand</span>
        <div className="w-20" />
      </header>

      <h1 className="font-serif text-3xl font-semibold">Motif test bench</h1>
      <p className="mt-2 text-muted-foreground">
        Sandbox for the Gemini Flash 3.1 image-gen plumbing. Pick a brand, pick
        a motif kind, click generate. Each call hits{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          /api/generate-motif
        </code>{" "}
        and caches in Netlify Blobs by prompt hash.
      </p>

      <div className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <Label className="text-xs">Brand</Label>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label className="text-xs">
            Style hint (optional — overrides the default style derived from brand)
          </Label>
          <Textarea
            value={styleHint}
            onChange={(e) => setStyleHint(e.target.value)}
            placeholder="e.g. 'pixel arcade game UI element' or 'editorial fashion magazine ornament'"
            className="mt-1"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <Button
              key={k}
              variant="accent"
              size="sm"
              disabled={loadingKind !== null}
              onClick={() => generate(k)}
            >
              {loadingKind === k ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {k}
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" />
                  {k}
                </>
              )}
            </Button>
          ))}
        </div>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
      </div>

      {results.length === 0 ? null : (
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {results.map((r, i) => (
            <li
              key={i}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={r.url}
                alt={r.kind}
                className="aspect-square w-full bg-secondary object-contain"
              />
              <div className="p-3 text-xs">
                <p className="font-mono">{r.kind}</p>
                <p className="mt-1 text-muted-foreground">
                  {r.ms}ms · cache: {r.cache}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
