import { Buffer } from "node:buffer";
import { safeStorage } from "electron";

const SAFE_PREFIX = "safe:";
const PLAIN_PREFIX = "plain:";

export function protectLocalSecret(secret: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return `${SAFE_PREFIX}${safeStorage.encryptString(secret).toString("base64")}`;
  }
  return `${PLAIN_PREFIX}${Buffer.from(secret, "utf8").toString("base64url")}`;
}

export function revealLocalSecret(ciphertext: string | undefined): string {
  if (!ciphertext) return "";
  if (ciphertext.startsWith(SAFE_PREFIX)) {
    return safeStorage.decryptString(
      Buffer.from(ciphertext.slice(SAFE_PREFIX.length), "base64")
    );
  }
  if (ciphertext.startsWith(PLAIN_PREFIX)) {
    return Buffer.from(
      ciphertext.slice(PLAIN_PREFIX.length),
      "base64url"
    ).toString("utf8");
  }
  return "";
}
