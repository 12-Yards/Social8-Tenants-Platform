#!/usr/bin/env bash
# sync-to-github.sh
# Pushes a clean snapshot of the current source to:
# https://github.com/12-Yards/Social8-Tenants-Platform
#
# Usage: bash scripts/sync-to-github.sh
# Requires: GITHUB_PERSONAL_ACCESS_TOKEN environment variable

set -e

REPO_URL="https://github.com/12-Yards/Social8-Tenants-Platform.git"
SYNC_DIR="/tmp/github-sync-social8"
WORKSPACE="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
  echo "ERROR: GITHUB_PERSONAL_ACCESS_TOKEN is not set."
  echo "Set it with: export GITHUB_PERSONAL_ACCESS_TOKEN=your_token"
  exit 1
fi

echo "==> Preparing clean snapshot..."
rm -rf "$SYNC_DIR"
mkdir -p "$SYNC_DIR"

tar \
  --exclude='./.git' \
  --exclude='./.next' \
  --exclude='./node_modules' \
  --exclude='./dist' \
  --exclude='./*.tar.gz' \
  --exclude='./.tmp_*' \
  --exclude='./server/public' \
  --exclude='./.local' \
  --exclude='./attached_assets' \
  -cf - -C "$WORKSPACE" . | tar -xf - -C "$SYNC_DIR"

echo "==> Files copied: $(find "$SYNC_DIR" -type f | wc -l)"

echo "==> Initialising fresh git repo..."
cd "$SYNC_DIR"
git init -q
git config user.email "sync@replit"
git config user.name "Replit Sync"

echo "==> Staging all files..."
git add -A

TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M UTC")
git commit -q -m "Sync from Replit — $TIMESTAMP"

echo "==> Pushing to GitHub..."
git remote add origin "https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@${REPO_URL#https://}"
git branch -M main
git push --force -u origin main

echo ""
echo "Done! Code is live at https://github.com/12-Yards/Social8-Tenants-Platform"
