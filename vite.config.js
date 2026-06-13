import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  assetsInclude: ["**/*.exr"],
  plugins: [react()],
  server: {
    // pinned so the preview tooling always finds the app on the same port
    port: 5178,
  },
});
