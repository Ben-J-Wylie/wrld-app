import express from "express";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import usersRouter from "./routes/users.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use("/api/users", usersRouter);

const prisma = new PrismaClient();

// HTTPS certs
let options = {};
try {
  const certPath = path.resolve(__dirname, "../../../certs");
  options = {
    key: fs.readFileSync(`${certPath}/localhost-key.pem`),
    cert: fs.readFileSync(`${certPath}/localhost.pem`),
  };
} catch (err) {
  console.warn("⚠️  HTTPS certs not found, starting in HTTP mode");
}

app.get("/", (req, res) => {
  res.json({ message: "Welcome to WRLD API" });
});

if (options.key && options.cert) {
  https.createServer(options, app).listen(4000, () => {
    console.log("✅ API running on https://localhost:4000");
  });
} else {
  app.listen(4000, () => {
    console.log("✅ API running on http://localhost:4000");
  });
}
