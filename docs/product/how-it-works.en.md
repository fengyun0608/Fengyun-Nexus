# How Fengyun Nexus Works

[中文](how-it-works.md) | English

## Is the repository connected?

Yes. This repo is linked to GitCode:

- URL: https://gitcode.com/fengyunnb_admin/Fengyun-Nexus
- Branch: `main` tracks `origin/main`

## In one sentence

The **Gateway** is the brain and entry point. The **Web console** handles chat and admin. Channels, plugins, workflows, and tools attach to the gateway and share one message model.

## Runtime skeleton

```text
Mobile / Desktop browser / Server
            │
            ▼
     Web console (chat · admin)
            │  HTTP / SSE
            ▼
           Gateway
     ┌──────┼──────────────┐
     ▼      ▼              ▼
  Channels  Session+LLM   Plugin host
  (web/webhook)           │
                          ├─ Workflow
                          └─ Tools / MCP
```

## Message path

1. User chats in Web, or an external webhook arrives  
2. Channel normalizes input into `NexusMessage`  
3. Plugins run first (e.g. `/echo`); otherwise LLM router replies  
4. Reply is stored in session and returned through the channel  

Admin auth is separate from chat: chat can work without login; admin APIs need a session token.

## Admin security rules

| Rule | Behavior |
|------|----------|
| Bootstrap account | username `console`, password `console` |
| First login | Must reconfigure username & password in the console, then **log in again** |
| Page refresh | Session **invalidates immediately** (memory-only token, not persisted) |
| Lifetime | **12 hours**, then auto-expire |
| Credential change | **All sessions invalidated** immediately; re-login required |

Credentials persist to local `configs/admin.local.json` (do not commit secrets).

## Three environments

Set `NEXUS_ENV` to `mobile`, `desktop` (default), or `server`. See `configs/env.*.json`.

## Plugins

- View loaded plugins and adapters in the single console  
- Local scaffold: `pnpm nexus create plugin`  
- Remote install internals are not documented publicly  

## Related

- [Environment & install](environment.en.md)
- [Start](start.en.md)
- [Planning](planning.md) · [Fishbone](fishbone.md) · [Directory](directory.md) · [Ecosystem](../ecosystem/plugins.en.md)
