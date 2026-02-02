# Ralph - Autonomous Development Loop

Start an autonomous development session that works through a PRD (Product Requirements Document) one story at a time, maintaining context through git history and progress logs.

Based on [snarktank/ralph](https://github.com/snarktank/ralph).

## Arguments
- `$ARGUMENTS` - Optional: "init", "status", or story number to start from

## How Ralph Works

Each iteration:
1. Read `prd.json` and `progress.txt` for context
2. Check the Codebase Patterns section for reusable knowledge
3. Select the highest-priority incomplete user story
4. Implement the story completely
5. Run quality checks (typecheck, lint, tests)
6. Commit with format: `Ralph: [Story Title] - [brief description]`
7. Update `progress.txt` with learnings
8. Mark story as complete in `prd.json`
9. Continue to next story or signal completion

## Commands

### Initialize Ralph (first time setup)
If `$ARGUMENTS` is "init" or no `prd.json` exists:

1. Create `prd.json` from user requirements:
```json
{
  "name": "Feature Name",
  "branch": "feature/branch-name",
  "stories": [
    {
      "id": 1,
      "title": "Story title",
      "description": "What needs to be done",
      "priority": 1,
      "passes": false
    }
  ]
}
```

2. Create `progress.txt`:
```
# Ralph Progress Log
Started: [timestamp]
PRD: [feature name]
Branch: [branch name]

## Codebase Patterns
<!-- Reusable patterns discovered during implementation -->

## Story Progress
<!-- Detailed progress for each story -->
```

3. Create feature branch if needed

### Check Status
If `$ARGUMENTS` is "status":
- Show PRD summary
- List completed vs remaining stories
- Show recent progress entries

### Start/Continue Ralph Loop
If no arguments or a story number:

**Before each story:**
1. Read `progress.txt` - especially the Codebase Patterns section
2. Read `prd.json` to find next incomplete story
3. Ensure on correct feature branch

**Implement the story:**
1. Understand the requirement fully
2. Make necessary code changes
3. Run quality checks:
   ```bash
   npm run typecheck && npm test
   ```
4. Fix any failures before proceeding

**After completing a story:**
1. Update `progress.txt` with:
   - Implementation details
   - Files modified
   - Learnings section (challenges, patterns, insights)
2. Add reusable patterns to Codebase Patterns section
3. Update AGENTS.md or CLAUDE.md if genuinely useful knowledge discovered
4. Commit changes:
   ```bash
   git add -A && git commit -m "Ralph: [Story Title] - [description]"
   ```
5. Mark story as `passes: true` in `prd.json`
6. Commit the prd.json update

**Completion check:**
- If all stories have `passes: true`, output: `<promise>COMPLETE</promise>`
- Otherwise, announce next story and continue

## Quality Standards

- All commits must pass typecheck and tests
- One story per iteration (don't skip ahead)
- Keep commits atomic and focused
- Document learnings for future context

## Example PRD

```json
{
  "name": "Dark Mode Support",
  "branch": "feature/dark-mode",
  "stories": [
    {
      "id": 1,
      "title": "Add theme context",
      "description": "Create React context for theme state with light/dark modes",
      "priority": 1,
      "passes": false
    },
    {
      "id": 2,
      "title": "Update color tokens",
      "description": "Add dark mode variants to theme.ts color definitions",
      "priority": 2,
      "passes": false
    },
    {
      "id": 3,
      "title": "Add theme toggle",
      "description": "Create settings toggle to switch between light/dark modes",
      "priority": 3,
      "passes": false
    }
  ]
}
```

## Files

| File | Purpose |
|------|---------|
| `prd.json` | Task list with story completion status |
| `progress.txt` | Accumulated learnings across iterations |
| `CLAUDE.md` | Project-level patterns (update if useful) |

## Tips

- Break features into small, testable stories
- Priority 1 = do first, higher numbers = later
- Each story should be completable in one iteration
- The Codebase Patterns section is your persistent memory
- When stuck, document the blocker in progress.txt and move on
