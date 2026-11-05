import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

/** Proxy verifies the encrypted JWT; definitive account/permission checks remain on the server. */
export default {
  providers: [],
  pages: { signIn: "/auth" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  trustHost: process.env.NODE_ENV !== "production" || process.env.AUTH_TRUST_HOST === "true" || Boolean(process.env.AUTH_URL),
  callbacks: {
    session({ session, token }) {
      session.user = { ...session.user, id: token.sub!, login: typeof token.login === "string" ? token.login : "", name: token.name, image: typeof token.picture === "string" ? token.picture : null, isAdmin: token.isAdmin === true, sessionVersion: typeof token.sessionVersion === "number" ? token.sessionVersion : -1 };
      return session;
    },
    authorized({ auth, request }) {
      if (auth?.user?.id) return true;
      const url = new URL("/auth", request.nextUrl.origin);
      url.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(url);
    },
  },
} satisfies NextAuthConfig;
