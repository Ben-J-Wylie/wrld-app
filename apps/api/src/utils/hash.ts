import bcrypt from "bcryptjs"; // using bcryptjs for reliability on Windows

// Hash a password for signup
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Compare a plaintext password with its stored hash
export async function comparePassword(
  password: string,
  hashed: string
): Promise<boolean> {
  return bcrypt.compare(password, hashed);
}
