# OneBot 11

[中文](onebot11.md) | English

Built-in **OneBot 11** channel, compatible with [NapCat](https://napneko.github.io).

| Mode | NapCat | Nexus |
|------|--------|-------|
| Reverse WS (recommended) | WS client | `ws://<host>:8787/onebot/v11/ws` |
| HTTP post | HTTP client | `POST /onebot/v11/http` |

Install NapCat from the console Environment page. Masters and AI reply groups live in channel settings. Empty per-bot access token means no token check.

Reply policy: plugin hit → plugin; AI configured → LLM (prefer one message); otherwise stay silent. Group AI needs @ or wake prefix; `#` commands always work.
