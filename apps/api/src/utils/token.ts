// apps/api/src/utils/token.ts
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev-secret-key";
console.log("SECRET:", SECRET);

export function createToken(payload: object, expiresIn = "7d") {
  return jwt.sign(payload, SECRET, { expiresIn });
}

export function verifyToken(token: string) {
  return jwt.verify(token, SECRET);
}