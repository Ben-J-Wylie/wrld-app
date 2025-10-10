import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../utils/hash.js";

const prisma = new PrismaClient();
const router = Router();

router.get("/check-username", async (req, res) => {
  const { username } = req.query;

  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "Username is required." });
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { username },
    });

    res.json({ available: !existing });
  } catch (err) {
    console.error("❌ Username check error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/", async (req, res) => {
  try {
    const { userId, username, firstName, lastName, dob, avatarUrl, newPassword } = req.body;

    if (!userId) return res.status(400).json({ error: "Missing userId." });
    if (!username || !username.trim()) return res.status(400).json({ error: "Username is required." });
    if (!dob) return res.status(400).json({ error: "Date of birth is required." });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found." });

    if (user.username && username && user.username !== username) {
      return res.status(400).json({ error: "Username cannot be changed once set." });
    }

    let passwordHash = user.passwordHash;
    if (newPassword && newPassword.trim().length > 0) {
      passwordHash = await hashPassword(newPassword);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        username: user.username || username,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        dob: dob ? new Date(dob) : null,
        avatarUrl: avatarUrl?.trim() || null,
        passwordHash,
      },
    });

    res.json({ message: "Profile updated", user: updated });
  } catch (err) {
    console.error("❌ Profile update error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


export default router;
