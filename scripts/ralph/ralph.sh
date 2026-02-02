#!/bin/bash
#
# Ralph - Autonomous Development Loop for Claude Code
# Based on https://github.com/snarktank/ralph
#
# Usage: ./scripts/ralph/ralph.sh [max_iterations]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MAX_ITERATIONS=${1:-10}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Files
PRD_FILE="$PROJECT_ROOT/prd.json"
PROGRESS_FILE="$PROJECT_ROOT/progress.txt"
ARCHIVE_DIR="$PROJECT_ROOT/.ralph-archive"

print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}          ${YELLOW}🤖 Ralph Iteration $1 of $MAX_ITERATIONS${NC}          ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

check_requirements() {
    if ! command -v claude &> /dev/null; then
        echo -e "${RED}Error: Claude Code CLI not found${NC}"
        echo "Install with: npm install -g @anthropic-ai/claude-code"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        echo -e "${RED}Error: jq not found${NC}"
        echo "Install with: brew install jq"
        exit 1
    fi

    if [ ! -f "$PRD_FILE" ]; then
        echo -e "${YELLOW}No prd.json found. Starting Ralph in init mode...${NC}"
        echo ""
        cd "$PROJECT_ROOT"
        claude --print "/ralph init"
        exit 0
    fi
}

get_prd_branch() {
    jq -r '.branch // "main"' "$PRD_FILE"
}

get_incomplete_count() {
    jq '[.stories[] | select(.passes != true)] | length' "$PRD_FILE"
}

get_next_story() {
    jq -r '[.stories[] | select(.passes != true)] | sort_by(.priority) | .[0].title // "None"' "$PRD_FILE"
}

archive_previous_run() {
    local current_branch=$(get_prd_branch)

    if [ -f "$PROGRESS_FILE" ]; then
        local prev_branch=$(grep "^Branch:" "$PROGRESS_FILE" | head -1 | cut -d: -f2 | xargs)

        if [ "$prev_branch" != "$current_branch" ] && [ -n "$prev_branch" ]; then
            echo -e "${BLUE}Archiving previous run for branch: $prev_branch${NC}"
            mkdir -p "$ARCHIVE_DIR"
            local timestamp=$(date +%Y%m%d_%H%M%S)
            local archive_path="$ARCHIVE_DIR/${prev_branch//\//_}_$timestamp"
            mkdir -p "$archive_path"
            cp "$PRD_FILE" "$archive_path/" 2>/dev/null || true
            cp "$PROGRESS_FILE" "$archive_path/" 2>/dev/null || true
        fi
    fi
}

init_progress_file() {
    if [ ! -f "$PROGRESS_FILE" ]; then
        local prd_name=$(jq -r '.name // "Unnamed Feature"' "$PRD_FILE")
        local branch=$(get_prd_branch)

        cat > "$PROGRESS_FILE" << EOF
# Ralph Progress Log
Started: $(date)
PRD: $prd_name
Branch: $branch

## Codebase Patterns
<!-- Reusable patterns discovered during implementation -->
<!-- Add patterns here that future iterations should know about -->

## Story Progress
<!-- Detailed progress for each story -->

EOF
        echo -e "${GREEN}Created progress.txt${NC}"
    fi
}

# Main execution
echo -e "${CYAN}"
echo "  ____       _       _     "
echo " |  _ \ __ _| |_ __ | |__  "
echo " | |_) / _\` | | '_ \| '_ \ "
echo " |  _ < (_| | | |_) | | | |"
echo " |_| \_\__,_|_| .__/|_| |_|"
echo "              |_|          "
echo -e "${NC}"
echo -e "${YELLOW}Autonomous Development Loop for Claude Code${NC}"
echo ""

check_requirements
archive_previous_run
init_progress_file

cd "$PROJECT_ROOT"

# Ensure on correct branch
EXPECTED_BRANCH=$(get_prd_branch)
CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]; then
    echo -e "${YELLOW}Switching to branch: $EXPECTED_BRANCH${NC}"
    git checkout "$EXPECTED_BRANCH" 2>/dev/null || git checkout -b "$EXPECTED_BRANCH"
fi

# Main loop
for i in $(seq 1 $MAX_ITERATIONS); do
    print_header $i

    INCOMPLETE=$(get_incomplete_count)
    NEXT_STORY=$(get_next_story)

    if [ "$INCOMPLETE" -eq 0 ]; then
        echo -e "${GREEN}✅ All stories complete!${NC}"
        echo ""
        echo -e "${GREEN}<promise>COMPLETE</promise>${NC}"
        exit 0
    fi

    echo -e "${BLUE}Remaining stories: $INCOMPLETE${NC}"
    echo -e "${BLUE}Next story: $NEXT_STORY${NC}"
    echo ""

    # Run Claude Code with the ralph skill
    # Using --print to show output, --dangerously-skip-permissions for automation
    RESULT=$(claude --print --dangerously-skip-permissions "/ralph" 2>&1) || true

    echo "$RESULT"

    # Check for completion signal
    if echo "$RESULT" | grep -q "<promise>COMPLETE</promise>"; then
        echo ""
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║              🎉 Ralph Complete! All stories done.          ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
        exit 0
    fi

    # Check for explicit failure
    if echo "$RESULT" | grep -q "<promise>BLOCKED</promise>"; then
        echo ""
        echo -e "${RED}⚠️  Ralph is blocked. Check progress.txt for details.${NC}"
        exit 1
    fi

    # Brief pause between iterations
    if [ $i -lt $MAX_ITERATIONS ]; then
        echo ""
        echo -e "${YELLOW}Pausing before next iteration...${NC}"
        sleep 2
    fi
done

echo ""
echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║     Max iterations reached. Review progress.txt           ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Remaining stories: $(get_incomplete_count)"
exit 1
