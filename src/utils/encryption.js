import crypto from "crypto";

const ALGORITHM = "aria-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * 암호화 키 (환경변수에서 로드, 32바이트 = 256비트)
 * .env에 ENCRYPTION_KEY=<64자 hex 문자열> 추가 필요
 */
function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

/**
 * ARIA-256-GCM 암호화
 * @param {string} plaintext
 * @returns {{ encrypted: string, iv: string, authTag: string }} hex 인코딩된 값
 */
export function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag,
  };
}

/**
 * ARIA-256-GCM 복호화
 * @param {{ encrypted: string, iv: string, authTag: string }} data hex 인코딩된 값
 * @returns {string} 복호화된 원문
 */
export function decrypt({ encrypted, iv, authTag }) {
  const key = getKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "hex"),
    { authTagLength: AUTH_TAG_LENGTH }
  );
  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
