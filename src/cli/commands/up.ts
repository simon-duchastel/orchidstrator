import { Command } from "@cliffy/command";
import { startDaemon } from "../../process/manager.js";

export async function upAction() {
  const result = await startDaemon();
  console.log(result.message);
  if (!result.success) {
    process.exit(1);
  }
}

export const upCommand: any = new Command()
  .description("Start the orchid daemon")
  .action(upAction);
