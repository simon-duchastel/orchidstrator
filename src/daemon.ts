/**
 * Orchid Daemon Process
 *
 * This process runs in the background and manages the OpenCode server.
 * It is spawned by the CLI's `up` command and stopped by the `down` command.
 *
 * Future: This daemon will handle autonomous AI task orchestration,
 * spinning up and down sessions without user input.
 */

import { createOpencode } from "@opencode-ai/sdk";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { PID_FILE, DEFAULT_PORT, DEFAULT_HOSTNAME, ORCHID_DIR } from "./paths.js";

async function main() {
  // Ensure the orchid directory exists
  if (!existsSync(ORCHID_DIR)) {
    mkdirSync(ORCHID_DIR, { recursive: true });
  }

  // Write our PID so the CLI can find and stop us
  writeFileSync(PID_FILE, process.pid.toString());

  console.log(`[orchid] Starting daemon (PID: ${process.pid})`);

  try {
    // Create the OpenCode server and client
    const opencode = await createOpencode({
      hostname: DEFAULT_HOSTNAME,
      port: DEFAULT_PORT,
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

    // Keep the process alive
    // The OpenCode server runs in the background, we just need to not exit
    console.log("[orchid] Daemon ready. Waiting for commands...");

    // Future: Here we'll add autonomous task orchestration logic
    // - Monitor for new tasks
    // - Spin up sessions as needed
    // - Process results and spin down
  } catch (err) {
    console.error("[orchid] Failed to start daemon:", err);
    process.exit(1);
  }
}

main();
