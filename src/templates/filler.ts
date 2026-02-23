import { join } from "node:path";
import { readFileSync } from "node:fs";

let agentPromptTemplate: string | undefined;
let reviewerPromptTemplate: string | undefined;

function getAgentPromptTemplate(): string {
  if (!agentPromptTemplate) {
    agentPromptTemplate = readFileSync(
      join(process.cwd(), "templates", "agent-prompt.md"),
      "utf-8"
    );
  }
  return agentPromptTemplate;
}

function getReviewerPromptTemplate(): string {
  if (!reviewerPromptTemplate) {
    reviewerPromptTemplate = readFileSync(
      join(process.cwd(), "templates", "reviewer-prompt.md"),
      "utf-8"
    );
  }
  return reviewerPromptTemplate;
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

export function fillAgentPromptTemplate(data: AgentPromptData): string {
  return getAgentPromptTemplate()
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
