"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveBrand, deleteBrand } from "@/app/brands/actions";
import type { BrandProfile, FontDef } from "@/lib/types";
import { Loader2, Trash2, Type } from "lucide-react";

// Subset of the asset row a parent can pass in. We accept just what we need
// so the form doesn't reach into the full Drizzle row type.
export type FontAsset = {
  id: string;
  filename: string;
};

export function BrandForm({
  brandId,
  initialProfile,
  fontAssets = [],
}: {
  brandId?: string;
  initialProfile: BrandProfile;
  fontAssets?: FontAsset[];
}) {
  const [profile, setProfile] = useState<BrandProfile>(initialProfile);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function patch<K extends keyof BrandProfile>(
    key: K,
    value: BrandProfile[K],
  ) {
    setProfile({ ...profile, [key]: value });
  }
  function patchColors(c: Partial<BrandProfile["colors"]>) {
    setProfile({ ...profile, colors: { ...profile.colors, ...c } });
  }
  function patchFontFamily(field: "heading" | "body", family: string) {
    // Editing the family name in the text input switches the font back to
    // Google Fonts mode. If the user wants an uploaded asset, they pick
    // from the dropdown below.
    setProfile({
      ...profile,
      fonts: {
        ...profile.fonts,
        [field]: { ...profile.fonts[field], family, source: "google", assetId: undefined },
      },
    });
  }

  function patchFontAsset(field: "heading" | "body", asset: FontAsset | null) {
    if (!asset) {
      // "Use a Google Font" → revert to google source, keep family as-is.
      setProfile({
        ...profile,
        fonts: {
          ...profile.fonts,
          [field]: {
            ...profile.fonts[field],
            source: "google",
            assetId: undefined,
          },
        },
      });
      return;
    }
    // Strip extension from filename for the family display name. Satori
    // registers fonts by name, so it just has to be consistent — this is
    // the name we'll register.
    const family = asset.filename.replace(/\.[a-z0-9]+$/i, "");
    setProfile({
      ...profile,
      fonts: {
        ...profile.fonts,
        [field]: { family, source: "asset", assetId: asset.id },
      },
    });
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      try {
        const { id } = await saveBrand({ id: brandId, profile });
        router.push(`/brands/${id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function onDelete() {
    if (!brandId) return;
    if (!confirm(`Delete brand "${profile.name}"? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteBrand(brandId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Field
        label="Brand name"
        value={profile.name}
        onChange={(v) => patch("name", v)}
      />

      <fieldset className="space-y-3 rounded-xl border border-border bg-card p-5">
        <legend className="px-2 font-serif text-sm font-semibold">Colors</legend>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ColorField
            label="Primary"
            value={profile.colors.primary}
            onChange={(v) => patchColors({ primary: v })}
          />
          <ColorField
            label="Accent"
            value={profile.colors.accent ?? "#D97706"}
            onChange={(v) => patchColors({ accent: v })}
          />
          <ColorField
            label="Background"
            value={profile.colors.background}
            onChange={(v) => patchColors({ background: v })}
          />
          <ColorField
            label="Foreground"
            value={profile.colors.foreground}
            onChange={(v) => patchColors({ foreground: v })}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-border bg-card p-5">
        <legend className="px-2 font-serif text-sm font-semibold">Fonts</legend>
        <FontSlot
          label="Heading font"
          font={profile.fonts.heading}
          fontAssets={fontAssets}
          onFamilyChange={(v) => patchFontFamily("heading", v)}
          onAssetChange={(a) => patchFontAsset("heading", a)}
        />
        <FontSlot
          label="Body font"
          font={profile.fonts.body}
          fontAssets={fontAssets}
          onFamilyChange={(v) => patchFontFamily("body", v)}
          onAssetChange={(a) => patchFontAsset("body", a)}
        />
        <p className="text-xs text-muted-foreground">
          Type any Google Fonts family name, or pick an uploaded font asset
          from the dropdown.
        </p>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-border bg-card p-5">
        <legend className="px-2 font-serif text-sm font-semibold">
          Voice & content
        </legend>

        <div>
          <Label>Brand facts</Label>
          <Textarea
            value={profile.brandFacts}
            onChange={(e) => patch("brandFacts", e.target.value)}
            className="mt-1 min-h-[120px]"
            placeholder="Niche, audience, what you teach, what you don't, your style…"
          />
        </div>

        <div>
          <Label>Voice samples — paste 3-5 excerpts of your actual writing</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Separate samples with a blank line. The model writes in this voice.
          </p>
          <Textarea
            value={profile.voiceSamples.join("\n\n")}
            onChange={(e) =>
              patch(
                "voiceSamples",
                e.target.value
                  .split(/\n{2,}/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            className="mt-2 min-h-[180px] font-serif"
          />
        </div>

        <div>
          <Label>Signature formulas — one per line</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            E.g.{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              The truth about [X]
            </code>{" "}
            or{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              5 signs your [Y] is ready
            </code>
          </p>
          <Textarea
            value={profile.formulas.join("\n")}
            onChange={(e) =>
              patch(
                "formulas",
                e.target.value
                  .split(/\n+/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            className="mt-2 min-h-[120px]"
          />
        </div>
      </fieldset>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <div className="flex items-center justify-between">
        {brandId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={pending}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Delete brand
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="button"
          variant="accent"
          onClick={onSave}
          disabled={pending}
          size="lg"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : brandId ? (
            "Save changes"
          ) : (
            "Create brand"
          )}
        </Button>
      </div>
    </div>
  );
}

function FontSlot({
  label,
  font,
  fontAssets,
  onFamilyChange,
  onAssetChange,
}: {
  label: string;
  font: FontDef;
  fontAssets: FontAsset[];
  onFamilyChange: (family: string) => void;
  onAssetChange: (asset: FontAsset | null) => void;
}) {
  const isUploaded = Boolean(font.source === "asset" && font.assetId);
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 flex gap-2">
        <Input
          value={font.family}
          onChange={(e) => onFamilyChange(e.target.value)}
          disabled={isUploaded}
          placeholder="e.g. Fraunces"
          className={isUploaded ? "opacity-60" : undefined}
        />
        {fontAssets.length > 0 ? (
          <select
            value={isUploaded ? font.assetId : ""}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) {
                onAssetChange(null);
                return;
              }
              const asset = fontAssets.find((a) => a.id === id);
              if (asset) onAssetChange(asset);
            }}
            className="h-10 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${label} — choose uploaded asset`}
          >
            <option value="">Google Fonts</option>
            {fontAssets.map((a) => (
              <option key={a.id} value={a.id}>
                ↑ {a.filename}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {isUploaded ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-accent">
          <Type className="h-3 w-3" /> Using uploaded font ({font.family})
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
        placeholder={placeholder}
      />
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
