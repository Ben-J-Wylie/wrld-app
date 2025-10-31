import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr"; 
import fs from "fs";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    svgr(), 
  ],
  server: {
    host: true, // allows LAN access
    port: 5173,
    https: {
      key: fs.readFileSync(
        path.resolve(__dirname, "../../certs/localhost-key.pem")
      ),
      cert: fs.readFileSync(
        path.resolve(__dirname, "../../certs/localhost.pem")
      ),
    },
  },
});