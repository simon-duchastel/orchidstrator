import { join } from "node:path";
import { readFileSync } from "node:fs";

let agentPromptTemplate: string | undefined;
let reviewerPromptTemplate: string | undefined;
let mergerPromptTemplate: string | undefined;

function getImplementorAgentPromptTemplate(): string {
  if (!agentPromptTemplate) {
    agentPromptTemplate = readFileSync(
      join(process.cwd(), "templates", "implementor-agent-prompt.md"),
      "utf-8"
    );
  }
  return agentPromptTemplate;
}

function getReviewerPromptTemplate(): string {
  if (!reviewerPromptTemplate) {
    reviewerPromptTemplate = readFileSync(
      join(process.cwd(), "templates", "review-agent-prompt.md"),
      "utf-8"
    );
  }
  return reviewerPromptTemplate;
}

function getMergerPromptTemplate(): string {
  if (!mergerPromptTemplate) {
    mergerPromptTemplate = readFileSync(
      join(process.cwd(), "templates", "merge-agent-prompt.md"),
      "utf-8"
    );
  }
  return mergerPromptTemplate;
}

export interface AgentPromptData {
  taskTitle: string;
  taskDescription: string;
  worktreePath: string;
}

export interface ReviewerPromptData {
  taskTitle: string;
  taskDescription: string;
  worktreePath: string;
}

export interface MergerPromptData {
  taskId: string;
  worktreePath: string;
}

export function fillImplementorAgentPromptTemplate(data: AgentPromptData): string {
  return getImplementorAgentPromptTemplate()
    .replace(/\{\{taskTitle\}\}/g, data.taskTitle || "")
    .replace(/\{\{taskDescription\}\}/g, data.taskDescription || "")
    .replace(/\{\{worktreePath\}\}/g, data.worktreePath);
}

export function fillReviewerPromptTemplate(data: ReviewerPromptData): string {
  return getReviewerPromptTemplate()
    .replace(/\{\{taskTitle\}\}/g, data.taskTitle || "")
    .replace(/\{\{taskDescription\}\}/g, data.taskDescription || "")
    .replace(/\{\{worktreePath\}\}/g, data.worktreePath);
}

export function fillMergerPromptTemplate(data: MergerPromptData): string {
  return getMergerPromptTemplate()
    .replace(/\{\{taskId\}\}/g, data.taskId || "")
    .replace(/\{\{worktreePath\}\}/g, data.worktreePath);
}
