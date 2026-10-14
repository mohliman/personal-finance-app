import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react()],
    server: {
      port: 5197,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:" + (env.PORT || "4200"),
          changeOrigin: false,
        },
      },
    },
  };
});
