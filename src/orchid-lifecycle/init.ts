/**
 * Orchid Initialization
 *
 * Handles the orchid init command workflow.
 * Creates workspace structure and clones repository.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import { cloneRepository, GitOperations, defaultGitOperations } from "../git-manager.js";
import {
  getOrchidDir,
  getPidFile,
  getMainRepoDir,
  getWorktreesDir,
} from "../paths.js";
import { isInitialized as isDysonSwarmInitialized, initialize as initializeDysonSwarm } from "dyson-swarm";

/**
 * Check if a directory is empty
 *
 * @param dirPath - The path to the directory to check
 * @returns true if the directory is empty or doesn't exist, false otherwise
 */
export function isDirectoryEmpty(dirPath: string): boolean {
  if (!existsSync(dirPath)) {
    return true;
  }

  try {
    const files = readdirSync(dirPath);
    return files.length === 0;
  } catch {
    return true;
  }
}

/**
 * Result of orchid initialization
 */
export interface InitResult {
  success: boolean;
  message: string;
  cleanup?: () => void;
}

/**
 * Check if orchid is already initialized in current directory
 */
export function isOrchidInitialized(): boolean {
  const orchidDir = getOrchidDir();
  const mainRepoDir = getMainRepoDir();
  
  return existsSync(orchidDir) && 
         existsSync(mainRepoDir);
}

/**
 * Validate that orchid structure is well-formed
 */
export function validateOrchidStructure(): boolean {
  const orchidDir = getOrchidDir();
  const pidFile = getPidFile();
  const mainRepoDir = getMainRepoDir();
  const worktreesDir = getWorktreesDir();

  if (!existsSync(orchidDir)) {
    return false;
  }

  if (!existsSync(pidFile)) {
    return false;
  }

  if (!existsSync(mainRepoDir)) {
    return false;
  }

  if (!existsSync(worktreesDir)) {
    return false;
  }

  // Validate PID file contains a valid number or is empty
  try {
    const pidContent = readFileSync(pidFile, "utf-8").trim();
    if (pidContent && !/^\d+$/.test(pidContent)) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

/**
 * Create the basic orchid directory structure
 */
export function createOrchidStructure(): { success: boolean; message: string; cleanup?: () => void } {
  const orchidDir = getOrchidDir();
  const pidFile = getPidFile();
  const mainRepoDir = getMainRepoDir();
  const worktreesDir = getWorktreesDir();

  const createdPaths: string[] = [];

  try {
    // Create .orchid directory
    if (!existsSync(orchidDir)) {
      mkdirSync(orchidDir, { recursive: true });
      createdPaths.push(orchidDir);
    }

    // Create main directory
    if (!existsSync(mainRepoDir)) {
      mkdirSync(mainRepoDir, { recursive: true });
      createdPaths.push(mainRepoDir);
    }

    // Create worktrees directory
    if (!existsSync(worktreesDir)) {
      mkdirSync(worktreesDir, { recursive: true });
      createdPaths.push(worktreesDir);
    }

    // Create empty PID file
    if (!existsSync(pidFile)) {
      writeFileSync(pidFile, "", "utf-8");
      createdPaths.push(pidFile);
    }

    return {
      success: true,
      message: "Created orchid directory structure",
      cleanup: () => {
        // Cleanup on failure
        createdPaths.reverse().forEach(path => {
          try {
            if (existsSync(path)) {
              rmSync(path, { recursive: true, force: true });
            }
          } catch {
            // Ignore cleanup errors
          }
        });
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create orchid structure: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export interface InitializeOrchidOptions {
  allowNonEmptyDir?: boolean;
}

/**
 * Initialize orchid workspace
 */
export async function initializeOrchid(
  repoUrl: string,
  options: InitializeOrchidOptions = {},
  gitOps: GitOperations = defaultGitOperations
): Promise<InitResult> {
  const { allowNonEmptyDir = false } = options;

  // Check if already initialized
  if (isOrchidInitialized()) {
    return {
      success: false,
      message: "Orchid is already initialized in this directory. Use 'orchid status' to check the current state.",
    };
  }

  // Check if directory is empty (unless explicitly allowed)
  if (!allowNonEmptyDir && !isDirectoryEmpty(cwd())) {
    return {
      success: false,
      message: "Directory is not empty. Use --dangerously-init-in-non-empty-dir to proceed anyway.",
    };
  }

  // Create directory structure
  const structureResult = createOrchidStructure();
  if (!structureResult.success) {
    return {
      success: false,
      message: structureResult.message,
    };
  }

  try {
    // Check if dyson-swarm is initialized, and initialize it if not
    const dysonSwarmInitialized = await isDysonSwarmInitialized();
    if (!dysonSwarmInitialized) {
      await initializeDysonSwarm();
    }

    // Clone repository to main directory
    const mainRepoDir = getMainRepoDir();
    const cloneResult = await cloneRepository(repoUrl, mainRepoDir, gitOps);

    if (!cloneResult.success) {
      // Clean up on failure
      structureResult.cleanup?.();
      return {
        success: false,
        message: `Initialization failed: ${cloneResult.message}`,
      };
    }

    return {
      success: true,
      message: `Successfully initialized orchid with repository ${repoUrl}\nMain repository cloned to: ${mainRepoDir}\nWorktrees directory: ${getWorktreesDir()}\n\nStart the orchid daemon with: orchid up`,
    };
  } catch (error) {
    // Clean up on failure
    structureResult.cleanup?.();
    return {
      success: false,
      message: `Initialization failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
