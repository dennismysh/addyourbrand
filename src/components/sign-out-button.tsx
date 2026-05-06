import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </form>
  );
}
