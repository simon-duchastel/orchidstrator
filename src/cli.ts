import { Command } from "@cliffy/command";

import { initCommand } from "./cli/commands/init";
import { upCommand } from "./cli/commands/up";
import { downCommand } from "./cli/commands/down";
import { statusCommand } from "./cli/commands/status";
import { dashboardCommand } from "./cli/commands/dashboard";
import { generateHelp } from "./cli/help";

await new Command()
  .help(function() {
    return generateHelp(this);
  })
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
