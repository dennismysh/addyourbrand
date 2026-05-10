import { redirect } from "next/navigation";
import { listMyBrands } from "@/app/brands/actions";
import { MotifTestClient } from "./motif-test-client";

export default async function MotifTestPage() {
  const brands = await listMyBrands();
  if (brands.length === 0) redirect("/brands");
  return (
    <MotifTestClient
      brands={brands.map((b) => ({ id: b.id, name: b.name, profile: b.profile }))}
    />
  );
}
