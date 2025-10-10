// apps/api/src/server.ts
import "dotenv/config";
import express from "express";
import https from "https";
import fs from "fs";
import path from "path";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "url";
import profileRouter from "./routes/profile.js";
import uploadRouter from "./routes/upload.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();

// 🧩 Read from .env
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://localhost:5173";

// ✅ CORS before routes
app.use(
  cors({
    origin: [FRONTEND_ORIGIN],
    credentials: true,
  })
);

// ✅ Body parser
app.use(express.json());

// Serve static uploads
app.use("/uploads", express.static(path.resolve("./uploads")));

// ✅ Routes
app.use("/api/users", usersRouter);
app.use("/api", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/upload", uploadRouter)

// ✅ Root endpoint
app.get("/", (req, res) => {
  res.json({ message: "Welcome to WRLD API" });
});

// ✅ HTTPS fallback logic
let options: any = {};
try {
  const certPath = path.resolve(__dirname, "../../../certs");
  options = {
    key: fs.readFileSync(`${certPath}/localhost-key.pem`),
    cert: fs.readFileSync(`${certPath}/localhost.pem`),
  };
} catch (err) {
  console.warn("⚠️  HTTPS certs not found, starting in HTTP mode");
}

if (options.key && options.cert) {
  https.createServer(options, app).listen(PORT, () => {
    console.log(`✅ Secure API running on https://localhost:${PORT}`);
    console.log(`   Allowed Origin: ${FRONTEND_ORIGIN}`);
  });
} else {
  app.listen(PORT, () => {
    console.log(`✅ API running on http://localhost:${PORT}`);
    console.log(`   Allowed Origin: ${FRONTEND_ORIGIN}`);
  });
}
