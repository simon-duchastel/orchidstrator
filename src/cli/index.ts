#!/usr/bin/env node

import { Command } from "@cliffy/command";

import { initCommand } from "./commands/init";
import { upCommand } from "./commands/up";
import { downCommand } from "./commands/down";
import { statusCommand } from "./commands/status";
import { dashboardCommand } from "./commands/dashboard";
import { generateHelp } from "./help";

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
