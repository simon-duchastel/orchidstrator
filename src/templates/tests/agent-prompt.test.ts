import { describe, it, expect } from "vitest";
import { fillImplementorAgentPromptTemplate } from "../../templates/index.js";

describe("fillImplementorAgentPromptTemplate", () => {
  it("should correctly fill the agent prompt template", () => {
    const data = {
      taskTitle: "Test Task Title",
      taskDescription: "This is a test task description.",
      worktreePath: "/path/to/worktree",
    };

    const result = fillImplementorAgentPromptTemplate(data);

    expect(result).toBe(`# Task Implementation

You are an implementor agent assigned to work on a task. Your goal is to implement the changes described in the task.

## Test Task Title

This is a test task description.
## Instructions

1. Review the task description carefully to understand what needs to be implemented
2. Explore the codebase to understand the current structure and patterns
3. Implement the required changes following existing code conventions
4. Write tests for any new functionality
5. Ensure all existing tests pass
6. Follow best practices and maintain code quality

## Working Environment

You are working in a dedicated worktree at: /path/to/worktree

This is an isolated environment where you can safely make changes. The session will track your progress.

## Getting Started

1. First, explore the repository structure to understand the codebase
2. Look for any existing related code or patterns
3. Create a plan for implementation
4. Start implementing the changes incrementally
5. Test your changes as you go

Remember: You have full autonomy to implement this task. Make decisions that result in clean, maintainable code.
`);
  });
});
