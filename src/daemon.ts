/**
 * Orchid Daemon Process
 *
 * This process runs in the background and manages the OpenCode server.
 * It is spawned by the CLI's `up` command and stopped by the `down` command.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { getPidFile, getDirectoryPort, getOrchidDir, getMainRepoDir } from "./paths.js";
import { createOpencodeServer, type OpencodeServerInstance } from "./opencode-server.js";
import { AgentOrchestrator } from "./agent-orchestrator.js";

let serverInstance: OpencodeServerInstance | null = null;
let orchestrator: AgentOrchestrator | null = null;

async function main() {
  const orchidDir = getOrchidDir();
  const pidFile = getPidFile();
  const startPort = getDirectoryPort();
  
  // Ensure the orchid directory exists
  if (!existsSync(orchidDir)) {
    mkdirSync(orchidDir, { recursive: true });
  }

  // Write our PID so the CLI can find and stop us
  writeFileSync(pidFile, process.pid.toString());

  console.log(`[orchid] Starting daemon (PID: ${process.pid})`);

  try {
    // Create the OpenCode server with dynamic port allocation and auth
    serverInstance = await createOpencodeServer({
      hostname: "127.0.0.1",
      startPort: startPort,
    });

    console.log(`[orchid] OpenCode server running at ${serverInstance.info.url}`);
    console.log(`[orchid] Server secured with authentication (credentials in memory only)`);

    const mainRepoDir = getMainRepoDir();
    orchestrator = new AgentOrchestrator({ cwdProvider: () => mainRepoDir });

    orchestrator.start().catch((err) => {
      console.error("[orchid] Orchestrator error:", err);
    });
    console.log("[orchid] Agent orchestrator started");

    // Handle shutdown signals gracefully
    const shutdown = async (signal: string) => {
      console.log(`[orchid] Received ${signal}, shutting down...`);
      try {
        if (orchestrator) {
          await orchestrator.stop();
          console.log("[orchid] Orchestrator stopped");
        }
        if (serverInstance) {
          await serverInstance.stop();
          console.log("[orchid] OpenCode server closed");
        }
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

// Export main and server instance for testing
export { main, serverInstance, orchestrator };

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
