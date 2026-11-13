import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  outputFileTracingIncludes: {
    "/erp/modulos{,/**}": ["./src/modules/*/manifest.ts", "./src/app/\\(auth\\)/erp/*/manifest.ts", "./src/app/\\(auth\\)/erp/*/orm.config.ts", "./prisma/models/*.prisma", "./prisma/.orm-installations.json", "./prisma/.app-retirements.json"],
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
};

export default nextConfig;
