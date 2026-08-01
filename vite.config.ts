import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: {
      entry: "server",
    },
  },

  vite: {
    preview: {
      host: "0.0.0.0",
      allowedHosts: true,
    },
  },
});
