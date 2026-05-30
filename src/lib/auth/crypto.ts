import {
  createCipheriv,
  createDecipheriv,
  createHash,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

const passwordIterations = 210_000;
const passwordKeyLength = 32;
const secretVersion = "v1";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(
    password,
    salt,
    passwordIterations,
    passwordKeyLength,
    "sha256"
  ).toString("base64url");

  return `pbkdf2_sha256$${passwordIterations}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationsText, salt, hash] = storedHash.split("$");

  if (algorithm !== "pbkdf2_sha256" || !iterationsText || !salt || !hash) {
    return false;
  }

  const iterations = Number(iterationsText);

  if (!Number.isInteger(iterations) || iterations < 100_000) {
    return false;
  }

  const expected = Buffer.from(hash, "base64url");
  const actual = pbkdf2Sync(
    password,
    salt,
    iterations,
    expected.length,
    "sha256"
  );

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function deriveEncryptionKey(secret = process.env.AI_CONFIG_ENCRYPTION_KEY) {
  if (!secret) {
    throw new Error("AI_CONFIG_ENCRYPTION_KEY is required to store API keys.");
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string, secret?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveEncryptionKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return [
    secretVersion,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url")
  ].join(":");
}

export function decryptSecret(payload: string, secret?: string) {
  const [version, ivText, tagText, ciphertextText] = payload.split(":");

  if (
    version !== secretVersion ||
    !ivText ||
    !tagText ||
    !ciphertextText
  ) {
    throw new Error("Stored secret payload is invalid.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveEncryptionKey(secret),
    Buffer.from(ivText, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
