import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    port: 9031,
    host: true,   // 모든 인터페이스 listen (휴대폰/외부 디바이스 접근 허용)
  },
});
