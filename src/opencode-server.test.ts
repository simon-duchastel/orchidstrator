import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createOpencodeServer,
  getAuthHeader,
  createAuthenticatedUrl,
  type OpencodeServerConfig,
  type OpencodeServerInfo,
} from "./opencode-server";
import { findAvailablePort } from "./utils/networking";
import {
  generateServerCredentials,
  validateCredentials,
} from "./utils/credentials";

// Mock dependencies
vi.mock("@opencode-ai/sdk", () => ({
  createOpencode: vi.fn(),
}));

vi.mock("./utils/networking", () => ({
  findAvailablePort: vi.fn(),
}));

vi.mock("./utils/credentials", () => ({
  generateServerCredentials: vi.fn(),
  validateCredentials: vi.fn(),
  CREDENTIAL_LENGTH: 32,
}));

import { createOpencode } from "@opencode-ai/sdk";

describe("opencode-server", () => {
  const mockCredentials = {
    username: "a".repeat(32),
    password: "b".repeat(32),
  };

  const mockServer = {
    url: "http://127.0.0.1:4096",
    close: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(findAvailablePort).mockResolvedValue(4096);
    vi.mocked(generateServerCredentials).mockReturnValue(mockCredentials);
    vi.mocked(validateCredentials).mockReturnValue(true);
    vi.mocked(createOpencode).mockResolvedValue({
      server: mockServer,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createOpencodeServer", () => {
    it("should create server with default hostname", async () => {
      const config: OpencodeServerConfig = { startPort: 4096 };

      const result = await createOpencodeServer(config);

      expect(findAvailablePort).toHaveBeenCalledWith(4096, "127.0.0.1", 100);
      expect(result.info.hostname).toBe("127.0.0.1");
    });

    it("should use provided hostname", async () => {
      const config: OpencodeServerConfig = {
        startPort: 4096,
        hostname: "localhost",
      };

      await createOpencodeServer(config);

      expect(findAvailablePort).toHaveBeenCalledWith(4096, "localhost", 100);
    });

    it("should use custom maxPortAttempts", async () => {
      const config: OpencodeServerConfig = {
        startPort: 4096,
        maxPortAttempts: 50,
      };

      await createOpencodeServer(config);

      expect(findAvailablePort).toHaveBeenCalledWith(4096, "127.0.0.1", 50);
    });

    it("should find and use available port", async () => {
      vi.mocked(findAvailablePort).mockResolvedValue(4100);

      const config: OpencodeServerConfig = { startPort: 4096 };
      const result = await createOpencodeServer(config);

      expect(result.info.port).toBe(4100);
      expect(createOpencode).toHaveBeenCalledWith(
        expect.objectContaining({ port: 4100 })
      );
    });

    it("should generate and validate credentials", async () => {
      await createOpencodeServer({ startPort: 4096 });

      expect(generateServerCredentials).toHaveBeenCalled();
      expect(validateCredentials).toHaveBeenCalledWith(mockCredentials);
    });

    it("should create OpenCode server with auth configuration", async () => {
      await createOpencodeServer({ startPort: 4096 });

      expect(createOpencode).toHaveBeenCalledWith({
        hostname: "127.0.0.1",
        port: 4096,
        auth: {
          type: "basic",
          username: mockCredentials.username,
          password: mockCredentials.password,
        },
      });
    });

    it("should return server instance with all required properties", async () => {
      const result = await createOpencodeServer({ startPort: 4096 });

      expect(result.server).toBe(mockServer);
      expect(result.info).toEqual({
        url: "http://127.0.0.1:4096",
        port: 4096,
        hostname: "127.0.0.1",
      });
      expect(result.credentials).toBe(mockCredentials);
      expect(typeof result.stop).toBe("function");
    });

    it("should stop server when stop() is called", async () => {
      const result = await createOpencodeServer({ startPort: 4096 });

      await result.stop();

      expect(mockServer.close).toHaveBeenCalled();
    });

    it("should handle stop() gracefully even if server.close throws", async () => {
      mockServer.close.mockImplementation(() => {
        throw new Error("Close error");
      });

      const result = await createOpencodeServer({ startPort: 4096 });

      // Should not throw
      await expect(result.stop()).resolves.toBeUndefined();
    });

    it("should throw if findAvailablePort fails", async () => {
      vi.mocked(findAvailablePort).mockRejectedValue(
        new Error("No ports available")
      );

      await expect(createOpencodeServer({ startPort: 4096 })).rejects.toThrow(
        "No ports available"
      );
    });

    it("should throw if validateCredentials fails", async () => {
      vi.mocked(validateCredentials).mockImplementation(() => {
        throw new Error("Invalid credentials");
      });

      await expect(createOpencodeServer({ startPort: 4096 })).rejects.toThrow(
        "Invalid credentials"
      );
    });

    it("should throw if createOpencode fails", async () => {
      vi.mocked(createOpencode).mockRejectedValue(
        new Error("Server creation failed")
      );

      await expect(createOpencodeServer({ startPort: 4096 })).rejects.toThrow(
        "Server creation failed"
      );
    });
  });

  describe("getAuthHeader", () => {
    it("should create correct Basic auth header", () => {
      const credentials = {
        username: "testuser",
        password: "testpass",
      };

      const header = getAuthHeader(credentials);

      const expected = `Basic ${Buffer.from("testuser:testpass").toString("base64")}`;
      expect(header).toBe(expected);
    });

    it("should handle credentials with special characters", () => {
      const credentials = {
        username: "user@domain.com",
        password: "p@ss:w0rd!",
      };

      const header = getAuthHeader(credentials);

      const expected = `Basic ${Buffer.from("user@domain.com:p@ss:w0rd!").toString("base64")}`;
      expect(header).toBe(expected);
    });
  });

  describe("createAuthenticatedUrl", () => {
    it("should create URL with embedded credentials", () => {
      const info: OpencodeServerInfo = {
        url: "http://127.0.0.1:4096",
        port: 4096,
        hostname: "127.0.0.1",
      };
      const credentials = {
        username: "testuser",
        password: "testpass",
      };

      const url = createAuthenticatedUrl(info, credentials);

      expect(url).toBe("http://testuser:testpass@127.0.0.1:4096/");
    });

    it("should handle HTTPS URLs", () => {
      const info: OpencodeServerInfo = {
        url: "https://example.com:8443",
        port: 8443,
        hostname: "example.com",
      };
      const credentials = {
        username: "user",
        password: "pass",
      };

      const url = createAuthenticatedUrl(info, credentials);

      expect(url).toBe("https://user:pass@example.com:8443/");
    });

    it("should handle special characters in credentials by URL encoding", () => {
      const info: OpencodeServerInfo = {
        url: "http://127.0.0.1:4096",
        port: 4096,
        hostname: "127.0.0.1",
      };
      const credentials = {
        username: "user@domain",
        password: "pass#word",
      };

      const url = createAuthenticatedUrl(info, credentials);

      // URL constructor will encode special characters
      expect(url).toContain("user%40domain");
      expect(url).toContain("pass%23word");
    });
  });
});
