import { Command } from "@cliffy/command";
import { flatHelp } from "cliffy-flat-help";

import { initCommand } from "./cli/commands/init";
import { upCommand } from "./cli/commands/up";
import { downCommand } from "./cli/commands/down";
import { statusCommand } from "./cli/commands/status";
import { dashboardCommand } from "./cli/commands/dashboard";

await new Command()
  .help(flatHelp())
  .name("orchid")
  .action(function () {
    this.showHelp();
  })
  .description("Orchestrate complex background AI tasks")
  .version("1.0.0")
  .command("init", initCommand)
  .command("up", upCommand)
  .command("down", downCommand)
  .command("status", statusCommand)
  .command("dashboard", dashboardCommand)
  .parse();
