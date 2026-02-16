import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateSecureToken,
  generateServerCredentials,
  createAuthHeader,
  validateCredentials,
  CREDENTIAL_LENGTH,
} from "./credentials";

// Mock the crypto module
vi.mock("node:crypto", () => ({
  randomBytes: vi.fn(),
}));

import { randomBytes } from "node:crypto";

describe("credentials utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateSecureToken", () => {
    it("should generate a token of the specified length", () => {
      // Setup: mock randomBytes to return predictable hex
      vi.mocked(randomBytes).mockImplementation(() => Buffer.from("aabbccdd11223344", "hex"));

      const token = generateSecureToken(16);

      expect(token).toHaveLength(16);
      expect(token).toBe("aabbccdd11223344");
    });

    it("should generate a token of default length (32)", () => {
      // Setup: mock randomBytes to return 16 bytes (32 hex chars)
      vi.mocked(randomBytes).mockImplementation(() =>
        Buffer.from("aabbccdd11223344aabbccdd11223344", "hex")
      );

      const token = generateSecureToken();

      expect(token).toHaveLength(CREDENTIAL_LENGTH);
      expect(randomBytes).toHaveBeenCalledWith(16); // 32/2 = 16 bytes
    });

    it("should handle odd lengths by rounding up", () => {
      vi.mocked(randomBytes).mockImplementation(() => Buffer.from("aabbccdd11", "hex"));

      const token = generateSecureToken(9);

      expect(token).toHaveLength(9);
      expect(randomBytes).toHaveBeenCalledWith(5); // ceil(9/2) = 5 bytes
    });

    it("should generate different tokens on each call", () => {
      // Setup: return different values on consecutive calls using valid hex
      let callCount = 0;
      const hexChars = "0123456789abcdef";
      vi.mocked(randomBytes).mockImplementation((size: number) => {
        callCount++;
        // Generate a valid hex string of the right length (size * 2 hex chars)
        let hex = "";
        for (let i = 0; i < size; i++) {
          const index1 = (i + callCount) % 16;
          const index2 = (i + callCount + 8) % 16;
          hex += hexChars[index1] + hexChars[index2];
        }
        return Buffer.from(hex, "hex");
      });

      const token1 = generateSecureToken(8);
      const token2 = generateSecureToken(8);

      expect(token1).not.toBe(token2);
    });
  });

  describe("generateServerCredentials", () => {
    it("should generate credentials with username and password", () => {
      // Setup: mock randomBytes to return valid hex strings
      let callCount = 0;
      const hexChars = "0123456789abcdef";
      vi.mocked(randomBytes).mockImplementation((size: number) => {
        callCount++;
        // Generate a valid hex string of size * 2 characters
        let hex = "";
        for (let i = 0; i < size; i++) {
          hex += hexChars[(i + callCount) % 16] + hexChars[(i + callCount + 1) % 16];
        }
        return Buffer.from(hex, "hex");
      });

      const creds = generateServerCredentials();

      expect(creds.username).toBeDefined();
      expect(creds.password).toBeDefined();
      expect(creds.username).toHaveLength(CREDENTIAL_LENGTH);
      expect(creds.password).toHaveLength(CREDENTIAL_LENGTH);
    });

    it("should generate unique credentials on each call", () => {
      // First call - return one set of bytes
      vi.mocked(randomBytes)
        .mockImplementationOnce(() => Buffer.from("aabbccdd11223344aabbccdd11223344", "hex"))
        .mockImplementationOnce(() => Buffer.from("11223344aabbccdd11223344aabbccdd", "hex"));

      const creds1 = generateServerCredentials();
      
      // Second call - return different bytes  
      vi.mocked(randomBytes)
        .mockImplementationOnce(() => Buffer.from("55667788990011225566778899001122", "hex"))
        .mockImplementationOnce(() => Buffer.from("33445566778899aabbccdd1122334455", "hex"));
      
      const creds2 = generateServerCredentials();

      expect(creds1.username).not.toBe(creds2.username);
      expect(creds1.password).not.toBe(creds2.password);
    });
  });

  describe("createAuthHeader", () => {
    it("should create correct Basic auth header", () => {
      const credentials = {
        username: "testuser",
        password: "testpass",
      };

      const header = createAuthHeader(credentials);

      const expected = `Basic ${Buffer.from("testuser:testpass").toString("base64")}`;
      expect(header).toBe(expected);
    });

    it("should handle special characters in credentials", () => {
      const credentials = {
        username: "user@domain.com",
        password: "p@ss:w0rd!",
      };

      const header = createAuthHeader(credentials);

      const expected = `Basic ${Buffer.from("user@domain.com:p@ss:w0rd!").toString("base64")}`;
      expect(header).toBe(expected);
    });

    it("should handle long credentials", () => {
      const credentials = {
        username: "a".repeat(32),
        password: "b".repeat(32),
      };

      const header = createAuthHeader(credentials);

      const expected = `Basic ${Buffer.from("a".repeat(32) + ":" + "b".repeat(32)).toString("base64")}`;
      expect(header).toBe(expected);
    });
  });

  describe("validateCredentials", () => {
    it("should return true for valid credentials", () => {
      const credentials = {
        username: "a".repeat(32),
        password: "b".repeat(32),
      };

      expect(validateCredentials(credentials)).toBe(true);
    });

    it("should throw error when credentials is null", () => {
      expect(() => validateCredentials(null as any)).toThrow("Credentials are required");
    });

    it("should throw error when credentials is undefined", () => {
      expect(() => validateCredentials(undefined as any)).toThrow("Credentials are required");
    });

    it("should throw error when username is missing", () => {
      const credentials = {
        password: "b".repeat(32),
      } as any;

      expect(() => validateCredentials(credentials)).toThrow("Username must be at least 32 characters");
    });

    it("should throw error when username is too short", () => {
      const credentials = {
        username: "short",
        password: "b".repeat(32),
      };

      expect(() => validateCredentials(credentials)).toThrow("Username must be at least 32 characters");
    });

    it("should throw error when password is missing", () => {
      const credentials = {
        username: "a".repeat(32),
      } as any;

      expect(() => validateCredentials(credentials)).toThrow("Password must be at least 32 characters");
    });

    it("should throw error when password is too short", () => {
      const credentials = {
        username: "a".repeat(32),
        password: "short",
      };

      expect(() => validateCredentials(credentials)).toThrow("Password must be at least 32 characters");
    });

    it("should accept credentials longer than minimum length", () => {
      const credentials = {
        username: "a".repeat(64),
        password: "b".repeat(64),
      };

      expect(validateCredentials(credentials)).toBe(true);
    });
  });

  describe("CREDENTIAL_LENGTH constant", () => {
    it("should be 32", () => {
      expect(CREDENTIAL_LENGTH).toBe(32);
    });
  });
});
