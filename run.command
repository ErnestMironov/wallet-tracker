#!/bin/zsh
cd "$(dirname "$0")"
rm -f pnpm-lock.yaml
pnpm install && pnpm dev
