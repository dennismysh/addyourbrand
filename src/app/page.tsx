import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Palette, FileImage } from "lucide-react";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/10 via-background to-background" />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
          addyourbrand
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/signin">Sign in</Link>
          </Button>
          <Button asChild size="sm" variant="accent">
            <Link href="/brands">Get started</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <Sparkles className="h-3 w-3 text-accent" />
          Drop a template, get your brand on it
        </div>
        <h1 className="font-serif text-5xl font-semibold leading-tight tracking-tight md:text-6xl">
          Your templates,{" "}
          <span className="italic text-accent">your brand</span> — ready for
          Canva.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Save a Pinterest design you love. Drop it in. Get back a 1080×1620
          version in your fonts, your colors, your voice — with your formulas
          plugged in.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Button asChild size="lg" variant="accent">
            <Link href="/brands">
              Set up your brand <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/signin">Sign in</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-24 md:grid-cols-3">
        <FeatureCard
          icon={<FileImage className="h-5 w-5" />}
          title="Drop a template"
          body="Any 2:3 Pinterest-style design. The model reads its layout and intent — headline, list, CTA, hero quote."
        />
        <FeatureCard
          icon={<Palette className="h-5 w-5" />}
          title="Apply your brand"
          body="Colors, fonts, logos, voice samples, signature formulas. Persisted to your brand library — set up once, reuse forever."
        />
        <FeatureCard
          icon={<Sparkles className="h-5 w-5" />}
          title="Export for Canva"
          body="Download the rebranded PNG or PDF and import into Canva as a background or layered design. Ready to ship."
        />
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
        {icon}
      </div>
      <h3 className="font-serif text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
