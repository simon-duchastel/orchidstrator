import { Command } from "@cliffy/command";
import { initializeOrchid } from "../../commands/init/init";

export async function initAction(options: any) {
  const result = await initializeOrchid(options.repository);
  console.log(result.message);
  if (!result.success) {
    process.exit(1);
  }
}

export const initCommand: any = new Command()
  .description("Initialize orchid workspace with a git repository")
  .argument("<repository-url>", "Url of the git repository to clone, ex. git@github.com:simon-duchastel/orchid.git")
  .action(initAction);
