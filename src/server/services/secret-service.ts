import crypto from "node:crypto";

const SECRET_VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class SecretService {
  encrypt(plaintext: string) {
    if (!plaintext.trim()) {
      throw new Error("Secret value cannot be empty.");
    }

    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv, { authTagLength: TAG_BYTES });
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [SECRET_VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
  }

  decrypt(value: string) {
    const [version, ivValue, tagValue, ciphertextValue] = value.split(":");
    if (version !== SECRET_VERSION || !ivValue || !tagValue || !ciphertextValue) {
      throw new Error("Unsupported encrypted secret format.");
    }

    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivValue, "base64url"), {
      authTagLength: TAG_BYTES
    });
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
  }

  mask(value: string) {
    if (value.length <= 8) return "********";
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }
}

function getKey() {
  const material = process.env.SECRET_ENCRYPTION_KEY;

  if (!material) {
    throw new Error("SECRET_ENCRYPTION_KEY must be configured.");
  }

  return crypto.createHash("sha256").update(material).digest();
}
