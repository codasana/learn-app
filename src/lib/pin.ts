import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/**
 * The parent's 4-digit PIN gates the exit from kid mode back to the parent
 * dashboard. A 4-digit space is tiny, so this is a speed bump against a child,
 * not a security boundary — the real boundary is the parent's password.
 *
 * Attempts are rate-limited to 5 (see the PIN action), after which the parent
 * password is required.
 */

export async function hashPin(pin: string): Promise<string> {
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be exactly 4 digits");
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(pin, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPin(
  pin: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored || !/^\d{4}$/.test(pin)) return false;
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = (await scryptAsync(pin, salt, 64)) as Buffer;
  const expected = Buffer.from(key, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}
