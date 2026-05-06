import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandForm } from "@/components/brand-form";
import { BrandStarter } from "@/components/brand-starter";
import { emptyBrand } from "@/lib/empty-brand";
import { ArrowLeft } from "lucide-react";

export default function NewBrandPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <Button asChild variant="ghost" size="sm">
          <Link href="/brands">
            <ArrowLeft className="h-4 w-4" /> Back to brands
          </Link>
        </Button>
        <h1 className="mt-4 font-serif text-3xl font-semibold">New brand</h1>
        <p className="mt-2 text-muted-foreground">
          Start from your brand guide PDF, or fill in the fields by hand below.
        </p>
      </header>

      <div className="space-y-8">
        <BrandStarter />

        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-4 text-xs uppercase tracking-wider text-muted-foreground">
              or fill in by hand
            </span>
          </div>
        </div>

        <BrandForm initialProfile={emptyBrand()} />
      </div>
    </main>
  );
}
