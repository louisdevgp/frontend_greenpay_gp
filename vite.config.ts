import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        // This will transform your SVG to a React component
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  server: {
    // Listen on all interfaces so the dev server is reachable from your LAN
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ["desktop-gq4h5gu"],
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },
});
