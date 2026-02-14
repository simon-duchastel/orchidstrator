import { Command } from "@cliffy/command";
import open from "open";
import { getStatus } from "../../process-manager";

export async function dashboardAction() {
  const status = getStatus();
  if (!status.running || !status.serverUrl) {
    console.error("Orchid is not running. Start it with: orchid up");
    process.exit(1);
  }
  console.log(`Opening ${status.serverUrl} in your browser...`);
  await open(status.serverUrl);
}

export const dashboardCommand: any = new Command()
  .description("Open the orchid web UI in your browser")
  .action(dashboardAction);
