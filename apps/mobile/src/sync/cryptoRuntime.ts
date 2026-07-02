import * as Crypto from "expo-crypto";

export function ensureCryptoRuntime(): void {
  const runtime = globalThis as typeof globalThis & {
    crypto?: typeof globalThis.crypto & {
      randomUUID?: () => string;
    };
  };
  if (!runtime.crypto) {
    runtime.crypto = {
      getRandomValues: Crypto.getRandomValues,
      randomUUID: Crypto.randomUUID,
    } as typeof globalThis.crypto & { randomUUID: () => string };
  }
  if (!runtime.crypto.getRandomValues) {
    runtime.crypto.getRandomValues =
      Crypto.getRandomValues as typeof runtime.crypto.getRandomValues;
  }
  if (!runtime.crypto.randomUUID) {
    runtime.crypto.randomUUID =
      Crypto.randomUUID as typeof runtime.crypto.randomUUID;
  }
  if (!runtime.crypto.subtle) {
    throw new Error(
      "This Expo dev build needs a WebCrypto-compatible runtime for encrypted pairing."
    );
  }
}
