import { redirect } from "next/navigation";
import { listMyBrands } from "@/app/brands/actions";
import { AppClient } from "./app-client";

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const params = await searchParams;
  const brands = await listMyBrands();

  if (brands.length === 0) {
    // First-run: send the user to set up a brand. The brands page handles the
    // empty-state CTA.
    redirect("/brands");
  }

  // Strip server-only fields before passing to the client island.
  const available = brands.map((b) => ({
    id: b.id,
    name: b.name,
    profile: b.profile,
  }));

  const initialBrandId =
    params.brand && available.some((b) => b.id === params.brand)
      ? params.brand
      : available[0].id;

  return <AppClient availableBrands={available} initialBrandId={initialBrandId} />;
}
