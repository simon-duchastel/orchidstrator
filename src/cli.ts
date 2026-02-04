/**
 * Orchid CLI
 *
 * Command-line interface for orchestrating background AI tasks.
 *
 * Commands:
 *   orchid up        - Start the orchid daemon
 *   orchid down      - Stop the orchid daemon
 *   orchid status    - Check if daemon is running
 *   orchid dashboard - Open the web UI in your browser
 *   orchid help      - Show help
 */

import { Command } from "commander";
import open from "open";
import { startDaemon, stopDaemon, getStatus } from "./process-manager";
import { initializeOrchid, isOrchidInitialized } from "./commands";

const program = new Command();

program
  .name("orchid")
  .description("Orchestrate complex background AI tasks")
  .version("1.0.0");

program
  .command("init")
  .description("Initialize orchid workspace with a git repository")
  .argument("<repository-url>", "Git repository URL to clone")
  .action(async (repoUrl) => {
    console.log(`Initializing orchid with repository: ${repoUrl}`);
    const result = await initializeOrchid(repoUrl);
    console.log(result.message);
    process.exit(result.success ? 0 : 1);
  });

program
  .command("up")
  .description("Start the orchid daemon and OpenCode server")
  .action(async () => {
    console.log("Starting orchid...");
    const result = await startDaemon();
    console.log(result.message);
    process.exit(result.success ? 0 : 1);
  });

program
  .command("down")
  .description("Stop the orchid daemon and OpenCode server")
  .action(async () => {
    console.log("Stopping orchid...");
    const result = await stopDaemon();
    console.log(result.message);
    process.exit(result.success ? 0 : 1);
  });

program
  .command("status")
  .description("Check if the orchid daemon is running")
  .action(() => {
    const status = getStatus();
    if (status.running) {
      console.log(`Orchid is running (PID: ${status.pid})`);
      console.log(`Server: ${status.serverUrl}`);
    } else {
      console.log("Orchid is not running");
    }
  });

program
  .command("dashboard")
  .description("Open the orchid web UI in your browser")
  .action(async () => {
    const status = getStatus();
    if (!status.running || !status.serverUrl) {
      console.error("Orchid is not running. Start it with: orchid up");
      process.exit(1);
    }
    console.log(`Opening ${status.serverUrl} in your browser...`);
    await open(status.serverUrl);
  });

// Default action when no command is provided - show help
program.action(() => {
  program.help();
});

program.parse();
