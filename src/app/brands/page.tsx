import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import { listMyBrands } from "./actions";
import { Plus, ArrowLeft, ArrowRight } from "lucide-react";

export default async function BrandsPage() {
  const brands = await listMyBrands();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/designs">My designs</Link>
          </Button>
        </div>
        <span className="font-serif text-lg font-semibold">addyourbrand</span>
        <div className="flex items-center gap-2">
          <SignOutButton />
          <Button asChild variant="accent" size="sm">
            <Link href="/brands/new">
              <Plus className="h-4 w-4" /> New brand
            </Link>
          </Button>
        </div>
      </header>

      <h1 className="font-serif text-3xl font-semibold">Your brand library</h1>
      <p className="mt-2 text-muted-foreground">
        Each brand is a reusable identity. Drop a template, pick a brand, get
        the design back in your colors, fonts, and voice.
      </p>

      {brands.length === 0 ? (
        <div className="mt-10 rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center">
          <p className="font-serif text-xl">No brands yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Set up your first brand — name, colors, fonts, and a few samples of
            your voice. You can edit it later.
          </p>
          <Button asChild variant="accent" size="lg" className="mt-6">
            <Link href="/brands/new">
              <Plus className="h-4 w-4" /> Create your first brand
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {brands.map((b) => (
            <li key={b.id}>
              <Link
                href={`/brands/${b.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border">
                  <div
                    className="h-6 w-6 rounded-full"
                    style={{
                      background: b.profile.colors.primary,
                      boxShadow: `inset -8px 0 0 0 ${b.profile.colors.accent ?? b.profile.colors.primary}`,
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-lg font-semibold">
                    {b.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.profile.fonts.heading.family} · {b.profile.fonts.body.family}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
