import { Command } from "@cliffy/command";
import { flatHelp } from "cliffy-flat-help";

import { initCommand } from "./commands/init.js";
import { upCommand } from "./commands/up.js";
import { downCommand } from "./commands/down.js";
import { statusCommand } from "./commands/status.js";
import { setVerboseLogging } from "../core/logging/index.js";

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
  .parse();
