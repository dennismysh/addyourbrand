import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const params = await searchParams;
  const from = params.from ?? "/app";

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <Link href="/" className="font-serif text-2xl font-semibold">
          addyourbrand
        </Link>
        <h1 className="mt-6 font-serif text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Save your brand library and re-use it across templates.
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: from });
          }}
          className="mt-8"
        >
          <Button type="submit" size="lg" className="w-full" variant="outline">
            <GoogleIcon className="h-4 w-4" />
            Continue with Google
          </Button>
        </form>

        <p className="mt-6 text-xs text-muted-foreground">
          By continuing, you agree to whatever sensible terms we'll write later.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 1.41 14.97.5 12 .5 7.7.5 3.99 2.97 2.18 7.07l3.66 2.84C6.71 7.31 9.14 4.75 12 4.75z"
      />
    </svg>
  );
}
