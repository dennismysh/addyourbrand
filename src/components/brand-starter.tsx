"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createBrandFromPdf } from "@/app/brands/actions";
import { Upload, Loader2, Wand2 } from "lucide-react";

// Drop a brand-guide PDF on /brands/new → creates a draft brand, attaches
// the PDF as a brand_guide asset, runs extraction, redirects to the edit
// page with fields pre-filled. Skips the chicken-and-egg of "save brand
// first, then upload guide".
export function BrandStarter() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { brandId } = await createBrandFromPdf(fd);
      router.push(`/brands/${brandId}`);
      // Force the edit page to fetch the fresh brand row + assets.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (busy) return;
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-accent/40 bg-accent/5 p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Wand2 className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h3 className="font-serif text-lg font-semibold">
            Start from a brand guide
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Drop in your brand-guide PDF. Claude reads it once and pre-fills
            colors, fonts, voice samples, and brand facts below.
          </p>
        </div>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => !busy && fileInputRef.current?.click()}
        className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border bg-background py-8 text-sm text-muted-foreground hover:border-accent hover:text-foreground"
      >
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-medium">Reading your brand guide…</span>
            <span className="text-xs">
              This usually takes 30–60 seconds at high effort
            </span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5" />
            <span className="font-medium">Drop a PDF or click to browse</span>
            <span className="text-xs">Up to 10 MB</span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {error ? (
        <p className="mt-3 text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
