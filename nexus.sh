#!/usr/bin/env bash
# 薄封装：./nexus.sh start|stop|logs|desk|…
set -e
cd "$(dirname "$0")"
exec pnpm --filter @fengyun/nexus-cli start -- "$@"
