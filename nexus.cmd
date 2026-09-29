@echo off
cd /d "%~dp0"
call pnpm --filter @fengyun/nexus-cli exec tsx src/index.ts %*
