import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  experimental: {
    agentUpgrade: "security",
  },
  outputFileTracingIncludes: {
    "/documentation": ["./docs/crear-modulos.md"],
    "/erp/ajustes/modulos{,/**}": [
      "./src/modules/*/manifest.ts",
      "./src/app/\\(auth\\)/erp/*/manifest.ts",
      "./src/app/\\(auth\\)/erp/*/orm.config.ts",
      "./prisma/models/*.prisma",
      "./prisma/.orm-installations.json",
      "./prisma/.app-retirements.json",
    ],
  },
  outputFileTracingExcludes: {
    "/*": ["./.module-operations/**/*", "./.env*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  allowedDevOrigins: ["192.168.1.54"],
  // Usuarios, Accesos y Módulos se movieron a Ajustes (2026-11-18).
  async redirects() {
    return ["usuarios", "accesos", "modulos"].flatMap(app => [
      { source: `/erp/${app}`, destination: `/erp/ajustes/${app}`, permanent: false },
      { source: `/erp/${app}/:path*`, destination: `/erp/ajustes/${app}/:path*`, permanent: false },
    ]);
  },
};

export default nextConfig;
