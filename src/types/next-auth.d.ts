import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User { login: string; isAdmin: boolean; sessionVersion: number }
  interface Session {
    user: DefaultSession["user"] & { id: string; login: string; isAdmin: boolean; sessionVersion: number };
  }
}
declare module "next-auth/jwt" {
  interface JWT { login?: string; isAdmin?: boolean; sessionVersion?: number }
}
