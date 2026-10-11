#!/usr/bin/env bash
# One-time setup. Run from the project folder:  bash scripts/setup-autodeploy.sh
# 1) Signs you in to Firebase (opens your browser)
# 2) Publishes the app and the database security rules right now
# 3) Connects GitHub so every push to main redeploys automatically
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Installing packages"
npm ci

echo "→ Signing in to Firebase (a browser window will open)"
npx --yes firebase-tools@13 login

echo "→ Building and publishing to https://vihanga-expenses.web.app"
npm run build
npx --yes firebase-tools@13 deploy --project vihanga-expenses --only hosting,firestore:rules

cat <<'MSG'

→ Connecting GitHub for automatic deploys.
  Firebase will ask a few questions. Answer:
    • GitHub repository:                     Vihangashamod/vihanga-expenses
    • Set up a build script before deploy?   Yes  →  npm ci && npm run build
    • Deploy when a PR is merged?            Yes  →  branch: main
    • Overwrite existing workflow files?     No   (the repo already has the right ones)

MSG
npx --yes firebase-tools@13 init hosting:github --project vihanga-expenses

echo "✓ Done. Every push to main now goes live at https://vihanga-expenses.web.app"
