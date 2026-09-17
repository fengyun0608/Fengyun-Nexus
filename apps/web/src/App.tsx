import { useEffect, useMemo, useState } from "react";

type Tab = "chat" | "admin" | "ecosystem";

type Meta = {
  env: { id: string; label: string; features: Record<string, boolean>; web: { maxWidth: number } };
  admin?: { setupCompleted: boolean; sessionHours: number; refreshInvalidatesSession: boolean };
  registry: { baseUrl: string; tokenConfigured: boolean; categories: Record<string, { label: string }> };
};

type Msg = { role: "user" | "assistant"; content: string };

async function api<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.token) headers.authorization = `Bearer ${init.token}`;
  const res = await fetch(path, { ...init, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || res.statusText);
  return data as T;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "欢迎来到 Fengyun Nexus（风云枢纽）。在这里对话、管理插件与通道。" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Memory-only: page refresh clears login immediately.
  const [token, setToken] = useState("");
  const [mustReconfigure, setMustReconfigure] = useState(false);
  const [user, setUser] = useState("console");
  const [pass, setPass] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [setupUser, setSetupUser] = useState("");
  const [setupPass, setSetupPass] = useState("");
  const [setupPass2, setSetupPass2] = useState("");
  const [curPass, setCurPass] = useState("");
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    // Explicitly drop any legacy persisted token from older builds.
    try {
      localStorage.removeItem("nexus_admin_token");
      sessionStorage.removeItem("nexus_admin_token");
    } catch {
      /* ignore */
    }
    api<Meta>("/v1/meta")
      .then((m) => {
        setMeta(m);
        document.body.classList.remove("env-mobile", "env-desktop", "env-server");
        document.body.classList.add(`env-${m.env.id}`);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!token || mustReconfigure) {
      setOverview(null);
      return;
    }
    api<Record<string, unknown>>("/v1/admin/overview", { token })
      .then(setOverview)
      .catch(() => {
        setToken("");
        setOverview(null);
      });
  }, [token, mustReconfigure]);

  const envLabel = meta?.env.label ?? "…";
  const sessionHours = meta?.admin?.sessionHours ?? 12;

  const send = async () => {
    const content = input.trim();
    if (!content || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content }]);
    setBusy(true);
    try {
      const res = await api<{ assistant: string }>("/v1/chat", {
        method: "POST",
        body: JSON.stringify({ content, chatId: "web-main", userId: "web-user" }),
      });
      setMsgs((m) => [...m, { role: "assistant", content: res.assistant }]);
    } catch (e) {
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: `请求失败：${e instanceof Error ? e.message : String(e)}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const clearSession = (message?: string) => {
    setToken("");
    setMustReconfigure(false);
    setOverview(null);
    if (message) setInfo(message);
  };

  const login = async () => {
    setLoginErr("");
    setInfo("");
    try {
      const res = await api<{
        token: string;
        mustReconfigure?: boolean;
        message?: string;
      }>("/v1/admin/login", {
        method: "POST",
        body: JSON.stringify({ username: user, password: pass }),
      });
      setPass("");
      setToken(res.token);
      setMustReconfigure(Boolean(res.mustReconfigure));
      if (res.mustReconfigure) {
        setInfo(res.message || "请重新配置用户名与密码，完成后需再次登录。");
        setTab("admin");
      }
    } catch (e) {
      setLoginErr(e instanceof Error ? e.message : String(e));
    }
  };

  const submitSetup = async () => {
    if (!token) return;
    setLoginErr("");
    try {
      const res = await api<{ message?: string }>("/v1/admin/setup-credentials", {
        method: "POST",
        token,
        body: JSON.stringify({
          username: setupUser,
          password: setupPass,
          confirmPassword: setupPass2,
        }),
      });
      setSetupUser("");
      setSetupPass("");
      setSetupPass2("");
      clearSession(res.message || "配置完成，请使用新凭据重新登录。");
      setUser("");
    } catch (e) {
      setLoginErr(e instanceof Error ? e.message : String(e));
    }
  };

  const updateCredentials = async () => {
    if (!token) return;
    setLoginErr("");
    try {
      const res = await api<{ message?: string }>("/v1/admin/credentials", {
        method: "POST",
        token,
        body: JSON.stringify({
          currentPassword: curPass,
          username: newUser || undefined,
          password: newPass || undefined,
          confirmPassword: newPass2 || undefined,
        }),
      });
      setCurPass("");
      setNewUser("");
      setNewPass("");
      setNewPass2("");
      clearSession(res.message || "凭据已更新，请重新登录。");
    } catch (e) {
      setLoginErr(e instanceof Error ? e.message : String(e));
    }
  };

  const cats = useMemo(() => Object.entries(meta?.registry.categories ?? {}), [meta]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <strong>Fengyun Nexus</strong>
          <span>风云枢纽 · {envLabel}</span>
        </div>
        <nav className="nav">
          <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>
            对话
          </button>
          <button className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")}>
            管理
          </button>
          <button className={tab === "ecosystem" ? "active" : ""} onClick={() => setTab("ecosystem")}>
            生态
          </button>
        </nav>
      </header>

      <main className="main">
        {tab === "chat" && (
          <section className="panel chat">
            <div className="hero">
              <h1>框架内对话</h1>
              <p>同一套会话与插件大脑，服务手机端、电脑端与服务器环境。试试发送消息，或使用 /echo 你好。</p>
            </div>
            <div className="chat-log">
              {msgs.map((m, i) => (
                <div key={i} className={`bubble ${m.role}`}>
                  {m.content}
                </div>
              ))}
            </div>
            <div className="composer">
              <textarea
                value={input}
                placeholder="输入消息…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <button className="btn" disabled={busy} onClick={() => void send()}>
                {busy ? "发送中" : "发送"}
              </button>
            </div>
          </section>
        )}

        {tab === "admin" && (
          <section className="grid-2">
            <div className="panel">
              <div className="hero">
                <h1>管理端</h1>
                <p>
                  初始账号 console / console。首次登录后必须重配用户名与密码。登录态仅内存保存：刷新页面立即失效；有效期{" "}
                  {sessionHours} 小时；改密后全部会话立即失效。
                </p>
              </div>

              {!token ? (
                <div className="form">
                  {info && <p className="muted">{info}</p>}
                  <label>
                    用户名
                    <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="console" />
                  </label>
                  <label>
                    管理密码
                    <input
                      type="password"
                      value={pass}
                      onChange={(e) => setPass(e.target.value)}
                      placeholder="初始为 console"
                    />
                  </label>
                  {loginErr && <div className="error">{loginErr}</div>}
                  <button className="btn" onClick={() => void login()}>
                    登录
                  </button>
                </div>
              ) : mustReconfigure ? (
                <div className="form">
                  <p className="muted">首次配置：请设置新的管理用户名与密码，完成后需重新登录。</p>
                  <label>
                    新用户名
                    <input value={setupUser} onChange={(e) => setSetupUser(e.target.value)} />
                  </label>
                  <label>
                    新密码（至少 8 位）
                    <input type="password" value={setupPass} onChange={(e) => setSetupPass(e.target.value)} />
                  </label>
                  <label>
                    确认新密码
                    <input type="password" value={setupPass2} onChange={(e) => setSetupPass2(e.target.value)} />
                  </label>
                  {loginErr && <div className="error">{loginErr}</div>}
                  <button className="btn" onClick={() => void submitSetup()}>
                    保存并重新登录
                  </button>
                </div>
              ) : (
                <div className="form">
                  <p className="muted">已登录（内存会话，刷新即失效）。</p>
                  <button className="btn ghost" onClick={() => clearSession()}>
                    退出
                  </button>
                  <label>
                    当前密码
                    <input type="password" value={curPass} onChange={(e) => setCurPass(e.target.value)} />
                  </label>
                  <label>
                    新用户名（可留空表示不改）
                    <input value={newUser} onChange={(e) => setNewUser(e.target.value)} />
                  </label>
                  <label>
                    新密码（可留空表示不改，至少 8 位）
                    <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
                  </label>
                  <label>
                    确认新密码
                    <input type="password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} />
                  </label>
                  {loginErr && <div className="error">{loginErr}</div>}
                  <button className="btn" onClick={() => void updateCredentials()}>
                    更新凭据（将踢出所有登录）
                  </button>
                </div>
              )}
            </div>
            <div className="panel">
              <div className="hero">
                <h1>运行概览</h1>
                <p>三环境：手机端 / 电脑端 / 服务器（NEXUS_ENV）。</p>
              </div>
              {overview ? (
                <>
                  <div className="chips">
                    <div className="chip">
                      环境 <strong>{String((overview.env as { id?: string })?.id ?? "")}</strong>
                    </div>
                    <div className="chip">
                      插件 <strong>{Array.isArray(overview.plugins) ? overview.plugins.length : 0}</strong>
                    </div>
                    <div className="chip">
                      通道 <strong>{Array.isArray(overview.channels) ? overview.channels.length : 0}</strong>
                    </div>
                    <div className="chip">
                      会话 <strong>{String(overview.sessions ?? 0)}</strong>
                    </div>
                  </div>
                  <pre style={{ margin: 0, padding: 16, overflow: "auto", fontSize: 12, color: "var(--muted)" }}>
                    {JSON.stringify(overview, null, 2)}
                  </pre>
                </>
              ) : (
                <p className="muted" style={{ padding: 18 }}>
                  {mustReconfigure ? "完成首次凭据配置并重新登录后显示概览。" : "登录后显示概览。"}
                </p>
              )}
            </div>
          </section>
        )}

        {tab === "ecosystem" && (
          <section className="panel">
            <div className="hero">
              <h1>插件生态</h1>
              <p>
                示例、基础、标准插件挂载于开源平台远程仓。当前源：
                {meta?.registry.baseUrl ?? "…"}
              </p>
            </div>
            <div className="chips">
              {cats.map(([k, v]) => (
                <div className="chip" key={k}>
                  {k} · <strong>{v.label}</strong>
                </div>
              ))}
              <div className="chip">
                Token <strong>{meta?.registry.tokenConfigured ? "已配置" : "待配置"}</strong>
              </div>
            </div>
            <p className="muted" style={{ padding: "0 18px 18px" }}>
              将通行证写入环境变量 NEXUS_REGISTRY_TOKEN（或 configs/registry.local.json）后，即可远程安装与更新。
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
