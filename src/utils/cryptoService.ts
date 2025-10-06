import crypto from "crypto";

const CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$()-_.";

/**
 * Generates a random key from the allowed characters.
 */
export function generateRandomKey(length: number): string {
  if (length <= 0) throw new Error("Key length must be greater than 0");

  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join("");
}

/**
 * Generates a 256-bit AES key as Base64.
 */
export function generateAes256Key(): string {
  return crypto.randomBytes(32).toString("base64");
}

/**
 * Generates a 256-bit AES key and a 128-bit IV, both Base64.
 */
export function generateAes256KeyAndIv(): { keyBase64: string; ivBase64: string } {
  return {
    keyBase64: crypto.randomBytes(32).toString("base64"),
    ivBase64: crypto.randomBytes(16).toString("base64"),
  };
}

/**
 * Encrypts a plaintext using AES-256-CBC with a provided key string.
 * Key can be Base64 or plain string (hashed to 32 bytes).
 */
export function encrypt(plainText: string, keyString: string): string {
  if (!plainText) return plainText;

  const key = isBase64(keyString)
    ? Buffer.from(keyString, "base64")
    : crypto.createHash("sha256").update(keyString).digest();

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);

  const combined = Buffer.concat([iv, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypts AES-256-CBC ciphertext with provided key string.
 */
export function decrypt(cipherText: string, keyString: string): string {
  if (!cipherText) return cipherText;

  const fullCipher = Buffer.from(cipherText, "base64");

  const key = isBase64(keyString)
    ? Buffer.from(keyString, "base64")
    : crypto.createHash("sha256").update(keyString).digest();

  const iv = fullCipher.subarray(0, 16);
  const cipher = fullCipher.subarray(16);

  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([decipher.update(cipher), decipher.final()]);

  return decrypted.toString("utf8");
}

/**
 * Helper to check if string is Base64.
 */
function isBase64(str: string): boolean {
  try {
    return Buffer.from(str, "base64").toString("base64") === str;
  } catch {
    return false;
  }
}
