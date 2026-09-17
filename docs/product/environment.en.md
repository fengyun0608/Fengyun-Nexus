# Environment & Installation

[← 中文](environment.md)

What you must install to run Fengyun Nexus, what is optional, and how to verify.

---

## Required (chat + admin console)

| Software | Version | Purpose | Where |
|----------|---------|---------|-------|
| **Node.js** | **≥ 20** (20/22 LTS recommended) | Gateway, Web, CLI, plugin host | [nodejs.org](https://nodejs.org/) |
| **pnpm** | **≥ 9** | Dependencies & monorepo scripts | see below |
| **Git** | Recent | Clone / push | [git-scm.com](https://git-scm.com/) |
| **Modern browser** | Chrome / Edge / Firefox | Web console | system |

### Install pnpm

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
# or: npm install -g pnpm@9
```

### Verify

```bash
node -v    # >= v20
pnpm -v    # >= 9
git --version
```

---

## First run

```bash
cd Fengyun-Nexus
pnpm install
pnpm run build:packages
pnpm dev          # gateway http://127.0.0.1:8787
pnpm dev:web      # console http://127.0.0.1:5173
```

Open `http://127.0.0.1:5173`. Admin bootstrap: `console` / `console` — then reconfigure and log in again. See [How it works](how-it-works.en.md).

---

## Three product profiles (not three OS installs)

| `NEXUS_ENV` | Meaning |
|-------------|---------|
| `desktop` | Default local desktop |
| `mobile` | Mobile-oriented Web |
| `server` | Server deployment |

```bash
# Windows
set NEXUS_ENV=desktop
# Linux/macOS
export NEXUS_ENV=server
```

Configs: `configs/env.*.json`.

---

## Environment variables (optional)

See `.env.example`.

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXUS_ENV` | No | `mobile` / `desktop` / `server` |
| `NEXUS_ADMIN_PASSWORD` | No | Debug password override |
| `NEXUS_REGISTRY_TOKEN` | No | Remote plugin registry |
| `NEXUS_LLM_API_KEY` | No | Without it, local echo replies |
| `NEXUS_LLM_BASE_URL` / `NEXUS_LLM_MODEL` | No | OpenAI-compatible API |
| `HOST` / `PORT` | No | Gateway listen override |

Local files (do not commit secrets): `configs/admin.local.json`, `configs/registry.local.json`.

---

## Optional (enhancements)

| Software | When | Purpose |
|----------|------|---------|
| **Go** | Building `workers/go-pump` | High-concurrency pump |
| **Python 3.10+** | `workers/python-tools` / UIA | Local automation |
| LLM account | Real model chat | `NEXUS_LLM_*` |
| GitCode token | Remote demo/basic/standard plugins | `NEXUS_REGISTRY_TOKEN` |

Gateway + Web work **without** Go/Python.

---

## Ports & network

- Ports: `8787` (gateway), `5173` (Vite dev)  
- Outbound: npm on first install; LLM/registry when used  

---

## Related

- [How it works](how-it-works.en.md) · [中文](how-it-works.md)  
- [Product docs](README.md) · [Ecosystem](../ecosystem/plugins.md)  
