import { Command } from "@cliffy/command";
import { getStatus } from "../../process/manager.js";

export function statusAction() {
  const status = getStatus();
  if (status.running) {
    console.log(`Orchid is running (PID: ${status.pid})`);
  } else {
    console.log("Orchid is not running");
  }
}

export const statusCommand: any = new Command()
  .description("Check if the orchid daemon is running")
  .action(statusAction);
