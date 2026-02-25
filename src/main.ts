/**
 * Orchid Daemon Process
 *
 * This process runs in the background and manages agent orchestration.
 * It is spawned by the CLI's `up` command and stopped by the `down` command.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { getPidFile, getOrchidDir } from "./config/paths.js";
import { log } from "./core/logging/logger.js";

async function main() {
  const orchidDir = getOrchidDir();
  const pidFile = getPidFile();
  
  // Ensure the orchid directory exists
  if (!existsSync(orchidDir)) {
    mkdirSync(orchidDir, { recursive: true });
  }

  // Write our PID so the CLI can find and stop us
  writeFileSync(pidFile, process.pid.toString());

  log.log(`[orchid] Starting daemon (PID: ${process.pid})`);

  try {
    // TODO: Implement Pi-based agent orchestration here
    // This requires the Pi SDK to be installed and configured
    log.log("[orchid] Daemon ready (Pi orchestration not yet implemented)");

    // Handle shutdown signals gracefully
    const shutdown = async (signal: string) => {
      log.log(`[orchid] Received ${signal}, shutting down...`);
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // Keep the process alive
    await new Promise(() => {});
  } catch (err: unknown) {
    log.error("[orchid] Failed to start daemon:", err);
    process.exit(1);
  }
}

// Export main for testing
export { main };

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
