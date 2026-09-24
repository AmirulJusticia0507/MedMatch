import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5037",
        changeOrigin: true,
        secure: false,
        configure(proxy) {
          proxy.on("error", (_error, _request, response) => {
            if (response && !response.headersSent) {
              response.writeHead(503, { "Content-Type": "application/json" });
              response.end(JSON.stringify({ error: "MedMatch API belum berjalan." }));
            }
          });
        }
      }
    }
  }
});
