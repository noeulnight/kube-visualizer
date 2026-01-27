import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["5173--main--sexy--admin.coder.limtaehyun.dev"],
  },
});
