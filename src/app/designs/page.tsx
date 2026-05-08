import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listMyDesigns } from "./actions";
import { ArrowLeft, Wand2 } from "lucide-react";

export default async function DesignsPage() {
  const designs = await listMyDesigns();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/brands">
            <ArrowLeft className="h-4 w-4" /> Brands
          </Link>
        </Button>
        <span className="font-serif text-lg font-semibold">addyourbrand</span>
        <Button asChild variant="accent" size="sm">
          <Link href="/app">
            <Wand2 className="h-4 w-4" /> Rebrand a template
          </Link>
        </Button>
      </header>

      <h1 className="font-serif text-3xl font-semibold">Your designs</h1>
      <p className="mt-2 text-muted-foreground">
        Every rebrand is saved here. Open one to re-export, or apply a different
        brand to the same source.
      </p>

      {designs.length === 0 ? (
        <div className="mt-10 rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center">
          <p className="font-serif text-xl">No designs yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Drop a template into the rebrand tool and it'll show up here.
          </p>
          <Button asChild variant="accent" size="lg" className="mt-6">
            <Link href="/app">
              <Wand2 className="h-4 w-4" /> Rebrand a template
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {designs.map((d) => (
            <li key={d.id}>
              <Link
                href={`/app?design=${d.id}`}
                className="group block overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-accent"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/templates/${d.id}`}
                  alt={d.title}
                  className="aspect-[2/3] w-full bg-secondary object-cover"
                />
                <div className="p-4">
                  <p className="truncate font-serif text-base font-semibold">
                    {d.title || "Untitled"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {d.brandName} ·{" "}
                    {new Date(d.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
