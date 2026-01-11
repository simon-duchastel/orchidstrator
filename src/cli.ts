/**
 * Orchid CLI
 *
 * Command-line interface for orchestrating background AI tasks.
 *
 * Commands:
 *   orchid up     - Start the orchid daemon
 *   orchid down   - Stop the orchid daemon
 *   orchid status - Check if daemon is running
 *   orchid help   - Show help
 */

import { Command } from "commander";
import { startDaemon, stopDaemon, getStatus } from "./process-manager.js";

const program = new Command();

program
  .name("orchid")
  .description("Orchestrate complex background AI tasks")
  .version("1.0.0");

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
  .action(() => {
    console.log("Stopping orchid...");
    const result = stopDaemon();
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

// Default action when no command is provided - show help
program.action(() => {
  program.help();
});

program.parse();
