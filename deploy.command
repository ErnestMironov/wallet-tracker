#!/bin/bash
cd "$(dirname "$0")"

echo ""
echo "🔨 Building Wallet Tracker..."
pnpm build

if [ $? -ne 0 ]; then
  echo "❌ Build failed. Fix errors above and try again."
  read -p "Press Enter to close..."
  exit 1
fi

echo ""
echo "🚀 Deploying to Vercel..."
echo "   (First time: you'll be asked to log in via browser)"
echo ""
npx vercel --prod

echo ""
read -p "Press Enter to close..."
