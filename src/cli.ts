import { Command } from "@cliffy/command";
import { flatHelp } from "cliffy-flat-help";

import { initCommand } from "./cli/init.js";
import { upCommand } from "./cli/up.js";
import { downCommand } from "./cli/down.js";
import { statusCommand } from "./cli/status.js";
import { dashboardCommand } from "./cli/dashboard.js";
import { setVerboseLogging } from "./core/logging/index.js";

await new Command()
  .help(flatHelp())
  .name("orchid")
  .description("Orchestrate complex background AI tasks")
  .version("1.0.0")
  .globalOption("--verbose", "Enable verbose logging")
  .action(function (options) {
    if (options.verbose) {
      setVerboseLogging(true);
    }
    this.showHelp();
  })
  .command("init", initCommand)
  .command("up", upCommand)
  .command("down", downCommand)
  .command("status", statusCommand)
  .command("dashboard", dashboardCommand)
  .parse();
