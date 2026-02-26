import { describe, it, expect } from "vitest";
import { fillMergerPromptTemplate } from "../../templates/index.js";

describe("fillMergerPromptTemplate", () => {
  it("should correctly fill the merger prompt template", () => {
    const data = {
      taskId: "test-task-123",
      worktreePath: "/path/to/worktree",
    };

    const result = fillMergerPromptTemplate(data);

    expect(result).toBe(`# Task Merge

You are a merger agent assigned to merge completed work into the mainline. The reviewer has approved the implementation and the changes need to be merged back.

## Task ID: test-task-123

## Merge Process

Your goal is to safely merge the changes from the worktree into the mainline (main/master branch). Follow these steps carefully:

### Steps

1. **Check Current State**
   - Review the worktree at: /path/to/worktree
   - Verify you are on the correct branch
   - Check that all changes are committed

2. **Prepare Mainline**
   - Checkout the main branch (main or master)
   - Pull the latest changes to ensure you're up to date
   - Verify there are no uncommitted changes

3. **Merge Changes**
   - Merge the worktree branch into mainline
   - Resolve any merge conflicts if they arise
   - Ensure the merge is clean and complete

4. **Verify Merge**
   - Run any tests to ensure the merge didn't break anything
   - Verify the changes are present in mainline
   - Check that the worktree branch can be safely deleted

5. **Cleanup**
   - Push the merged changes to the remote
   - Optionally: delete the worktree branch (or leave it for the orchestrator to clean up)

## Working Environment

You are merging work done in: /path/to/worktree

## Output Format

After completing the merge:
- Confirm the merge was successful
- List any merge conflicts that were resolved
- Confirm all tests pass
- Report the final commit hash

Remember: Safety first. If you encounter issues you cannot resolve, report them clearly.
`);
  });
});
