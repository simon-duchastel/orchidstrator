import { Command } from "@cliffy/command";
import { stopDaemon } from "../process-manager.js";

export async function downAction() {
  const result = await stopDaemon();
  console.log(result.message);
  if (!result.success) {
    process.exit(1);
  }
}

export const downCommand: any = new Command()
  .description("Stop the orchid daemon and OpenCode server")
  .action(downAction);
