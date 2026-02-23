import { Command } from "@cliffy/command";
import { Confirm } from "@cliffy/prompt/confirm";
import { initializeOrchid, isDirectoryEmpty } from "../orchid-lifecycle/index.js";
import { cwd } from "node:process";

export async function initAction(options: { dangerouslyInitInNonEmptyDir?: true }, repository: string) {
  const currentDir = cwd();
  const allowNonEmptyDir = options.dangerouslyInitInNonEmptyDir ?? false;

  // Check if directory is empty
  if (!allowNonEmptyDir && !isDirectoryEmpty(currentDir)) {
    const confirmed = await Confirm.prompt({
      message: "This directory is not empty. Orchid will clone the repository in this directory and create lots of other files. It's best run in an empty directory - are you sure you want to proceed?",
      default: false,
    });

    if (!confirmed) {
      console.log("Initialization cancelled.");
      process.exit(0);
    }
  }

  const result = await initializeOrchid(repository, { allowNonEmptyDir });
  console.log(result.message);
  if (!result.success) {
    process.exit(1);
  }
}

export const initCommand: any = new Command()
  .description("Initialize orchid workspace with a git repository")
  .argument("<repository-url>", "Url of the git repository to clone, ex. git@github.com:simon-duchastel/orchid.git")
  .option("--dangerously-init-in-non-empty-dir", "Allow initialization in a non-empty directory (might overwrite files)")
  .action(initAction);
