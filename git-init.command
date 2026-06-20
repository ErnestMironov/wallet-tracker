#!/bin/bash
cd "$(dirname "$0")"

echo "🗑  Cleaning any broken git state..."
rm -rf .git

echo "📦 Initialising git..."
git init
git branch -m main
git config user.email "erik1297e@gmail.com"
git config user.name "Ernest Mironov"

echo "➕ Staging all files..."
git add -A

echo "✅ Making initial commit..."
git commit -m "Initial commit — EVM wallet PnL tracker

Features:
- Multi-chain support: Base, Ethereum, Polygon, Arbitrum, Optimism
- Blockscout public APIs (no API keys required)
- Real PnL with avg cost basis (realized + unrealized)
- CoinGecko price history via range endpoint
- Spam token filter
- Profit calculator with target price chart
- PWA support (manifest, service worker, icons)
- Auto-loads last used wallet on startup"

echo ""
echo "🐙 Creating GitHub repo and pushing..."
echo "   (gh will open browser for login if needed)"
echo ""

# Install gh if missing
if ! command -v gh &>/dev/null; then
  echo "Installing GitHub CLI via Homebrew..."
  brew install gh
fi

gh repo create wallet-tracker \
  --public \
  --description "EVM wallet PnL tracker — Base, Ethereum, Polygon, Arbitrum, Optimism" \
  --source=. \
  --remote=origin \
  --push

echo ""
echo "🎉 Done! Your repo is live at:"
gh repo view --web
echo ""
read -p "Press Enter to close..."
