import { redirect } from "next/navigation";
import { listMyBrands } from "@/app/brands/actions";
import { getDesign } from "@/app/designs/actions";
import { AppClient } from "./app-client";

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; design?: string }>;
}) {
  const params = await searchParams;
  const brands = await listMyBrands();

  if (brands.length === 0) {
    redirect("/brands");
  }

  const available = brands.map((b) => ({
    id: b.id,
    name: b.name,
    profile: b.profile,
  }));

  // Restore from a saved design — pre-populates the brand picker, the doc,
  // and a thumbnail of the original template image.
  let initial: {
    brandId: string;
    designId?: string;
    doc?: import("@/lib/types").DocumentStructure;
    templateUrl?: string;
  } = {
    brandId: available[0].id,
  };

  if (params.design) {
    const restored = await getDesign(params.design);
    if (restored) {
      initial = {
        brandId: restored.design.brandId,
        designId: restored.design.id,
        doc: restored.design.doc,
        // Auth-gated route — only the design's owner can fetch this.
        templateUrl: `/api/templates/${restored.design.id}`,
      };
    }
  } else if (params.brand && available.some((b) => b.id === params.brand)) {
    initial = { brandId: params.brand };
  }

  return (
    <AppClient
      availableBrands={available}
      initialBrandId={initial.brandId}
      initialDesignId={initial.designId}
      initialDoc={initial.doc}
      initialTemplateUrl={initial.templateUrl}
    />
  );
}
