// apps/api/src/routes/auth.ts
import { Router } from "express";
import { prisma } from "../prisma/client.js";
import { hashPassword, comparePassword } from "../utils/hash.js";
import { createToken } from "../utils/token.js";

export const authRouter = Router();

/**
 * POST /api/signup
 * Body: { email, password, username? }
 */
authRouter.post("/signup", async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });

    // check existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return res.status(409).json({ error: "Email already in use." });

    // hash password
    const passwordHash = await hashPassword(password);

    // create user
    const user = await prisma.user.create({
      data: { email, passwordHash, username },
      select: { id: true, email: true, username: true, createdAt: true },
    });

    // create JWT
    const token = createToken({ userId: user.id });

    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during signup." });
  }
});

// POST /api/login
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });

    // find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res.status(401).json({ error: "Invalid email or password." });

    // compare password
    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch)
      return res.status(401).json({ error: "Invalid email or password." });

    // create JWT
    const token = createToken({ userId: user.id, email: user.email });

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
