import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import os from "os";

const router = Router();

const uploadDir = path.resolve("./uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// temporary storage before resizing
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const unique = `${base}-${Date.now()}${ext}`;
    cb(null, unique);
  },
});

// only allow images, limit size 2 MB
function fileFilter(_req: any, file: Express.Multer.File, cb: any) {
  if (!file.mimetype.startsWith("image/")) {
    cb(new Error("Only image files are allowed"));
  } else {
    cb(null, true);
  }
}

// Utility to find LAN IP
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address; // e.g. 192.168.1.74
      }
    }
  }
  return "localhost";
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

router.post("/avatar", upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const filePath = path.join(uploadDir, req.file.filename);
    const resizedFilename =
      path.basename(req.file.filename, path.extname(req.file.filename)) +
      "-256.png";
    const resizedPath = path.join(uploadDir, resizedFilename);

    await sharp(filePath)
      .resize(256, 256, { fit: "cover" })
      .png({ quality: 90 })
      .toFile(resizedPath);

    fs.unlinkSync(filePath);

    // ✅ Use LAN IP instead of localhost
    const localIP = getLocalIPAddress();
    const url = `https://${localIP}:4000/uploads/${resizedFilename}`;

    res.json({ url });
  } catch (err: any) {
    console.error("❌ Upload error:", err);
    if (err.message.includes("File too large")) {
      res.status(400).json({ error: "File too large (max 2 MB)." });
    } else if (err.message.includes("Only image files")) {
      res.status(400).json({ error: "Only image files are allowed." });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

export default router;
