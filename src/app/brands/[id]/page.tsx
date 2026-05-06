import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrandForm } from "@/components/brand-form";
import { AssetSection } from "@/components/asset-section";
import { getBrand, listBrandAssets } from "../actions";
import { ArrowLeft, Wand2 } from "lucide-react";

export default async function EditBrandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brand = await getBrand(id);
  if (!brand) notFound();
  const assets = await listBrandAssets(id);
  // Subset of font-kind assets, passed to BrandForm so users can assign
  // uploaded fonts to the heading/body slots.
  const fontAssets = assets
    .filter((a) => a.kind === "font")
    .map((a) => ({ id: a.id, filename: a.filename }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/brands">
              <ArrowLeft className="h-4 w-4" /> Back to brands
            </Link>
          </Button>
          <h1 className="mt-4 font-serif text-3xl font-semibold">
            {brand.name}
          </h1>
        </div>
        <Button asChild variant="accent" size="sm">
          <Link href={`/app?brand=${brand.id}`}>
            <Wand2 className="h-4 w-4" /> Use this brand
          </Link>
        </Button>
      </header>

      <div className="space-y-8">
        {/*
          `key` ties the form's mount lifecycle to the brand's updatedAt.
          Server actions (saveBrand, extractBrandFromAsset, createBrandFromPdf)
          bump updatedAt; router.refresh() then re-renders this page with a
          new key, forcing BrandForm to remount and re-init its local state
          from the fresh initialProfile. Without this, useState's first-mount-
          only init leaves stale empty values on screen even after extraction
          repopulates the DB.
        */}
        <BrandForm
          key={brand.updatedAt.getTime()}
          brandId={brand.id}
          initialProfile={brand.profile}
          fontAssets={fontAssets}
        />
        <AssetSection brandId={brand.id} initialAssets={assets} />
      </div>
    </main>
  );
}
