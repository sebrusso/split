#!/bin/bash
# setup-github-token.sh
# Securely store GitHub Fine-grained PAT in macOS Keychain
#
# Usage:
#   ./scripts/setup-github-token.sh <your-github-pat>
#   ./scripts/setup-github-token.sh  # Will prompt for token

set -e

KEYCHAIN_SERVICE="claude-github-pat-splitfree"

echo "🔐 GitHub Fine-grained PAT Setup for split it."
echo "=============================================="
echo ""

# Get token from argument or prompt
if [ -n "$1" ]; then
    TOKEN="$1"
else
    echo "Enter your GitHub Fine-grained PAT:"
    echo "(Get one at: https://github.com/settings/tokens?type=beta)"
    echo ""
    read -s -p "Token: " TOKEN
    echo ""
fi

# Validate token format
if [[ ! "$TOKEN" =~ ^github_pat_ ]]; then
    echo "⚠️  Warning: Token doesn't start with 'github_pat_'"
    echo "   Make sure you're using a Fine-grained PAT, not a classic token."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if token already exists
if security find-generic-password -a "$USER" -s "$KEYCHAIN_SERVICE" &>/dev/null; then
    echo "⚠️  Token already exists in Keychain."
    read -p "Replace it? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        security delete-generic-password -a "$USER" -s "$KEYCHAIN_SERVICE" &>/dev/null
    else
        echo "Aborted."
        exit 0
    fi
fi

# Store token in Keychain
security add-generic-password \
    -a "$USER" \
    -s "$KEYCHAIN_SERVICE" \
    -w "$TOKEN" \
    -T "" \
    -U

echo ""
echo "✅ Token stored securely in macOS Keychain"
echo ""
echo "To use the token in your shell:"
echo ""
echo '  export GITHUB_TOKEN=$(security find-generic-password -a "$USER" -s "claude-github-pat-splitfree" -w)'
echo ""
echo "Or add this to your ~/.zshrc or ~/.bashrc:"
echo ""
echo '  # split it. GitHub Token'
echo '  export GITHUB_TOKEN=$(security find-generic-password -a "$USER" -s "claude-github-pat-splitfree" -w 2>/dev/null)'
echo ""
echo "To configure git to use the token:"
echo ""
echo '  git config --global credential.helper osxkeychain'
echo ""
