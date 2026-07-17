import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: "index.html",
        content: "src/content.ts"
      },
      output: {
        entryFileNames: "assets/[name].js"
      }
    }
  }
});
