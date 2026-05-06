"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  uploadAsset,
  deleteAsset,
  extractBrandFromAsset,
} from "@/app/brands/actions";
import {
  FileImage,
  Type,
  FileText,
  Upload,
  Trash2,
  Loader2,
  Wand2,
} from "lucide-react";

type AssetRow = {
  id: string;
  brandId: string;
  kind: string;
  filename: string;
  contentType: string;
  blobKey: string;
  sizeBytes: number;
  createdAt: Date;
};

const KIND_LABEL: Record<string, string> = {
  logo: "Logo",
  font: "Font",
  reference: "Reference",
  brand_guide: "Brand guide",
  other: "Other",
};

export function AssetSection({
  brandId,
  initialAssets,
}: {
  brandId: string;
  initialAssets: AssetRow[];
}) {
  const [assets, setAssets] = useState<AssetRow[]>(initialAssets);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [extractNotes, setExtractNotes] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function uploadFiles(files: FileList | File[]) {
    setError(null);
    setUploading(true);
    try {
      // Upload sequentially so the user sees progress and we don't bombard
      // the function with parallel multi-MB requests.
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        await uploadAsset(brandId, fd);
      }
      // Server actions revalidatePath, but we also need fresh data here.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onPick() {
    fileInputRef.current?.click();
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (uploading) return;
    if (e.dataTransfer.files.length) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      uploadFiles(e.target.files);
    }
    // Reset so the same file can be picked again later.
    e.target.value = "";
  }

  function onDelete(assetId: string) {
    if (!confirm("Delete this asset?")) return;
    startTransition(async () => {
      try {
        await deleteAsset(assetId);
        setAssets((prev) => prev.filter((a) => a.id !== assetId));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  async function onExtract(assetId: string) {
    setError(null);
    setExtractNotes(null);
    setExtractingId(assetId);
    try {
      const { notes } = await extractBrandFromAsset(assetId);
      // The brand row now has the merged profile. Refresh so BrandForm
      // re-renders with pre-filled fields.
      router.refresh();
      setExtractNotes(notes ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtractingId(null);
    }
  }

  // Sync asset list when the parent server component re-fetches.
  if (
    initialAssets.length !== assets.length ||
    initialAssets.some((a, i) => assets[i]?.id !== a.id)
  ) {
    // We let server-driven refreshes win.
    setAssets(initialAssets);
  }

  return (
    <fieldset className="space-y-4 rounded-xl border border-border bg-card p-5">
      <legend className="px-2 font-serif text-sm font-semibold">
        Brand assets
      </legend>

      <p className="text-xs text-muted-foreground">
        Drop in logos, font files (TTF/OTF), reference imagery, or your brand
        guide PDF. Up to 10 MB per file.
      </p>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={onPick}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border bg-background py-8 text-sm text-muted-foreground hover:border-accent hover:text-foreground"
      >
        {uploading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Uploading…</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5" />
            <span className="font-medium">Drop files or click to browse</span>
            <span className="text-xs">
              PNG · SVG · JPG · TTF · OTF · PDF
            </span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,application/pdf,font/*,.ttf,.otf,.woff,.woff2"
          onChange={onChange}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {extractNotes ? (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs text-foreground">
          <p className="mb-1 font-semibold text-accent">
            Extracted from your brand guide
          </p>
          <p>{extractNotes}</p>
          <p className="mt-2 text-muted-foreground">
            Review the pre-filled fields above and tweak anything that's off,
            then hit Save.
          </p>
        </div>
      ) : null}

      {assets.length === 0 ? null : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {assets.map((a) => {
            const isPdf = a.contentType === "application/pdf";
            const extracting = extractingId === a.id;
            return (
              <li
                key={a.id}
                className="group relative overflow-hidden rounded-lg border border-border bg-background"
              >
                <AssetPreview asset={a} />
                <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-xs font-medium"
                      title={a.filename}
                    >
                      {a.filename}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {KIND_LABEL[a.kind] ?? a.kind} ·{" "}
                      {(a.sizeBytes / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(a.id)}
                    disabled={pending || extracting}
                    aria-label={`Delete ${a.filename}`}
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {isPdf ? (
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => onExtract(a.id)}
                    disabled={extracting || extractingId !== null}
                    className="w-full rounded-none border-t border-border text-xs"
                  >
                    {extracting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Extracting brand…
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-3.5 w-3.5" /> Auto-fill brand from
                        this PDF
                      </>
                    )}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}

function AssetPreview({ asset }: { asset: AssetRow }) {
  const isImage = asset.contentType.startsWith("image/");
  const isFont = asset.kind === "font";
  const isPdf = asset.contentType === "application/pdf";

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/assets/${asset.id}`}
        alt={asset.filename}
        className="aspect-square w-full bg-secondary object-contain p-2"
      />
    );
  }

  return (
    <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-secondary text-muted-foreground">
      {isFont ? (
        <Type className="h-8 w-8" />
      ) : isPdf ? (
        <FileText className="h-8 w-8" />
      ) : (
        <FileImage className="h-8 w-8" />
      )}
      <span className="text-[10px] uppercase tracking-wider">
        {isFont ? "Font" : isPdf ? "PDF" : asset.kind}
      </span>
    </div>
  );
}
