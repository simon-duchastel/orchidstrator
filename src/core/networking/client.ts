/**
 * Networking utilities
 *
 * Provides utilities for network operations like finding available ports.
 */

import { createServer } from "node:net";

/**
 * Check if a port is available (not in use)
 *
 * @param port - The port number to check
 * @param hostname - The hostname to bind to (default: 127.0.0.1)
 * @returns Promise that resolves to true if the port is available
 */
export function isPortAvailable(port: number, hostname: string = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    
    server.once("listening", () => {
      server.close(() => {
        resolve(true);
      });
    });
    
    server.listen(port, hostname);
  });
}

/**
 * Find an available port starting from the given port number.
 * If the port is taken, it will increment by 1 and try again until it finds an available port.
 *
 * @param startPort - The port number to start from
 * @param hostname - The hostname to bind to (default: 127.0.0.1)
 * @param maxAttempts - Maximum number of ports to try (default: 100)
 * @returns Promise that resolves to the available port number
 * @throws Error if no available port is found within the range
 */
export async function findAvailablePort(
  startPort: number,
  hostname: string = "127.0.0.1",
  maxAttempts: number = 100
): Promise<number> {
  // Validate startPort is within valid port range
  if (startPort < 1 || startPort > 65535) {
    throw new Error(`Invalid start port: ${startPort}. Port must be between 1 and 65535`);
  }
  
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    
    if (port > 65535) {
      throw new Error(`Port search exceeded maximum port number (65535)`);
    }
    
    if (await isPortAvailable(port, hostname)) {
      return port;
    }
  }
  
  throw new Error(`No available port found in range ${startPort}-${startPort + maxAttempts - 1}`);
}
