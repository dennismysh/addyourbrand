"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BrandRenderer } from "@/components/brand-renderer";
import type { BrandProfile, DocumentStructure } from "@/lib/types";
import { Loader2, Upload, ArrowLeft, Wand2, Download } from "lucide-react";

type SupportedMime = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

type AvailableBrand = { id: string; name: string; profile: BrandProfile };

function isSupported(mime: string): mime is SupportedMime {
  return ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime);
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function AppClient({
  availableBrands,
  initialBrandId,
}: {
  availableBrands: AvailableBrand[];
  initialBrandId: string;
}) {
  const initial =
    availableBrands.find((b) => b.id === initialBrandId) ?? availableBrands[0];
  const [selectedBrandId, setSelectedBrandId] = useState(initial.id);
  // Local-edit copy of the brand. Saved brands stay untouched in the library;
  // the user can tweak any field here for a single render without persisting.
  const [brand, setBrand] = useState<BrandProfile>(initial.profile);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<SupportedMime | null>(null);
  const [doc, setDoc] = useState<DocumentStructure | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickBrand(id: string) {
    const found = availableBrands.find((b) => b.id === id);
    if (!found) return;
    setSelectedBrandId(id);
    setBrand(found.profile);
    // Brand change doesn't invalidate the document — same content, new skin.
    // The renderer just re-styles whatever's in `doc` with the new brand.
  }

  async function handleFile(file: File) {
    if (!isSupported(file.type)) {
      setError(`Unsupported file type: ${file.type}. Use PNG, JPEG, WebP, or GIF.`);
      return;
    }
    setError(null);
    setDoc(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    const b64 = await fileToBase64(file);
    setImageBase64(b64);
    setImageMime(file.type);
  }

  async function runAnalysis() {
    if (!imageBase64 || !imageMime) return;
    setLoading(true);
    setError(null);
    try {
      const enqueueRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          imageMediaType: imageMime,
        }),
      });
      const enqueueData = await enqueueRes.json();
      if (!enqueueRes.ok) {
        throw new Error(enqueueData.error ?? "Failed to enqueue analysis");
      }
      const jobId: string = enqueueData.jobId;

      // Poll up to ~3 min total at 2s intervals. Preservation-mode extraction
      // is faster than the old transmute-mode (no rewrite step) — typically
      // 20-60s.
      const start = Date.now();
      const TIMEOUT_MS = 3 * 60_000;
      const POLL_MS = 2_000;

      while (true) {
        if (Date.now() - start > TIMEOUT_MS) {
          throw new Error(
            "Timed out waiting for analysis. The job is still running in the background — try refreshing in a minute.",
          );
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
        const statusRes = await fetch(`/api/analyze/${jobId}`);
        if (!statusRes.ok) {
          throw new Error("Failed to check job status");
        }
        const status = await statusRes.json();
        if (status.status === "done") {
          setDoc(status.result);
          return;
        }
        if (status.status === "error") {
          throw new Error(status.error ?? "Analysis failed");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function download(format: "png" | "pdf") {
    if (!doc) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, doc, format }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Render failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const slug = brand.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "design";
      a.download = `${slug}-design.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Button asChild variant="ghost" size="sm">
          <Link href="/brands">
            <ArrowLeft className="h-4 w-4" /> Brands
          </Link>
        </Button>
        <span className="font-serif text-lg font-semibold">addyourbrand</span>
        <BrandPicker
          brands={availableBrands}
          selectedId={selectedBrandId}
          onPick={pickBrand}
        />
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 pb-20 lg:grid-cols-[1fr_1fr_auto]">
        <section className="space-y-5">
          <h2 className="font-serif text-2xl font-semibold">1. Tune your brand</h2>
          <p className="text-sm text-muted-foreground">
            Tweaks here apply to this render only.{" "}
            <Link
              href={`/brands/${selectedBrandId}`}
              className="text-accent underline-offset-2 hover:underline"
            >
              Edit saved brand →
            </Link>
          </p>
          <BrandFields brand={brand} setBrand={setBrand} />
        </section>

        <section className="space-y-5">
          <h2 className="font-serif text-2xl font-semibold">2. Your template</h2>
          <UploadZone
            previewUrl={previewUrl}
            onFile={handleFile}
            onClear={() => {
              setPreviewUrl(null);
              setImageBase64(null);
              setImageMime(null);
              setDoc(null);
            }}
          />
          <Button
            size="lg"
            variant="accent"
            disabled={!imageBase64 || loading}
            onClick={runAnalysis}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" /> Rebrand this template
              </>
            )}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </section>

        <section className="space-y-5">
          <h2 className="font-serif text-2xl font-semibold">3. Your design</h2>
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-lg border border-dashed border-border p-4">
              {doc ? (
                <BrandRenderer brand={brand} doc={doc} width={360} />
              ) : (
                <div className="preview-23 flex items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                  Your rebranded 1080×1620
                  <br />
                  shows up here
                </div>
              )}
            </div>
            {doc ? (
              <>
                <div className="flex w-full max-w-sm flex-col gap-2">
                  <Button
                    size="lg"
                    variant="default"
                    disabled={exporting}
                    onClick={() => download("png")}
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Rendering 1080×1620…
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" /> Download PNG
                      </>
                    )}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    disabled={exporting}
                    onClick={() => download("pdf")}
                  >
                    <Download className="h-4 w-4" /> Download PDF
                  </Button>
                </div>
                <details className="w-full max-w-sm rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground">
                    Document structure
                  </summary>
                  <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(doc, null, 2)}
                  </pre>
                </details>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function BrandPicker({
  brands,
  selectedId,
  onPick,
}: {
  brands: AvailableBrand[];
  selectedId: string;
  onPick: (id: string) => void;
}) {
  return (
    <select
      value={selectedId}
      onChange={(e) => onPick(e.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Select brand"
    >
      {brands.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}

function BrandFields({
  brand,
  setBrand,
}: {
  brand: BrandProfile;
  setBrand: (b: BrandProfile) => void;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="grid grid-cols-2 gap-3">
        <ColorField
          label="Primary"
          value={brand.colors.primary}
          onChange={(v) => setBrand({ ...brand, colors: { ...brand.colors, primary: v } })}
        />
        <ColorField
          label="Accent"
          value={brand.colors.accent ?? "#D97706"}
          onChange={(v) => setBrand({ ...brand, colors: { ...brand.colors, accent: v } })}
        />
        <ColorField
          label="Background"
          value={brand.colors.background}
          onChange={(v) => setBrand({ ...brand, colors: { ...brand.colors, background: v } })}
        />
        <ColorField
          label="Foreground"
          value={brand.colors.foreground}
          onChange={(v) => setBrand({ ...brand, colors: { ...brand.colors, foreground: v } })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Heading font</Label>
          <Input
            value={brand.fonts.heading.family}
            onChange={(e) =>
              setBrand({
                ...brand,
                fonts: {
                  ...brand.fonts,
                  heading: { ...brand.fonts.heading, family: e.target.value },
                },
              })
            }
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Body font</Label>
          <Input
            value={brand.fonts.body.family}
            onChange={(e) =>
              setBrand({
                ...brand,
                fonts: {
                  ...brand.fonts,
                  body: { ...brand.fonts.body, family: e.target.value },
                },
              })
            }
            className="mt-1"
          />
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Voice + facts</summary>
        <div className="mt-3 space-y-3">
          <div>
            <Label className="text-xs">Brand facts</Label>
            <Textarea
              value={brand.brandFacts}
              onChange={(e) => setBrand({ ...brand, brandFacts: e.target.value })}
              className="mt-1 min-h-[80px]"
            />
          </div>
          <div>
            <Label className="text-xs">Voice samples (blank line between)</Label>
            <Textarea
              value={brand.voiceSamples.join("\n\n")}
              onChange={(e) =>
                setBrand({
                  ...brand,
                  voiceSamples: e.target.value
                    .split(/\n{2,}/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="mt-1 min-h-[120px] font-serif"
            />
          </div>
        </div>
      </details>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 cursor-pointer rounded-md border border-input bg-background"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
}

function UploadZone({
  previewUrl,
  onFile,
  onClear,
}: {
  previewUrl: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-card p-6">
      {previewUrl ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Uploaded template"
            className="mx-auto max-h-[460px] rounded-md object-contain"
          />
          <Button variant="ghost" size="sm" onClick={onClear} className="w-full">
            Choose different template
          </Button>
        </div>
      ) : (
        <label
          htmlFor="template-upload"
          className="flex cursor-pointer flex-col items-center gap-3 py-8 text-sm text-muted-foreground hover:text-foreground"
        >
          <Upload className="h-6 w-6" />
          <span className="font-medium">Drop a template image</span>
          <span className="text-xs">
            PNG, JPEG, WebP — 2:3 portrait works best
          </span>
          <input
            id="template-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
      )}
    </div>
  );
}
