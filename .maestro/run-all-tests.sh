#!/bin/bash
# E2E Test Runner for SplitFree
#
# This script implements Plan A from E2E_TESTING_PLAN.md:
# 1. Run login flow first to establish authentication
# 2. Run all other tests with the active session
#
# Usage: bash .maestro/run-all-tests.sh [--happy|--stress|--all]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Set up Java and Maestro paths
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}SplitFree E2E Test Runner${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Parse arguments
RUN_MODE="${1:-happy}"

# Step 1: Run login flow
echo -e "${YELLOW}Step 1: Running login flow...${NC}"
if maestro test .maestro/flows/login.yaml; then
    echo -e "${GREEN}Login successful!${NC}"
    echo ""
else
    echo -e "${RED}Login failed! Aborting tests.${NC}"
    exit 1
fi

# Step 2: Run test flows based on mode
case "$RUN_MODE" in
    --happy|happy)
        echo -e "${YELLOW}Step 2: Running happy path tests...${NC}"
        echo ""

        echo -e "${YELLOW}Running: create-group-expense.yaml${NC}"
        maestro test .maestro/create-group-expense.yaml && echo -e "${GREEN}PASSED${NC}" || echo -e "${RED}FAILED${NC}"

        echo -e "${YELLOW}Running: receipt-scanning.yaml${NC}"
        maestro test .maestro/receipt-scanning.yaml && echo -e "${GREEN}PASSED${NC}" || echo -e "${RED}FAILED${NC}"

        echo -e "${YELLOW}Running: settlement-flow.yaml${NC}"
        maestro test .maestro/settlement-flow.yaml && echo -e "${GREEN}PASSED${NC}" || echo -e "${RED}FAILED${NC}"
        ;;

    --stress|stress)
        echo -e "${YELLOW}Step 2: Running stress tests...${NC}"
        echo ""

        for test_file in .maestro/stress/*.yaml; do
            echo -e "${YELLOW}Running: $(basename $test_file)${NC}"
            maestro test "$test_file" && echo -e "${GREEN}PASSED${NC}" || echo -e "${RED}FAILED${NC}"
        done
        ;;

    --all|all)
        echo -e "${YELLOW}Step 2: Running all tests (happy path + stress)...${NC}"
        echo ""

        echo -e "${YELLOW}--- Happy Path Tests ---${NC}"
        maestro test .maestro/create-group-expense.yaml && echo -e "${GREEN}PASSED${NC}" || echo -e "${RED}FAILED${NC}"
        maestro test .maestro/receipt-scanning.yaml && echo -e "${GREEN}PASSED${NC}" || echo -e "${RED}FAILED${NC}"
        maestro test .maestro/settlement-flow.yaml && echo -e "${GREEN}PASSED${NC}" || echo -e "${RED}FAILED${NC}"

        echo ""
        echo -e "${YELLOW}--- Stress Tests ---${NC}"
        for test_file in .maestro/stress/*.yaml; do
            echo -e "${YELLOW}Running: $(basename $test_file)${NC}"
            maestro test "$test_file" && echo -e "${GREEN}PASSED${NC}" || echo -e "${RED}FAILED${NC}"
        done
        ;;

    *)
        echo "Usage: $0 [--happy|--stress|--all]"
        echo ""
        echo "Options:"
        echo "  --happy   Run happy path tests only (default)"
        echo "  --stress  Run stress tests only"
        echo "  --all     Run all tests"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Test run complete!${NC}"
echo -e "${GREEN}========================================${NC}"
