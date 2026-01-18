/**
 * Orchid Daemon Process
 *
 * This process runs in the background and manages the OpenCode server.
 * It is spawned by the CLI's `up` command and stopped by the `down` command.
 */

import { createOpencode } from "@opencode-ai/sdk";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { getPidFile, getLogFile, getErrorLogFile, getDirectoryPort, getOrchidDir } from "./paths.js";

async function main() {
  const orchidDir = getOrchidDir();
  const pidFile = getPidFile();
  const port = getDirectoryPort();
  
  // Ensure the orchid directory exists
  if (!existsSync(orchidDir)) {
    mkdirSync(orchidDir, { recursive: true });
  }

  // Write our PID so the CLI can find and stop us
  writeFileSync(pidFile, process.pid.toString());

  console.log(`[orchid] Starting daemon (PID: ${process.pid})`);

  try {
    // Create the OpenCode server and client
    const opencode = await createOpencode({
      hostname: "127.0.0.1",
      port: port,
    });

    console.log(`[orchid] OpenCode server running at ${opencode.server.url}`);

    // Handle shutdown signals gracefully
    const shutdown = async (signal: string) => {
      console.log(`[orchid] Received ${signal}, shutting down...`);
      try {
        opencode.server.close();
        console.log("[orchid] OpenCode server closed");
      } catch (err) {
        console.error("[orchid] Error closing server:", err);
      }
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    console.log("[orchid] Daemon ready");
  } catch (err) {
    console.error("[orchid] Failed to start daemon:", err);
    process.exit(1);
  }
}

// Export main for testing
export { main };

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
