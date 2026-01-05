#!/bin/bash
# rotate-github-token.sh
# Guide for rotating GitHub Fine-grained PAT
#
# Usage: ./scripts/rotate-github-token.sh

set -e

KEYCHAIN_SERVICE="claude-github-pat-splitfree"
TODAY=$(date +%Y-%m)

echo "🔄 GitHub PAT Rotation Guide for SplitFree"
echo "==========================================="
echo ""

# Check current token
if security find-generic-password -a "$USER" -s "$KEYCHAIN_SERVICE" &>/dev/null; then
    echo "✅ Current token found in Keychain"
else
    echo "⚠️  No token found in Keychain"
fi

echo ""
echo "Step 1: Create New Token"
echo "------------------------"
echo "1. Go to: https://github.com/settings/tokens?type=beta"
echo "2. Click 'Generate new token'"
echo "3. Configure:"
echo "   - Name: claude-code-splitfree-$TODAY"
echo "   - Expiration: 60 days"
echo "   - Repository: sebrusso/split only"
echo "   - Permissions:"
echo "     • Contents: Read and write"
echo "     • Pull requests: Read and write"
echo "     • Issues: Read and write"
echo "     • Actions: Read-only"
echo ""

read -p "Press Enter when you have the new token ready..."
echo ""

echo "Step 2: Update Local Token"
echo "--------------------------"
read -s -p "Paste new token: " NEW_TOKEN
echo ""

if [[ ! "$NEW_TOKEN" =~ ^github_pat_ ]]; then
    echo "⚠️  Warning: Token doesn't look like a Fine-grained PAT"
fi

# Delete old token
security delete-generic-password -a "$USER" -s "$KEYCHAIN_SERVICE" &>/dev/null || true

# Store new token
security add-generic-password \
    -a "$USER" \
    -s "$KEYCHAIN_SERVICE" \
    -w "$NEW_TOKEN" \
    -T "" \
    -U

echo "✅ Local token updated"
echo ""

echo "Step 3: Update GitHub Repository Secret"
echo "----------------------------------------"
echo "1. Go to: https://github.com/sebrusso/split/settings/secrets/actions"
echo "2. Update CLAUDE_PAT with the new token"
echo ""

read -p "Press Enter when done..."
echo ""

echo "Step 4: Update Git Remote (if using embedded token)"
echo "----------------------------------------------------"
echo "Run this command to update the remote URL:"
echo ""
echo "  git remote set-url origin https://sebrusso:\$(security find-generic-password -a \"\$USER\" -s \"$KEYCHAIN_SERVICE\" -w)@github.com/sebrusso/split.git"
echo ""

read -p "Update remote now? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    STORED_TOKEN=$(security find-generic-password -a "$USER" -s "$KEYCHAIN_SERVICE" -w)
    git remote set-url origin "https://sebrusso:${STORED_TOKEN}@github.com/sebrusso/split.git"
    echo "✅ Remote URL updated"
fi

echo ""
echo "Step 5: Revoke Old Token"
echo "------------------------"
echo "1. Go to: https://github.com/settings/tokens?type=beta"
echo "2. Find and delete the OLD token (previous month's)"
echo ""

read -p "Press Enter when done..."
echo ""

echo "✅ Token rotation complete!"
echo ""
echo "Next rotation due: $(date -v+50d +%Y-%m-%d)"
echo ""
