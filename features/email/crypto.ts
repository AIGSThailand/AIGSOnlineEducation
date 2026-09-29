import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const PREFIX = "v1";

function encryptionKey(): Buffer {
  const secret = process.env.EMAIL_SECRETS_KEY?.trim();
  if (!secret) {
    throw new Error("EMAIL_SECRETS_KEY is not set.");
  }
  return scryptSync(secret, "aigs-email-smtp-v1", 32);
}

/** AES-256-GCM ciphertext. Safe to store; useless without EMAIL_SECRETS_KEY. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const [version, ivPart, tagPart, dataPart] = payload.split(":");
  if (version !== PREFIX || !ivPart || !tagPart || !dataPart) {
    throw new Error("Stored SMTP secret is not a recognized ciphertext.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}
