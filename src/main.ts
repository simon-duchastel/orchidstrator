/**
 * Orchid Daemon Process
 *
 * This process runs in the background and manages the OpenCode server.
 * It is spawned by the CLI's `up` command and stopped by the `down` command.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { getPidFile, getDirectoryPort, getOrchidDir, getMainRepoDir, getWorktreesDir } from "./config/paths.js";
import { createOpencodeServer, type OpencodeServerInstance } from "./opencode/server.js";
import { AgentOrchestrator } from "./orchestrator/index.js";
import { OpencodeSessionManager } from "./agent-interface/index.js";
import { log } from "./core/logging/logger.js";

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

  log.log(`[orchid] Starting daemon (PID: ${process.pid})`);

  try {
    // Create the OpenCode server with dynamic port allocation and auth
    serverInstance = await createOpencodeServer({
      hostname: "127.0.0.1",
      startPort: startPort,
    });

    log.log(`[orchid] OpenCode server running at ${serverInstance.info.url}`);
    log.log(`[orchid] Server secured with authentication (credentials in memory only)`);

    const mainRepoDir = getMainRepoDir();
    const worktreesDir = getWorktreesDir(() => mainRepoDir);
    
    // Create session manager
    const sessionManager = new OpencodeSessionManager({
      sessionsDir: worktreesDir,
      baseUrl: serverInstance.info.url,
    });
    
    // Create and start the orchestrator
    orchestrator = new AgentOrchestrator({
      cwdProvider: () => mainRepoDir,
      sessionManager: sessionManager,
    });

    orchestrator.start().catch((err: Error) => {
      log.error("[orchid] Orchestrator error:", err);
    });
    log.log("[orchid] Agent orchestrator started");

    // Handle shutdown signals gracefully
    const shutdown = async (signal: string) => {
      log.log(`[orchid] Received ${signal}, shutting down...`);
      try {
        if (orchestrator) {
          await orchestrator.stop();
          log.log("[orchid] Orchestrator stopped");
        }
        if (serverInstance) {
          await serverInstance.stop();
          log.log("[orchid] OpenCode server closed");
        }
      } catch (err: unknown) {
        log.error("[orchid] Error closing server:", err);
      }
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    log.log("[orchid] Daemon ready");
  } catch (err: unknown) {
    log.error("[orchid] Failed to start daemon:", err);
    process.exit(1);
  }
}

// Export main and server instance for testing
export { main, serverInstance, orchestrator };

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
