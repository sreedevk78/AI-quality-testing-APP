import { describe, expect, it } from "vitest";
import { SecretService } from "@/server/services/secret-service";

describe("secret service", () => {
  it("encrypts and decrypts provider secrets without returning plaintext ciphertext", () => {
    const service = new SecretService();
    const encrypted = service.encrypt("sk-test-secret");

    expect(encrypted).not.toContain("sk-test-secret");
    expect(service.decrypt(encrypted)).toBe("sk-test-secret");
  });

  it("masks short and long secrets for UI-safe display", () => {
    const service = new SecretService();

    expect(service.mask("short")).toBe("********");
    expect(service.mask("abcdef123456")).toBe("abcd...3456");
  });
});
