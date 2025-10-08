// src/routes/users.ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

router.get("/", async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, username: true },
  });
  res.json(users);
});

export default router;