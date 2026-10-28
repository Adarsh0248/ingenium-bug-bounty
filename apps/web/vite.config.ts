import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const csp =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; worker-src 'self'; img-src 'self' data:; font-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'";
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    {
      name: "production-policy",
      transformIndexHtml: () =>
        command === "build"
          ? [
              {
                tag: "meta",
                attrs: {
                  "http-equiv": "Content-Security-Policy",
                  content: csp,
                },
                injectTo: "head-prepend" as const,
              },
            ]
          : [],
    },
  ],
  envDir: false,
  define: { __PREVIEW__: false },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        ws: true,
        changeOrigin: false,
      },
    },
    fs: {
      allow: ["../.."],
      deny: [
        "**/.env",
        "**/.env.*",
        "**/*.{crt,pem}",
        "**/.git/**",
        "**/content/round-1/**",
        "**/content/round-2/**",
        "**/test-results/**",
      ],
    },
  },
  build: { target: "es2024", sourcemap: false },
}));
