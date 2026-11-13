import "server-only";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "./auth.config";
import { prisma } from "./lib/prisma";
import { loginSchema } from "./schemas/login.schema";
import { verifyPassword } from "./lib/auth/password";
import { createLoginLimiter } from "./lib/auth/attempts";
import { isModuleMaintenance } from "./lib/module-manager/maintenance";

const attempts = createLoginLimiter();
// A valid fixed-cost hash used for missing/inactive accounts, never an account password.
const dummyHash = "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
const sessionSelect = { id: true, login: true, active: true, isAdmin: true, darkMode: true, sessionVersion: true, partner: { select: { name: true, avatarUrl: true } } } as const;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [Credentials({
    credentials: { login: { label: "Usuario", type: "text" }, password: { label: "Contraseña", type: "password" } },
    async authorize(input) {
      if (await isModuleMaintenance()) return null;
      const parsed = loginSchema.safeParse(input);
      if (!parsed.success || !attempts.allow(parsed.data.login)) return null;
      const user = await prisma.user.findUnique({ where: { login: parsed.data.login }, select: { ...sessionSelect, password: true } });
      const valid = await verifyPassword(parsed.data.password, user?.password ?? dummyHash);
      if (!user || !user.active || !valid) return null;
      // Recheck the version/password snapshot to reject an intervening deactivation or password reset.
      const updated = await prisma.user.updateMany({ where: { id: user.id, active: true, sessionVersion: user.sessionVersion, password: user.password }, data: { lastLogin: new Date() } });
      if (updated.count !== 1) return null;
      attempts.clear(user.login);
      return { id: user.id, login: user.login, name: user.partner?.name ?? user.login, image: user.partner?.avatarUrl ?? null, isAdmin: user.isAdmin, darkMode: user.darkMode, sessionVersion: user.sessionVersion };
    },
  })],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) { token.sub = user.id; token.sessionVersion = user.sessionVersion; }
      if (!token.sub || typeof token.sessionVersion !== "number") return null;
      try {
        const current = await prisma.user.findUnique({ where: { id: token.sub }, select: sessionSelect });
        if (!current?.active || current.sessionVersion !== token.sessionVersion) return null;
        token.login = current.login; token.name = current.partner?.name ?? current.login; token.picture = current.partner?.avatarUrl ?? null; token.isAdmin = current.isAdmin;
        token.darkMode = current.darkMode;
        return token;
      } catch { return null; }
    },
  },
});
