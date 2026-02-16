import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer, type Server } from "node:net";
import { isPortAvailable, findAvailablePort } from "./networking";

// Mock the net module
vi.mock("node:net", () => ({
  createServer: vi.fn(),
}));

describe("networking utilities", () => {
  let mockServer: Server;

  beforeEach(() => {
    vi.clearAllMocks();
    mockServer = {
      once: vi.fn() as unknown as Server["once"],
      listen: vi.fn() as unknown as Server["listen"],
      close: vi.fn((cb?: () => void) => {
        cb?.();
        return mockServer;
      }) as unknown as Server["close"],
    } as Server;
    vi.mocked(createServer).mockReturnValue(mockServer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isPortAvailable", () => {
    it("should return true when port is available", async () => {
      // Setup: simulate successful listen
      vi.mocked(mockServer.once!).mockImplementation((event: string, handler: Function) => {
        if (event === "listening") {
          // Call handler immediately
          setTimeout(() => handler(), 0);
        }
        return mockServer as Server;
      });

      const result = await isPortAvailable(4096, "127.0.0.1");

      expect(result).toBe(true);
      expect(mockServer.listen).toHaveBeenCalledWith(4096, "127.0.0.1");
    });

    it("should return false when port is in use (EADDRINUSE)", async () => {
      // Setup: simulate EADDRINUSE error
      const error = new Error("Port in use") as NodeJS.ErrnoException;
      error.code = "EADDRINUSE";

      vi.mocked(mockServer.once!).mockImplementation((event: string, handler: Function) => {
        if (event === "error") {
          setTimeout(() => handler(error), 0);
        }
        return mockServer as Server;
      });

      const result = await isPortAvailable(4096, "127.0.0.1");

      expect(result).toBe(false);
    });

    it("should return false on other errors", async () => {
      // Setup: simulate generic error
      const error = new Error("Some error") as NodeJS.ErrnoException;
      error.code = "ENOENT";

      vi.mocked(mockServer.once!).mockImplementation((event: string, handler: Function) => {
        if (event === "error") {
          setTimeout(() => handler(error), 0);
        }
        return mockServer as Server;
      });

      const result = await isPortAvailable(4096, "127.0.0.1");

      expect(result).toBe(false);
    });

    it("should use default hostname 127.0.0.1", async () => {
      vi.mocked(mockServer.once!).mockImplementation((event: string, handler: Function) => {
        if (event === "listening") {
          setTimeout(() => handler(), 0);
        }
        return mockServer as Server;
      });

      await isPortAvailable(4096);

      expect(mockServer.listen).toHaveBeenCalledWith(4096, "127.0.0.1");
    });
  });

  describe("findAvailablePort", () => {
    it("should return the start port when it is available", async () => {
      // Setup: port 4096 is available
      let callCount = 0;
      vi.mocked(mockServer.once!).mockImplementation((event: string, handler: Function) => {
        if (event === "listening") {
          setTimeout(() => handler(), 0);
        }
        return mockServer as Server;
      });

      const result = await findAvailablePort(4096, "127.0.0.1", 100);

      expect(result).toBe(4096);
    });

    it("should find the next available port when start port is taken", async () => {
      // Setup: ports 4096, 4097 are taken, 4098 is available
      let attemptCount = 0;
      vi.mocked(mockServer.once!).mockImplementation((event: string, handler: Function) => {
        if (event === "error") {
          if (attemptCount < 2) {
            const error = new Error("Port in use") as NodeJS.ErrnoException;
            error.code = "EADDRINUSE";
            attemptCount++;
            setTimeout(() => handler(error), 0);
          }
        } else if (event === "listening" && attemptCount >= 2) {
          setTimeout(() => handler(), 0);
        }
        return mockServer as Server;
      });

      const result = await findAvailablePort(4096, "127.0.0.1", 100);

      expect(result).toBe(4098);
    });

    it("should throw error when no ports available within range", async () => {
      // Setup: all ports in range are taken
      vi.mocked(mockServer.once!).mockImplementation((event: string, handler: Function) => {
        if (event === "error") {
          const error = new Error("Port in use") as NodeJS.ErrnoException;
          error.code = "EADDRINUSE";
          setTimeout(() => handler(error), 0);
        }
        return mockServer as Server;
      });

      await expect(findAvailablePort(4096, "127.0.0.1", 10)).rejects.toThrow(
        "No available port found in range 4096-4105"
      );
    });

    it("should throw error when startPort exceeds maximum", async () => {
      // Starting port is already above the maximum valid port
      await expect(findAvailablePort(65536, "127.0.0.1", 10)).rejects.toThrow("Invalid start port: 65536");
    });

    it("should throw error when searching exceeds maximum port number", async () => {
      // Setup mock: simulate all ports are in use, so we iterate until we exceed max
      vi.mocked(mockServer.once!).mockImplementation((event: string, handler: Function) => {
        if (event === "error") {
          const error = new Error("Port in use") as NodeJS.ErrnoException;
          error.code = "EADDRINUSE";
          setTimeout(() => handler(error), 0);
        }
        return mockServer as Server;
      });

      // Start at 65530, after 6 attempts we hit 65536 which exceeds max
      await expect(findAvailablePort(65530, "127.0.0.1", 10)).rejects.toThrow("Port search exceeded maximum port number");
    });

    it("should use default hostname and maxAttempts", async () => {
      vi.mocked(mockServer.once!).mockImplementation((event: string, handler: Function) => {
        if (event === "listening") {
          setTimeout(() => handler(), 0);
        }
        return mockServer as Server;
      });

      const result = await findAvailablePort(4096);

      expect(result).toBe(4096);
      expect(mockServer.listen).toHaveBeenCalledWith(4096, "127.0.0.1");
    });

    it("should respect custom maxAttempts parameter", async () => {
      vi.mocked(mockServer.once!).mockImplementation((event: string, handler: Function) => {
        if (event === "error") {
          const error = new Error("Port in use") as NodeJS.ErrnoException;
          error.code = "EADDRINUSE";
          setTimeout(() => handler(error), 0);
        }
        return mockServer as Server;
      });

      await expect(findAvailablePort(4096, "127.0.0.1", 5)).rejects.toThrow(
        "No available port found in range 4096-4100"
      );
    });
  });
});
