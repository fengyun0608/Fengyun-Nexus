# OneBot 11

[中文](onebot11.md) | English

Fengyun Nexus ships a built-in **OneBot 11** channel compatible with [NapCat](https://napneko.github.io).

## Connect

| Mode | NapCat | Nexus |
|------|--------|-------|
| Reverse WS (recommended) | WebSocket Client | `ws://127.0.0.1:8787/onebot/v11/ws` |
| HTTP report | HTTP Client | `POST /onebot/v11/http` |

Console → **Message Channels → OneBot 11 Lab**.

## Reply policy

Plugin hit → plugin reply. AI configured → LLM. **Otherwise no reply** (no local echo).
