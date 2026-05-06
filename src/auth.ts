import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb, schema } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The adapter wires the Auth.js account/session/user/verificationToken tables
  // we declared in src/lib/db/schema.ts.
  adapter: DrizzleAdapter(getDb(), {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Always re-prompt for account chooser so users on shared machines can
      // pick the right Google account.
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  session: { strategy: "database" },
  callbacks: {
    session({ session, user }) {
      // Expose the user.id so server actions can scope queries by user.
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
