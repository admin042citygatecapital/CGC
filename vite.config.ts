import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
// NOTE: This app was exported without six GoDaddy Airo platform-internal dev
// tooling modules (source-mapper, dev-tools x3, content-plugin, fullstory-plugin).
// None of those directories exist anywhere in the delivered codebase, so their
// imports/usages have been removed rather than reconstructed — they were
// Airo builder-specific dev/analytics tooling (babel source-map enrichment,
// live-preview HMR helpers, FullStory session recording, and an in-browser
// content-editing bridge for Airo's own builder UI), not application business
// logic, and none of them are meaningful outside Airo's hosted environment.
// If you have the real packages from your original Airo export, restore them
// here instead of relying on this removal.
function extractHostname(value: string): string {
  try {
    if (value.includes("://")) {
      return new URL(value).hostname;
    }
    return value;
  } catch {
    return value;
  }
}
function ssrRequireShimPlugin(): Plugin {
  return {
    name: "ssr-require-shim",
    apply: "build",
    renderChunk(code, chunk) {
      // Only patch the SSR entry bundle. With noExternal:true, node:module is
      // inlined and already declares createRequire — injecting another import
      // causes a duplicate-identifier SyntaxError. We append a shim at the
      // end instead, where all bundled declarations are already in scope.
      if (chunk.fileName !== "server.bundle.mjs") return null;
      if (code.includes("const require =")) return null; // already present
      return {
        code: code + "\nimport { createRequire as ___cr } from 'node:module';\nconst require = ___cr(import.meta.url);\n",
        map: null
      };
    }
  };
}
function apiDevPlugin(): Plugin {
  return {
    name: "api-dev",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api")) return next();
        try {
          const mod = await server.ssrLoadModule("/src/server/entry.ts");
          const handler = mod.default;
          handler(req, res, next);
        } catch (err) {
          if (err instanceof Error) server.ssrFixStacktrace(err);
          next(err);
        }
      });
    }
  };
}
const allowedHosts: string[] = [];
const corsOrigins: string[] = [];
if (process.env.FRONTEND_DOMAIN) {
  const frontendHost = extractHostname(process.env.FRONTEND_DOMAIN);
  allowedHosts.push(frontendHost);
  corsOrigins.push(`http://${frontendHost}`, `https://${frontendHost}`);
}
if (process.env.ALLOWED_ORIGINS) {
  const origins = process.env.ALLOWED_ORIGINS.split(",");
  allowedHosts.push(...origins.map(extractHostname));
  corsOrigins.push(...origins);
}
if (process.env.VITE_PARENT_ORIGIN) {
  allowedHosts.push(extractHostname(process.env.VITE_PARENT_ORIGIN));
  corsOrigins.push(process.env.VITE_PARENT_ORIGIN);
}
if (allowedHosts.length === 0) {
  allowedHosts.push("*");
}
if (corsOrigins.length === 0) {
  corsOrigins.push("*");
}
export default defineConfig(({
  isSsrBuild
}) => ({
  envPrefix: ["VITE_", "SITE_"],
  plugins: [react(), apiDevPlugin(), ssrRequireShimPlugin()],
  resolve: {
    dedupe: ["react", "react-dom", "react-router-dom"],
    alias: {
      nothing: "/src/fallbacks/missingModule.ts",
      "@/api": path.resolve(__dirname, "./src/server/api"),
      "@": path.resolve(__dirname, "./src")
    }
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom"]
  },
  ssr: {
    noExternal: isSsrBuild ? true : undefined,
    // Native .node addons cannot be bundled by Rollup — keep them as
    // runtime requires so Node resolves them from node_modules at startup.
    external: isSsrBuild ? [
      '@node-rs/argon2',
      '@node-rs/argon2-linux-x64-musl',
      '@node-rs/argon2-linux-x64-gnu',
      '@node-rs/argon2-darwin-x64',
      '@node-rs/argon2-darwin-arm64',
      '@node-rs/argon2-win32-x64-msvc',
      // ws's optional performance addons — ws itself require()s these in a
      // try/catch and falls back to pure-JS implementations when absent, but
      // Rollup can't bundle native .node addons, so they must stay external
      // runtime requires just like the argon2 natives above.
      'bufferutil',
      'utf-8-validate',
    ] : undefined,
  },
  server: {
    host: process.env.HOST || "0.0.0.0",
    port: parseInt(process.env.PORT || "5173"),
    strictPort: !!process.env.PORT,
    allowedHosts,
    cors: {
      origin: corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept", "User-Agent"]
    },
    hmr: {
      overlay: false
    },
    watch: {
      ignored: ["**/dist/**"]
    }
  },
  preview: {
    host: process.env.HOST || "0.0.0.0",
    port: parseInt(process.env.PORT || "5173"),
    strictPort: !!process.env.PORT,
    allowedHosts,
    cors: {
      origin: corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept", "User-Agent"]
    }
  },
  build: isSsrBuild ? {
    outDir: "dist",
    emptyOutDir: false,
    copyPublicDir: false,
    ssr: "src/server/entry.ts",
    rollupOptions: {
      output: {
        format: "es",
        entryFileNames: "server.bundle.mjs",
        chunkFileNames: "bin/[name]-[hash].js"
        // Do NOT use banner/intro with an `import` statement here.
        // With noExternal:true, node:module is bundled inline and already
        // declares createRequire — a top-level import causes a duplicate
        // identifier SyntaxError at runtime. Instead we inject the shim
        // via renderChunk so it lands after all bundled declarations.
      }
    }
  } : {
    outDir: "dist/client",
    emptyOutDir: true,
    copyPublicDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — loaded first, cached longest
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
          // React Router
          if (id.includes('node_modules/react-router')) {
            return 'router';
          }
          // Motion (framer-motion fork) — large, animation-only
          if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) {
            return 'motion';
          }
          // Lexical rich-text editor — only used in admin CMS
          if (id.includes('node_modules/lexical') || id.includes('node_modules/@lexical')) {
            return 'lexical';
          }
          // All Radix UI primitives
          if (id.includes('node_modules/@radix-ui')) {
            return 'radix-ui';
          }
          // TanStack Query
          if (id.includes('node_modules/@tanstack')) {
            return 'query';
          }
          // Lucide icons
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }
          // Admin panel pages — only loaded when visiting /admin/*
          if (id.includes('/src/pages/admin/')) {
            return 'admin-pages';
          }
          // Admin layout + auth lib
          if (id.includes('/src/layouts/Admin') || id.includes('/src/lib/adminAuth')) {
            return 'admin-shell';
          }
        }
      }
    }
  }
}));