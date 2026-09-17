import { useEffect, useState, type ReactNode } from "react";

type Panel = "chat" | "adapters" | "config" | "admin" | "ecosystem" | "status";

type Meta = {
  env: { id: string; label: string; features: Record<string, boolean>; web: { maxWidth: number } };
  admin?: { setupCompleted: boolean; sessionHours: number; refreshInvalidatesSession: boolean };
  plugins?: { available: boolean; loaded: number };
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

function TreeGroup({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`tree-group ${open ? "open" : ""}`}>
      <button type="button" className="tree-group-btn" onClick={onToggle}>
        <span className="caret">{open ? "▾" : "▸"}</span>
        <span>{title}</span>
      </button>
      {open && <div className="tree-children">{children}</div>}
    </div>
  );
}

function TreeItem({
  label,
  active,
  onClick,
  badge,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button type="button" className={`tree-item ${active ? "active" : ""}`} onClick={onClick}>
      <span>{label}</span>
      {badge ? <em>{badge}</em> : null}
    </button>
  );
}

export default function App() {
  const [panel, setPanel] = useState<Panel>("chat");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    workspace: true,
    channels: true,
    system: true,
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [channels, setChannels] = useState<string[]>([]);
  const [plugins, setPlugins] = useState<Array<{ id: string; name: string }>>([]);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "欢迎来到 Fengyun Nexus。左侧可展开目录：对话、适配器、配置、状态。" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
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
  const [envPick, setEnvPick] = useState("desktop");

  const toggleGroup = (key: string) =>
    setOpenGroups((g) => ({ ...g, [key]: !g[key] }));

  const refreshSide = async () => {
    try {
      const [m, ch, pl, h] = await Promise.all([
        api<Meta>("/v1/meta"),
        api<{ items: string[] }>("/v1/channels"),
        api<{ items: Array<{ id: string; name: string }> }>("/v1/plugins"),
        api<Record<string, unknown>>("/health"),
      ]);
      setMeta(m);
      setChannels(ch.items ?? []);
      setPlugins(pl.items ?? []);
      setHealth(h);
      setEnvPick(m.env.id);
      document.body.classList.remove("env-mobile", "env-desktop", "env-server", "env-termux");
      document.body.classList.add(`env-${m.env.id}`);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    try {
      localStorage.removeItem("nexus_admin_token");
      sessionStorage.removeItem("nexus_admin_token");
    } catch {
      /* ignore */
    }
    void refreshSide();
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
      const res = await api<{ token: string; mustReconfigure?: boolean; message?: string }>(
        "/v1/admin/login",
        {
          method: "POST",
          body: JSON.stringify({ username: user, password: pass }),
        },
      );
      setPass("");
      setToken(res.token);
      setMustReconfigure(Boolean(res.mustReconfigure));
      if (res.mustReconfigure) {
        setInfo(res.message || "请重新配置用户名与密码。");
        setPanel("admin");
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
      clearSession(res.message || "配置完成，请重新登录。");
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

  return (
    <div className={`shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <strong>Fengyun Nexus</strong>
          <span>{envLabel}</span>
        </div>

        <TreeGroup title="工作区" open={openGroups.workspace} onToggle={() => toggleGroup("workspace")}>
          <TreeItem label="对话" active={panel === "chat"} onClick={() => setPanel("chat")} />
          <TreeItem label="运行状态" active={panel === "status"} onClick={() => setPanel("status")} badge={health?.ok ? "OK" : "…"} />
          <TreeItem label="配置" active={panel === "config"} onClick={() => setPanel("config")} />
        </TreeGroup>

        <TreeGroup title="适配器 / 通道" open={openGroups.channels} onToggle={() => toggleGroup("channels")}>
          <TreeItem
            label="全部适配器"
            active={panel === "adapters"}
            onClick={() => setPanel("adapters")}
            badge={String(channels.length || 0)}
          />
          {channels.map((id) => (
            <TreeItem
              key={id}
              label={id}
              active={panel === "adapters"}
              onClick={() => setPanel("adapters")}
              badge="on"
            />
          ))}
        </TreeGroup>

        <TreeGroup title="系统" open={openGroups.system} onToggle={() => toggleGroup("system")}>
          <TreeItem label="管理登录" active={panel === "admin"} onClick={() => setPanel("admin")} />
          <TreeItem label="插件生态" active={panel === "ecosystem"} onClick={() => setPanel("ecosystem")} />
        </TreeGroup>

        <div className="sidebar-foot">
          <button type="button" className="btn ghost mini" onClick={() => void refreshSide()}>
            刷新状态
          </button>
          <button type="button" className="btn ghost mini" onClick={() => setSidebarOpen(false)}>
            收起
          </button>
        </div>
      </aside>

      {!sidebarOpen && (
        <button type="button" className="sidebar-reopen" onClick={() => setSidebarOpen(true)}>
          目录
        </button>
      )}

      <main className="workspace">
        {panel === "chat" && (
          <section className="panel chat">
            <div className="hero">
              <h1>对话</h1>
              <p>框架内聊天。可用 /echo 你好 测试插件。</p>
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

        {panel === "adapters" && (
          <section className="panel">
            <div className="hero">
              <h1>适配器</h1>
              <p>当前已注册的消息通道。后续可在此查看连接状态。</p>
            </div>
            <div className="list">
              {channels.length === 0 && <p className="muted pad">暂无通道</p>}
              {channels.map((id) => (
                <div className="list-row" key={id}>
                  <div>
                    <strong>{id}</strong>
                    <div className="muted">通道适配器</div>
                  </div>
                  <span className="badge ok">运行中</span>
                </div>
              ))}
            </div>
            <div className="hero sub">
              <h1>已加载插件</h1>
            </div>
            <div className="list">
              {plugins.map((p) => (
                <div className="list-row" key={p.id}>
                  <div>
                    <strong>{p.name}</strong>
                    <div className="muted">{p.id}</div>
                  </div>
                  <span className="badge ok">已加载</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {panel === "status" && (
          <section className="panel">
            <div className="hero">
              <h1>运行状态</h1>
              <p>网关健康检查与环境信息。</p>
            </div>
            <div className="chips">
              <div className="chip">
                健康 <strong>{health?.ok ? "正常" : "未知"}</strong>
              </div>
              <div className="chip">
                环境 <strong>{meta?.env.id ?? "…"}</strong>
              </div>
              <div className="chip">
                通道 <strong>{channels.length}</strong>
              </div>
              <div className="chip">
                插件 <strong>{plugins.length}</strong>
              </div>
            </div>
            <pre className="code-block">{JSON.stringify({ health, meta }, null, 2)}</pre>
          </section>
        )}

        {panel === "config" && (
          <section className="panel">
            <div className="hero">
              <h1>配置</h1>
              <p>
                不想改文件可用指令：<code>pnpm nexus setup</code> / <code>pnpm nexus env …</code> /
                <code>pnpm nexus set …</code>。本地配置不会上传。
              </p>
            </div>
            <div className="form">
              <label>
                当前运行姿态（只读展示；切换请用指令 nexus env）
                <select value={envPick} disabled>
                  <option value="desktop">desktop 电脑</option>
                  <option value="mobile">mobile 手机</option>
                  <option value="server">server 服务器</option>
                  <option value="termux">termux 手机 Termux</option>
                </select>
              </label>
              <p className="muted">
                会话策略：刷新立即失效 · 有效期 {sessionHours} 小时 · 改密踢全部会话
              </p>
              <p className="muted">已加载插件：{meta?.plugins?.loaded ?? plugins.length}</p>
              <button type="button" className="btn ghost" onClick={() => setPanel("admin")}>
                去管理端改账号密码
              </button>
            </div>
          </section>
        )}

        {panel === "admin" && (
          <section className="panel">
            <div className="hero">
              <h1>管理</h1>
              <p>初始 console / console。首次登录后必须重配。</p>
            </div>
            {!token ? (
              <div className="form">
                {info && <p className="muted">{info}</p>}
                <label>
                  用户名
                  <input value={user} onChange={(e) => setUser(e.target.value)} />
                </label>
                <label>
                  密码
                  <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
                </label>
                {loginErr && <div className="error">{loginErr}</div>}
                <button className="btn" onClick={() => void login()}>
                  登录
                </button>
              </div>
            ) : mustReconfigure ? (
              <div className="form">
                <p className="muted">首次配置新用户名与密码</p>
                <label>
                  新用户名
                  <input value={setupUser} onChange={(e) => setSetupUser(e.target.value)} />
                </label>
                <label>
                  新密码
                  <input type="password" value={setupPass} onChange={(e) => setSetupPass(e.target.value)} />
                </label>
                <label>
                  确认密码
                  <input value={setupPass2} type="password" onChange={(e) => setSetupPass2(e.target.value)} />
                </label>
                {loginErr && <div className="error">{loginErr}</div>}
                <button className="btn" onClick={() => void submitSetup()}>
                  保存并重新登录
                </button>
              </div>
            ) : (
              <div className="form">
                <p className="muted">已登录（内存会话）。</p>
                <button className="btn ghost" onClick={() => clearSession()}>
                  退出
                </button>
                <label>
                  当前密码
                  <input type="password" value={curPass} onChange={(e) => setCurPass(e.target.value)} />
                </label>
                <label>
                  新用户名（可空）
                  <input value={newUser} onChange={(e) => setNewUser(e.target.value)} />
                </label>
                <label>
                  新密码（可空）
                  <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
                </label>
                <label>
                  确认新密码
                  <input type="password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} />
                </label>
                {loginErr && <div className="error">{loginErr}</div>}
                <button className="btn" onClick={() => void updateCredentials()}>
                  更新凭据
                </button>
                {overview && <pre className="code-block">{JSON.stringify(overview, null, 2)}</pre>}
              </div>
            )}
          </section>
        )}

        {panel === "ecosystem" && (
          <section className="panel">
            <div className="hero">
              <h1>插件生态</h1>
              <p>在控制台扩展能力。远程安装细节不对公开展示。</p>
            </div>
            <div className="list">
              {plugins.map((p) => (
                <div className="list-row" key={p.id}>
                  <div>
                    <strong>{p.name}</strong>
                    <div className="muted">{p.id}</div>
                  </div>
                  <span className="badge ok">已加载</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
