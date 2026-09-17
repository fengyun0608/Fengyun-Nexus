import { useEffect, useState, type ReactNode } from "react";
import { FloatModal } from "./components/FloatModal";
import { RawBlock } from "./components/RawBlock";
import {
  BRAND,
  type Locale,
  channelHint,
  channelLabel,
  envLabel,
  readLocale,
  t,
  writeLocale,
} from "./i18n";

const TOKEN_KEY = "nexus_admin_token";

type Panel =
  | "chat"
  | "channels"
  | "channel-detail"
  | "onebot"
  | "workflows"
  | "mcp"
  | "database"
  | "plugins"
  | "plugin-config"
  | "registry"
  | "ai"
  | "logs"
  | "status"
  | "config"
  | "admin";

type Meta = {
  env: { id: string; label: string; features: Record<string, boolean>; web: { maxWidth: number } };
  admin?: { setupCompleted: boolean; sessionHours: number; refreshInvalidatesSession: boolean };
  plugins?: { available: boolean; loaded: number };
  db?: { messages: number; plugins: number; kv: number };
};

type ChannelItem = {
  id: string;
  label?: string;
  masters?: string[];
  onlyMasters?: boolean;
};
type PluginItem = {
  id: string;
  name: string;
  version?: string;
  category?: string;
  configSupported?: boolean;
  enabled?: boolean;
};
type ChannelSettings = {
  label?: string;
  masters: string[];
  onlyMasters: boolean;
  note?: string;
};
type PluginConfigField = {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select" | "password";
  description?: string;
  options?: Array<{ value: string; label: string }>;
  default?: unknown;
};
type PluginConfigRes = {
  ok?: boolean;
  id?: string;
  supported?: boolean;
  message?: string;
  schema?: PluginConfigField[];
  values?: Record<string, unknown>;
};
type WorkflowItem = { id: string; name: string };
type McpItem = { name: string; description?: string };
type Msg = { role: "user" | "assistant"; content: string };
type RegistryInfo = {
  baseUrl?: string;
  tokenConfigured?: boolean;
  tokenEnv?: string;
  categories?: Array<{ id: string; label: string; path: string }>;
};
type LlmInfo = {
  hasKey?: boolean;
  apiKeyMasked?: string;
  baseUrl?: string;
  model?: string;
  activeId?: string;
  providers?: Array<{
    id: string;
    name: string;
    category: string;
    baseUrl: string;
    model: string;
    hasKey: boolean;
    apiKeyMasked: string;
  }>;
};
type LogItem = { at: string; level: string; message: string };
type DbDetectItem = {
  id: string;
  label: string;
  available: boolean;
  reason?: string;
  recommended?: boolean;
};
type DbInfo = {
  active?: string;
  info?: { driver?: string; filePath?: string; persistent?: boolean; engine?: string };
  stats?: { messages?: number; plugins?: number; kv?: number };
  backends?: Array<{ id: string; enabled: boolean; label: string; path?: string }>;
  items?: DbDetectItem[];
  message?: string;
};
type OneBotInfo = {
  enabled?: boolean;
  connected?: boolean;
  clients?: number;
  selfId?: string;
  reverseWsPath?: string;
  httpPath?: string;
  docsUrl?: string;
  accessTokenSet?: boolean;
  lastEventAt?: string;
  config?: {
    enabled?: boolean;
    accessToken?: string;
    reverseWsPath?: string;
    httpPath?: string;
  };
};

function readStoredToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function api<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.token) headers.authorization = `Bearer ${init.token}`;
  const res = await fetch(path, { ...init, headers });
  const data = await res.json();
  if (!res.ok) {
    const tip = data.error || data.message || res.statusText;
    const hint = data.hint ? `（${data.hint}）` : "";
    throw new Error(`${tip}${hint}`);
  }
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
  const [locale, setLocale] = useState<Locale>(() => readLocale());
  const [panel, setPanel] = useState<Panel>("chat");
  const [activeChannelId, setActiveChannelId] = useState<string>("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    usage: true,
    database: true,
    settings: true,
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [activePluginId, setActivePluginId] = useState("");
  const [pluginCfg, setPluginCfg] = useState<PluginConfigRes | null>(null);
  const [pluginCfgDraft, setPluginCfgDraft] = useState<Record<string, unknown>>({});
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [mcpTools, setMcpTools] = useState<McpItem[]>([]);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [authChecking, setAuthChecking] = useState(true);
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
  const [adminUser, setAdminUser] = useState("");
  const [registryInfo, setRegistryInfo] = useState<RegistryInfo | null>(null);
  const [llmInfo, setLlmInfo] = useState<LlmInfo | null>(null);
  const [llmKey, setLlmKey] = useState("");
  const [llmUrl, setLlmUrl] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [publishPluginId, setPublishPluginId] = useState("");
  const [publishCategory, setPublishCategory] = useState("demo");
  const [actionMsg, setActionMsg] = useState("");
  const [wfBusy, setWfBusy] = useState("");
  const [wfResult, setWfResult] = useState<unknown>(null);
  const [onebotInfo, setOnebotInfo] = useState<OneBotInfo | null>(null);
  const [obEnabled, setObEnabled] = useState(true);
  const [obToken, setObToken] = useState("");
  const [obWsPath, setObWsPath] = useState("/onebot/v11/ws");
  const [obHttpPath, setObHttpPath] = useState("/onebot/v11/http");
  const [logItems, setLogItems] = useState<LogItem[]>([]);
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [dbDetect, setDbDetect] = useState<DbDetectItem[]>([]);
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [dbDetecting, setDbDetecting] = useState(false);
  const [dbPick, setDbPick] = useState("");
  const [dbPath, setDbPath] = useState("");
  const [editProviderId, setEditProviderId] = useState("");
  const [chMasters, setChMasters] = useState("");
  const [chOnlyMasters, setChOnlyMasters] = useState(false);
  const [chNote, setChNote] = useState("");

  const tr = (key: string, vars?: Record<string, string | number>) => t(locale, key, vars);

  const changeLocale = (next: Locale) => {
    setLocale(next);
    writeLocale(next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    setMsgs((prev) => {
      if (prev.length === 1 && prev[0]?.role === "assistant") {
        return [{ role: "assistant", content: t(next, "welcome") }];
      }
      return prev;
    });
  };

  const toggleGroup = (key: string) =>
    setOpenGroups((g) => ({ ...g, [key]: !g[key] }));

  const applyToken = (next: string) => {
    setToken(next);
    writeStoredToken(next);
  };

  const refreshSide = async () => {
    try {
      const [m, ch, pl, h, wf, mcp] = await Promise.all([
        api<Meta>("/v1/meta"),
        api<{ items: ChannelItem[] }>("/v1/channels"),
        api<{ items: PluginItem[] }>("/v1/plugins"),
        api<Record<string, unknown>>("/health"),
        api<{ items: WorkflowItem[] }>("/v1/workflows"),
        api<{ items: McpItem[] }>("/v1/mcp/tools"),
      ]);
      setMeta(m);
      setChannels(ch.items ?? []);
      setPlugins(pl.items ?? []);
      setHealth(h);
      setWorkflows(wf.items ?? []);
      setMcpTools(mcp.items ?? []);
      setEnvPick(m.env.id);
      document.body.classList.remove("env-mobile", "env-desktop", "env-server", "env-termux");
      document.body.classList.add(`env-${m.env.id}`);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    setMsgs([{ role: "assistant", content: tr("welcome") }]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshSide();
      const saved = readStoredToken();
      if (!saved) {
        if (!cancelled) setAuthChecking(false);
        return;
      }
      try {
        const me = await api<{
          user?: string;
          mustReconfigure?: boolean;
        }>("/v1/admin/me", { token: saved });
        if (cancelled) return;
        setToken(saved);
        setAdminUser(me.user ?? "");
        setMustReconfigure(Boolean(me.mustReconfigure));
        if (me.mustReconfigure) setPanel("admin");
      } catch {
        writeStoredToken("");
        if (!cancelled) {
          setToken("");
          setInfo(t(readLocale(), "sessionExpired"));
        }
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token || mustReconfigure) {
      setOverview(null);
      return;
    }
    api<Record<string, unknown>>("/v1/admin/overview", { token })
      .then(setOverview)
      .catch(() => {
        applyToken("");
        setOverview(null);
        setInfo(tr("sessionExpired"));
      });
    api<RegistryInfo>("/v1/registry", { token })
      .then((r) => {
        setRegistryInfo(r);
        if (r.categories?.[0]?.id) setPublishCategory(r.categories[0].id);
      })
      .catch(() => setRegistryInfo(null));
    api<LlmInfo>("/v1/admin/llm", { token })
      .then((r) => {
        setLlmInfo(r);
        setEditProviderId(r.activeId || "");
        const cur = r.providers?.find((p) => p.id === r.activeId);
        setLlmUrl(cur?.baseUrl ?? r.baseUrl ?? "");
        setLlmModel(cur?.model ?? r.model ?? "");
      })
      .catch(() => setLlmInfo(null));
    api<{ items: LogItem[] }>("/v1/logs?limit=150", { token })
      .then((r) => setLogItems(r.items ?? []))
      .catch(() => setLogItems([]));
    api<DbInfo>("/v1/admin/db", { token })
      .then(setDbInfo)
      .catch(() => setDbInfo(null));
    api<OneBotInfo>("/v1/channels/onebot11", { token })
      .then((r) => {
        setOnebotInfo(r);
        setObEnabled(r.enabled !== false);
        setObWsPath(r.reverseWsPath || r.config?.reverseWsPath || "/onebot/v11/ws");
        setObHttpPath(r.httpPath || r.config?.httpPath || "/onebot/v11/http");
        setObToken(r.config?.accessToken ?? "");
      })
      .catch(() => setOnebotInfo(null));
  }, [token, mustReconfigure]);

  const sessionHours = meta?.admin?.sessionHours ?? 12;
  const displayEnv = envLabel(locale, meta?.env.id ?? envPick, meta?.env.label);
  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const hint = activeChannelId ? channelHint(locale, activeChannelId) : null;

  const openChannel = (id: string) => {
    setActiveChannelId(id);
    setPanel("channel-detail");
    setActionMsg("");
    void loadChannelSettings(id);
    if (id === "onebot11") void refreshOnebot();
  };

  const loadChannelSettings = async (id: string) => {
    if (!token) {
      setChMasters("");
      setChOnlyMasters(false);
      setChNote("");
      return;
    }
    try {
      const res = await api<{ settings: ChannelSettings }>(
        `/v1/channels/${encodeURIComponent(id)}/settings`,
        { token },
      );
      setChMasters((res.settings.masters ?? []).join(", "));
      setChOnlyMasters(Boolean(res.settings.onlyMasters));
      setChNote(res.settings.note ?? "");
    } catch {
      setChMasters("");
      setChOnlyMasters(false);
      setChNote("");
    }
  };

  const saveChannelSettings = async () => {
    if (!token || !activeChannelId) return;
    setActionMsg("");
    try {
      const res = await api<{ message?: string; settings?: ChannelSettings }>(
        `/v1/channels/${encodeURIComponent(activeChannelId)}/settings`,
        {
          method: "PUT",
          token,
          body: JSON.stringify({
            masters: chMasters,
            onlyMasters: chOnlyMasters,
            note: chNote,
          }),
        },
      );
      setActionMsg(res.message || tr("saveOk"));
      if (res.settings) {
        setChMasters((res.settings.masters ?? []).join(", "));
        setChOnlyMasters(Boolean(res.settings.onlyMasters));
        setChNote(res.settings.note ?? "");
      }
      void refreshSide();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const setPluginEnabled = async (id: string, enabled: boolean) => {
    if (!token) {
      setInfo(tr("needLogin"));
      return;
    }
    setActionMsg("");
    try {
      const res = await api<{ message?: string; items?: PluginItem[] }>(
        `/v1/plugins/${encodeURIComponent(id)}/${enabled ? "enable" : "disable"}`,
        { method: "POST", token },
      );
      if (res.items) setPlugins(res.items);
      else void refreshSide();
      setActionMsg(res.message || tr("saveOk"));
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

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
        {
          role: "assistant",
          content: tr("requestFailed", { msg: e instanceof Error ? e.message : String(e) }),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const clearSession = (message?: string) => {
    applyToken("");
    setMustReconfigure(false);
    setOverview(null);
    setAdminUser("");
    if (message) setInfo(message);
  };

  const login = async () => {
    setLoginErr("");
    setInfo("");
    try {
      const res = await api<{
        token: string;
        username?: string;
        mustReconfigure?: boolean;
        message?: string;
      }>("/v1/admin/login", {
        method: "POST",
        body: JSON.stringify({ username: user, password: pass }),
      });
      setPass("");
      applyToken(res.token);
      setAdminUser(res.username ?? user);
      setMustReconfigure(Boolean(res.mustReconfigure));
      if (res.mustReconfigure) {
        setInfo(res.message || tr("setPermanent"));
        setPanel("admin");
      }
      void refreshSide();
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
      clearSession(res.message || tr("setupDone"));
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
      clearSession(res.message || tr("credsUpdated"));
    } catch (e) {
      setLoginErr(e instanceof Error ? e.message : String(e));
    }
  };

  const runWorkflow = async (id: string) => {
    if (!token) return;
    setWfBusy(id);
    setWfResult(null);
    setActionMsg("");
    try {
      const res = await api<unknown>(`/v1/workflows/${id}/run`, {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
      setWfResult(res);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setWfBusy("");
    }
  };

  const saveLlm = async (clearKey = false) => {
    if (!token) return;
    setActionMsg("");
    try {
      const res = await api<LlmInfo & { message?: string }>("/v1/admin/llm", {
        method: "POST",
        token,
        body: JSON.stringify({
          id: editProviderId || llmInfo?.activeId,
          apiKey: clearKey ? undefined : llmKey || undefined,
          baseUrl: llmUrl,
          model: llmModel,
          clearKey,
          activate: true,
        }),
      });
      setLlmInfo(res);
      setLlmKey("");
      setEditProviderId(res.activeId || editProviderId);
      setActionMsg(res.message || tr("saveOk"));
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const switchProvider = async (id: string) => {
    if (!token) return;
    setActionMsg("");
    try {
      const res = await api<LlmInfo & { message?: string }>("/v1/admin/llm/switch", {
        method: "POST",
        token,
        body: JSON.stringify({ id }),
      });
      setLlmInfo(res);
      setEditProviderId(id);
      const cur = res.providers?.find((p) => p.id === id);
      setLlmUrl(cur?.baseUrl ?? "");
      setLlmModel(cur?.model ?? "");
      setActionMsg(res.message || tr("saveOk"));
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const switchDb = async (id: string, path?: string) => {
    if (!token) return;
    setActionMsg("");
    try {
      const res = await api<DbInfo & { message?: string }>("/v1/admin/db/switch", {
        method: "POST",
        token,
        body: JSON.stringify({ id, path: path || undefined }),
      });
      setDbInfo(res);
      setActionMsg(res.message || tr("saveOk"));
      setDbModalOpen(false);
      void refreshSide();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const openDbSwitchModal = async () => {
    if (!token) {
      setInfo(tr("needLogin"));
      return;
    }
    setDbModalOpen(true);
    setDbDetecting(true);
    setActionMsg("");
    try {
      const res = await api<DbInfo>("/v1/admin/db/detect", { token });
      setDbDetect(res.items ?? []);
      setDbInfo((prev) => ({ ...prev, ...res }));
      const pick = res.active || res.items?.find((d) => d.recommended)?.id || "sqlite";
      setDbPick(pick);
      const backend = res.backends?.find((b) => b.id === pick);
      setDbPath(backend?.path ?? "");
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setDbDetecting(false);
    }
  };

  const openPluginConfig = async (id: string) => {
    setActivePluginId(id);
    setPanel("plugin-config");
    setActionMsg("");
    setPluginCfg(null);
    if (!token) {
      setPluginCfg({ supported: false, message: tr("needLogin") });
      return;
    }
    try {
      const res = await api<PluginConfigRes>(`/v1/plugins/${encodeURIComponent(id)}/config`, {
        token,
      });
      setPluginCfg(res);
      setPluginCfgDraft({ ...(res.values ?? {}) });
    } catch (e) {
      setPluginCfg({
        supported: false,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const savePluginConfig = async () => {
    if (!token || !activePluginId) return;
    setActionMsg("");
    try {
      const res = await api<{ message?: string; values?: Record<string, unknown> }>(
        `/v1/plugins/${encodeURIComponent(activePluginId)}/config`,
        {
          method: "PUT",
          token,
          body: JSON.stringify(pluginCfgDraft),
        },
      );
      setActionMsg(res.message || tr("saveOk"));
      if (res.values) setPluginCfgDraft(res.values);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const refreshLogs = async () => {
    if (!token) return;
    try {
      const r = await api<{ items: LogItem[] }>("/v1/logs?limit=150", { token });
      setLogItems(r.items ?? []);
    } catch {
      /* ignore */
    }
  };

  const publishPlugin = async () => {
    if (!token || !publishPluginId) return;
    setActionMsg("");
    try {
      const res = await api<{ message?: string }>("/v1/registry/publish", {
        method: "POST",
        token,
        body: JSON.stringify({ pluginId: publishPluginId, category: publishCategory }),
      });
      setActionMsg(res.message || tr("saveOk"));
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const saveOnebot = async () => {
    if (!token) return;
    setActionMsg("");
    try {
      const res = await api<OneBotInfo & { message?: string }>("/v1/channels/onebot11/config", {
        method: "POST",
        token,
        body: JSON.stringify({
          enabled: obEnabled,
          accessToken: obToken,
          reverseWsPath: obWsPath,
          httpPath: obHttpPath,
        }),
      });
      setOnebotInfo(res);
      setActionMsg(res.message || tr("saveOk"));
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const refreshOnebot = async () => {
    if (!token) return;
    try {
      const r = await api<OneBotInfo>("/v1/channels/onebot11", { token });
      setOnebotInfo(r);
    } catch {
      /* ignore */
    }
  };

  if (authChecking) {
    return (
      <div className="gate">
        <div className="gate-card">
          <div className="gate-brand">
            <strong>{BRAND}</strong>
            <span>{tr("restoring")}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="gate">
        <div className="gate-card">
          <div className="gate-brand">
            <strong>{BRAND}</strong>
            <span>{displayEnv}</span>
          </div>
          <p className="gate-lead">{tr("signInLead")}</p>
          {info && <p className="muted">{info}</p>}
          <div className="form">
            <label>
              {tr("username")}
              <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void login()}
                autoComplete="username"
              />
            </label>
            <label>
              {tr("password")}
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void login()}
                autoComplete="current-password"
              />
            </label>
            {loginErr && <div className="error">{loginErr}</div>}
            <button className="btn" type="button" onClick={() => void login()}>
              {tr("signIn")}
            </button>
          </div>
          <p className="muted gate-hint">{tr("defaultCreds")}</p>
        </div>
      </div>
    );
  }

  if (mustReconfigure) {
    return (
      <div className="gate">
        <div className="gate-card">
          <div className="gate-brand">
            <strong>{BRAND}</strong>
            <span>{tr("firstSetup")}</span>
          </div>
          <p className="gate-lead">{tr("firstSetupLead")}</p>
          <div className="form">
            <label>
              {tr("newUsername")}
              <input value={setupUser} onChange={(e) => setSetupUser(e.target.value)} />
            </label>
            <label>
              {tr("newPassword")}
              <input type="password" value={setupPass} onChange={(e) => setSetupPass(e.target.value)} />
            </label>
            <label>
              {tr("confirmPassword")}
              <input
                type="password"
                value={setupPass2}
                onChange={(e) => setSetupPass2(e.target.value)}
              />
            </label>
            {loginErr && <div className="error">{loginErr}</div>}
            <button className="btn" type="button" onClick={() => void submitSetup()}>
              {tr("saveRelogin")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <strong>{BRAND}</strong>
          <span>{displayEnv}</span>
        </div>

        <TreeGroup
          title={tr("usage")}
          open={openGroups.usage}
          onToggle={() => toggleGroup("usage")}
        >
          <TreeItem label={tr("chat")} active={panel === "chat"} onClick={() => setPanel("chat")} />
          <TreeItem
            label={tr("allChannels")}
            active={panel === "channels"}
            onClick={() => setPanel("channels")}
            badge={String(channels.length || 0)}
          />
          {channels.map((c) => (
            <TreeItem
              key={c.id}
              label={channelLabel(locale, c.id, c.label)}
              active={panel === "channel-detail" && activeChannelId === c.id}
              onClick={() => openChannel(c.id)}
              badge={c.id === "onebot11" && onebotInfo?.connected ? "ON" : "on"}
            />
          ))}
          <TreeItem
            label={tr("workflows")}
            active={panel === "workflows"}
            onClick={() => setPanel("workflows")}
            badge={String(workflows.length)}
          />
          <TreeItem
            label={tr("mcpTools")}
            active={panel === "mcp"}
            onClick={() => setPanel("mcp")}
            badge={String(mcpTools.length)}
          />
          <TreeItem
            label={tr("status")}
            active={panel === "status"}
            onClick={() => setPanel("status")}
            badge={health?.ok ? "OK" : "…"}
          />
        </TreeGroup>

        <TreeGroup
          title={tr("database")}
          open={openGroups.database}
          onToggle={() => toggleGroup("database")}
        >
          <TreeItem
            label={tr("dbCurrent")}
            active={panel === "database" || dbModalOpen}
            onClick={() => {
              setPanel("database");
              void openDbSwitchModal();
            }}
            badge={dbInfo?.info?.driver ?? dbInfo?.active ?? "…"}
          />
        </TreeGroup>

        <TreeGroup
          title={tr("settings")}
          open={openGroups.settings}
          onToggle={() => toggleGroup("settings")}
        >
          <TreeItem
            label={tr("pluginManage")}
            active={panel === "plugins" || panel === "plugin-config"}
            onClick={() => {
              setActionMsg("");
              setPanel("plugins");
            }}
            badge={String(plugins.length)}
          />
          <TreeItem
            label={tr("pluginUpdate")}
            active={panel === "registry"}
            onClick={() => {
              setActionMsg("");
              setPanel("registry");
              if (!publishPluginId && plugins[0]?.id) setPublishPluginId(plugins[0].id);
            }}
          />
          <TreeItem
            label={tr("aiProvider")}
            active={panel === "ai"}
            onClick={() => {
              setActionMsg("");
              setPanel("ai");
            }}
          />
          <TreeItem
            label={tr("logs")}
            active={panel === "logs"}
            onClick={() => {
              setPanel("logs");
              void refreshLogs();
            }}
            badge={String(logItems.length || "…")}
          />
          <TreeItem label={tr("config")} active={panel === "config"} onClick={() => setPanel("config")} />
          <TreeItem label={tr("admin")} active={panel === "admin"} onClick={() => setPanel("admin")} />
        </TreeGroup>

        <div className="sidebar-foot">
          <button type="button" className="btn ghost mini" onClick={() => void refreshSide()}>
            {tr("refresh")}
          </button>
          <button type="button" className="btn ghost mini" onClick={() => setSidebarOpen(false)}>
            {tr("collapse")}
          </button>
        </div>
      </aside>

      {!sidebarOpen && (
        <button type="button" className="sidebar-reopen" onClick={() => setSidebarOpen(true)}>
          {tr("menu")}
        </button>
      )}

      <main className="workspace">
        {panel === "chat" && (
          <section className="panel chat">
            <div className="hero">
              <h1>{tr("chat")}</h1>
              <p>{tr("chatHero")}</p>
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
                placeholder={tr("typeMessage")}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <button className="btn" disabled={busy} onClick={() => void send()}>
                {busy ? tr("sending") : tr("send")}
              </button>
            </div>
          </section>
        )}

        {panel === "channels" && (
          <section className="panel">
            <div className="hero">
              <h1>{tr("channels")}</h1>
              <p>{tr("channelsHero")}</p>
            </div>
            <div className="list">
              {channels.length === 0 && <p className="muted pad">{tr("noChannels")}</p>}
              {channels.map((c) => (
                <button
                  type="button"
                  className="list-row list-row-btn"
                  key={c.id}
                  onClick={() => openChannel(c.id)}
                >
                  <div>
                    <strong>{channelLabel(locale, c.id, c.label)}</strong>
                    <div className="muted">
                      {c.id} · {tr("openBaseline")}
                    </div>
                  </div>
                  <span className="badge ok">{tr("online")}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {panel === "channel-detail" && activeChannel && (
          <section className="panel">
            <div className="hero">
              <h1>{channelLabel(locale, activeChannel.id, activeChannel.label)}</h1>
              <p>
                {tr("channelId")}: <code>{activeChannel.id}</code>. {tr("channelSettingsHero")}
              </p>
            </div>
            <div className="form">
              <div className="hero sub">
                <h1>{tr("channelSettings")}</h1>
              </div>
              <p className="muted">{tr("channelSettingsHint")}</p>
              <label>
                {tr("channelMasters")}
                <input
                  value={chMasters}
                  onChange={(e) => setChMasters(e.target.value)}
                  placeholder={tr("channelMastersPh")}
                />
              </label>
              <label>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={chOnlyMasters}
                    onChange={(e) => setChOnlyMasters(e.target.checked)}
                  />
                  {tr("channelOnlyMasters")}
                </span>
              </label>
              <label>
                {tr("channelNote")}
                <input value={chNote} onChange={(e) => setChNote(e.target.value)} />
              </label>
              {actionMsg && panel === "channel-detail" && <p className="muted">{actionMsg}</p>}
              <button type="button" className="btn" onClick={() => void saveChannelSettings()}>
                {tr("saveChannelSettings")}
              </button>
            </div>

            {activeChannel.id === "onebot11" && (
              <div className="form">
                <div className="hero sub">
                  <h1>{tr("onebotConn")}</h1>
                </div>
                <div className="chips">
                  <div className="chip">
                    {tr("onebotStatus")}{" "}
                    <strong>
                      {onebotInfo?.connected ? tr("onebotConnected") : tr("onebotDisconnected")}
                    </strong>
                  </div>
                  <div className="chip">
                    {tr("onebotClients")} <strong>{onebotInfo?.clients ?? 0}</strong>
                  </div>
                  <div className="chip">
                    {tr("onebotSelfId")} <strong>{onebotInfo?.selfId || "—"}</strong>
                  </div>
                </div>
                <p className="muted">{tr("onebotHint")}</p>
                <label>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={obEnabled}
                      onChange={(e) => setObEnabled(e.target.checked)}
                    />
                    {tr("onebotEnabled")}
                  </span>
                </label>
                <label>
                  {tr("onebotWsPath")}
                  <input value={obWsPath} onChange={(e) => setObWsPath(e.target.value)} />
                </label>
                <label>
                  {tr("onebotHttpPath")}
                  <input value={obHttpPath} onChange={(e) => setObHttpPath(e.target.value)} />
                </label>
                <label>
                  {tr("onebotToken")}
                  <input
                    type="password"
                    value={obToken}
                    onChange={(e) => setObToken(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <button type="button" className="btn" onClick={() => void saveOnebot()}>
                  {tr("onebotSave")}
                </button>
                <button type="button" className="btn ghost" onClick={() => void refreshOnebot()}>
                  {tr("refresh")}
                </button>
              </div>
            )}

            {hint && (
              <div className="form">
                <div className="hero sub">
                  <h1>{tr("pluginBaseline")}</h1>
                </div>
                <p className="muted">{hint.tip}</p>
                <p className="muted">{tr("canonicalPattern")}</p>
                <pre className="code-block">{hint.sample}</pre>
              </div>
            )}
            <div className="form">
              <button type="button" className="btn ghost" onClick={() => setPanel("channels")}>
                {tr("backChannels")}
              </button>
            </div>
          </section>
        )}

        {panel === "onebot" && (
          <section className="panel">
            <div className="hero">
              <h1>{tr("onebotDev")}</h1>
              <p>{tr("onebotHero")}</p>
            </div>
            <div className="chips">
              <div className="chip">
                {tr("onebotStatus")}{" "}
                <strong>
                  {onebotInfo?.connected ? tr("onebotConnected") : tr("onebotDisconnected")}
                </strong>
              </div>
              <div className="chip">
                {tr("onebotClients")} <strong>{onebotInfo?.clients ?? 0}</strong>
              </div>
              <div className="chip">
                {tr("onebotSelfId")} <strong>{onebotInfo?.selfId || "—"}</strong>
              </div>
            </div>
            <div className="form">
              <p className="muted">{tr("onebotHint")}</p>
              <p className="muted">
                <a href={onebotInfo?.docsUrl || "https://napneko.github.io"} target="_blank" rel="noreferrer">
                  {tr("onebotDocs")}
                </a>
              </p>
              <label>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={obEnabled}
                    onChange={(e) => setObEnabled(e.target.checked)}
                  />
                  {tr("onebotEnabled")}
                </span>
              </label>
              <label>
                {tr("onebotWsPath")}
                <input value={obWsPath} onChange={(e) => setObWsPath(e.target.value)} />
              </label>
              <label>
                {tr("onebotHttpPath")}
                <input value={obHttpPath} onChange={(e) => setObHttpPath(e.target.value)} />
              </label>
              <label>
                {tr("onebotToken")}
                <input
                  type="password"
                  value={obToken}
                  onChange={(e) => setObToken(e.target.value)}
                  autoComplete="off"
                />
              </label>
              {actionMsg && <p className="muted">{actionMsg}</p>}
              <button type="button" className="btn" onClick={() => void saveOnebot()}>
                {tr("onebotSave")}
              </button>
              <button type="button" className="btn ghost" onClick={() => void refreshOnebot()}>
                {tr("refresh")}
              </button>
              <div className="hero sub">
                <h1>{tr("pluginBaseline")}</h1>
              </div>
              <pre className="code-block">{channelHint(locale, "onebot11")?.sample}</pre>
            </div>
          </section>
        )}

        {panel === "workflows" && (
          <section className="panel">
            <div className="hero">
              <h1>{tr("workflows")}</h1>
              <p>{tr("workflowsHero")}</p>
            </div>
            <div className="list">
              {workflows.length === 0 && <p className="muted pad">{tr("noWorkflows")}</p>}
              {workflows.map((w) => (
                <div className="list-row" key={w.id}>
                  <div>
                    <strong>{w.name}</strong>
                    <div className="muted">{w.id}</div>
                  </div>
                  <button
                    type="button"
                    className="btn mini"
                    disabled={wfBusy === w.id}
                    onClick={() => void runWorkflow(w.id)}
                  >
                    {wfBusy === w.id ? tr("running") : tr("runWorkflow")}
                  </button>
                </div>
              ))}
            </div>
            {actionMsg && panel === "workflows" && <p className="error pad">{actionMsg}</p>}
            {wfResult != null && (
              <>
                <div className="hero sub">
                  <h1>{tr("runResult")}</h1>
                </div>
                <pre className="code-block">{JSON.stringify(wfResult, null, 2)}</pre>
              </>
            )}
          </section>
        )}

        {panel === "registry" && (
          <section className="panel">
            <div className="hero">
              <h1>{tr("registry")}</h1>
              <p>{tr("registryHero")}</p>
            </div>
            <div className="form">
              <p className="muted">
                {tr("registryBase")}: <code>{registryInfo?.baseUrl || "—"}</code>
              </p>
              <p className="muted">
                {tr("registryToken")}:{" "}
                {registryInfo?.tokenConfigured ? tr("registryTokenOk") : tr("registryTokenMissing")}
              </p>
              <div className="hero sub">
                <h1>{tr("registryCategories")}</h1>
              </div>
              <div className="list">
                {(registryInfo?.categories ?? []).map((c) => (
                  <div className="list-row" key={c.id}>
                    <div>
                      <strong>{c.label}</strong>
                      <div className="muted">
                        {c.id} · {c.path}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <label>
                {tr("pickPlugin")}
                <select
                  value={publishPluginId}
                  onChange={(e) => setPublishPluginId(e.target.value)}
                >
                  <option value="">—</option>
                  {plugins.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tr("pickCategory")}
                <select
                  value={publishCategory}
                  onChange={(e) => setPublishCategory(e.target.value)}
                >
                  {(registryInfo?.categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              {actionMsg && <p className="muted">{actionMsg}</p>}
              <button type="button" className="btn" onClick={() => void publishPlugin()}>
                {tr("publishBtn")}
              </button>
            </div>
          </section>
        )}

        {panel === "ai" && (
          <section className="panel">
            <div className="hero">
              <h1>{tr("aiProvider")}</h1>
              <p>{tr("aiHeroMulti")}</p>
            </div>
            <div className="list">
              {(llmInfo?.providers ?? []).map((p) => (
                <div
                  className={`list-row ${p.id === llmInfo?.activeId ? "provider-active" : ""}`}
                  key={p.id}
                >
                  <div>
                    <strong>{p.name}</strong>
                    <span className="cat-pill">{p.category}</span>
                    <div className="muted">
                      {p.model || "—"} · {p.hasKey ? tr("aiHasKey") : tr("aiNoKey")}
                    </div>
                  </div>
                  {p.id === llmInfo?.activeId ? (
                    <span className="badge ok">{tr("aiActive")}</span>
                  ) : (
                    <button type="button" className="btn mini" onClick={() => void switchProvider(p.id)}>
                      {tr("aiSwitch")}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="form">
              <label>
                {tr("aiEditProvider")}
                <select
                  value={editProviderId || llmInfo?.activeId || ""}
                  onChange={(e) => {
                    setEditProviderId(e.target.value);
                    const cur = llmInfo?.providers?.find((p) => p.id === e.target.value);
                    setLlmUrl(cur?.baseUrl ?? "");
                    setLlmModel(cur?.model ?? "");
                  }}
                >
                  {(llmInfo?.providers ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tr("aiApiKey")}
                <input
                  type="password"
                  value={llmKey}
                  placeholder="sk-…"
                  onChange={(e) => setLlmKey(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <label>
                {tr("aiBaseUrl")}
                <input value={llmUrl} onChange={(e) => setLlmUrl(e.target.value)} />
              </label>
              <label>
                {tr("aiModel")}
                <input value={llmModel} onChange={(e) => setLlmModel(e.target.value)} />
              </label>
              {actionMsg && <p className="muted">{actionMsg}</p>}
              <button type="button" className="btn" onClick={() => void saveLlm(false)}>
                {tr("aiSave")}
              </button>
              <button type="button" className="btn ghost" onClick={() => void saveLlm(true)}>
                {tr("aiClearKey")}
              </button>
            </div>
          </section>
        )}

        {panel === "logs" && (
          <section className="panel">
            <div className="hero">
              <h1>{tr("logs")}</h1>
              <p>{tr("logsHero")}</p>
            </div>
            <div className="form">
              <button type="button" className="btn ghost" onClick={() => void refreshLogs()}>
                {tr("refresh")}
              </button>
            </div>
            <div className="log-list">
              {logItems.length === 0 && <p className="muted pad">{tr("noLogs")}</p>}
              {[...logItems].reverse().map((row, i) => (
                <div className="log-row" key={`${row.at}-${i}`}>
                  <span className="muted">{row.at.replace("T", " ").slice(0, 19)}</span>
                  <span className={`lvl lvl-${row.level}`}>{row.level}</span>
                  <span>{row.message}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {panel === "mcp" && (
          <section className="panel">
            <div className="hero">
              <h1>{tr("mcpTools")}</h1>
              <p>{tr("mcpHero")}</p>
            </div>
            <div className="list">
              {mcpTools.length === 0 && <p className="muted pad">{tr("noTools")}</p>}
              {mcpTools.map((tool) => (
                <div className="list-row" key={tool.name}>
                  <div>
                    <strong>{tool.name}</strong>
                    <div className="muted">{tool.description || "—"}</div>
                  </div>
                  <span className="badge ok">{tr("tool")}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {panel === "database" && (
          <section className="panel">
            <div className="hero">
              <h1>{tr("database")}</h1>
              <p>{tr("databaseHeroMulti")}</p>
            </div>
            <div className="form">
              <button type="button" className="btn" onClick={() => void openDbSwitchModal()}>
                {tr("dbSwitchOpen")}
              </button>
            </div>
            {actionMsg && <p className="muted pad">{actionMsg}</p>}
            <RawBlock
              showLabel={tr("showRaw")}
              hideLabel={tr("hideRaw")}
              summary={
                <div className="chips" style={{ padding: 0 }}>
                  <div className="chip">
                    {tr("dbDriver")} <strong>{dbInfo?.info?.driver ?? "…"}</strong>
                  </div>
                  <div className="chip">
                    {tr("dbEngine")} <strong>{dbInfo?.info?.engine ?? "…"}</strong>
                  </div>
                  <div className="chip">
                    {tr("messages")} <strong>{dbInfo?.stats?.messages ?? meta?.db?.messages ?? 0}</strong>
                  </div>
                  <div className="chip">
                    {tr("plugins")} <strong>{dbInfo?.stats?.plugins ?? meta?.db?.plugins ?? 0}</strong>
                  </div>
                  <div className="chip">
                    {tr("kv")} <strong>{dbInfo?.stats?.kv ?? meta?.db?.kv ?? 0}</strong>
                  </div>
                </div>
              }
              raw={dbInfo ?? meta?.db ?? {}}
            />
          </section>
        )}

        {panel === "status" && (
          <section className="panel">
            <div className="hero">
              <h1>{tr("status")}</h1>
              <p>{tr("statusHero")}</p>
            </div>
            <RawBlock
              showLabel={tr("showRaw")}
              hideLabel={tr("hideRaw")}
              summary={
                <div className="chips" style={{ padding: 0 }}>
                  <div className="chip">
                    {tr("health")} <strong>{health?.ok ? tr("ok") : tr("unknown")}</strong>
                  </div>
                  <div className="chip">
                    {tr("env")} <strong>{displayEnv}</strong>
                  </div>
                  <div className="chip">
                    {tr("channels")} <strong>{channels.length}</strong>
                  </div>
                  <div className="chip">
                    {tr("plugins")} <strong>{plugins.length}</strong>
                  </div>
                  <div className="chip">
                    {tr("user")} <strong>{adminUser || "…"}</strong>
                  </div>
                  <div className="chip">
                    {tr("aiProvider")}{" "}
                    <strong>
                      {llmInfo?.providers?.find((p) => p.id === llmInfo.activeId)?.name ?? "—"}
                    </strong>
                  </div>
                </div>
              }
              raw={{ health, meta, llm: llmInfo, db: dbInfo }}
            />
          </section>
        )}

        {panel === "config" && (
          <section className="panel">
            <div className="hero">
              <h1>{tr("config")}</h1>
              <p>{tr("configHero")}</p>
            </div>
            <div className="form">
              <label>
                {tr("language")}
                <select
                  value={locale}
                  onChange={(e) => changeLocale(e.target.value === "en" ? "en" : "zh")}
                >
                  <option value="zh">{tr("langZh")}</option>
                  <option value="en">{tr("langEn")}</option>
                </select>
              </label>
              <p className="muted">{tr("languageHint")}</p>
              <label>
                {tr("runtimeProfile")}
                <select value={envPick} disabled>
                  <option value="desktop">{envLabel(locale, "desktop")}</option>
                  <option value="mobile">{envLabel(locale, "mobile")}</option>
                  <option value="server">{envLabel(locale, "server")}</option>
                  <option value="termux">{envLabel(locale, "termux")}</option>
                </select>
              </label>
              <p className="muted">{tr("sessionPolicy", { hours: sessionHours })}</p>
              <p className="muted">
                {tr("features")}:{" "}
                {meta?.env?.features
                  ? Object.entries(meta.env.features)
                      .filter(([, v]) => v)
                      .map(([k]) => k)
                      .join(", ") || "—"
                  : "—"}
              </p>
              <p className="muted">
                {tr("pluginsLoaded")}: {meta?.plugins?.loaded ?? plugins.length}
              </p>
              <button type="button" className="btn ghost" onClick={() => setPanel("admin")}>
                {tr("manageCreds")}
              </button>
            </div>
          </section>
        )}

        {panel === "admin" && (
          <section className="panel">
            <div className="hero">
              <h1>{tr("admin")}</h1>
              <p>{tr("adminHero", { user: adminUser || "…" })}</p>
            </div>
            <div className="form">
              <button className="btn ghost" type="button" onClick={() => clearSession()}>
                {tr("signOut")}
              </button>
              <label>
                {tr("currentPassword")}
                <input type="password" value={curPass} onChange={(e) => setCurPass(e.target.value)} />
              </label>
              <label>
                {tr("newUsernameOpt")}
                <input value={newUser} onChange={(e) => setNewUser(e.target.value)} />
              </label>
              <label>
                {tr("newPasswordOpt")}
                <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
              </label>
              <label>
                {tr("confirmNewPassword")}
                <input
                  type="password"
                  value={newPass2}
                  onChange={(e) => setNewPass2(e.target.value)}
                />
              </label>
              {loginErr && <div className="error">{loginErr}</div>}
              <button className="btn" type="button" onClick={() => void updateCredentials()}>
                {tr("updateCreds")}
              </button>
            </div>
            {overview && (
              <RawBlock
                showLabel={tr("showRaw")}
                hideLabel={tr("hideRaw")}
                summary={
                  <div className="chips">
                    <div className="chip">
                      {tr("plugins")}{" "}
                      <strong>{Array.isArray((overview as { plugins?: unknown[] }).plugins) ? (overview as { plugins: unknown[] }).plugins.length : "…"}</strong>
                    </div>
                    <div className="chip">
                      {tr("channels")}{" "}
                      <strong>{Array.isArray((overview as { channels?: unknown[] }).channels) ? (overview as { channels: unknown[] }).channels.length : "…"}</strong>
                    </div>
                  </div>
                }
                raw={overview}
              />
            )}
          </section>
        )}

        {panel === "plugin-config" && (
          <section className="panel">
            <div className="hero">
              <h1>
                {plugins.find((p) => p.id === activePluginId)?.name || activePluginId || tr("plugins")}
              </h1>
              <p>{tr("pluginConfigHero")}</p>
            </div>
            {!pluginCfg ? (
              <p className="muted pad">{tr("loading")}</p>
            ) : !pluginCfg.supported ? (
              <p className="pad">{pluginCfg.message || tr("pluginNoConfig")}</p>
            ) : (
              <div className="form">
                {(pluginCfg.schema ?? []).map((field) => (
                  <label key={field.key}>
                    {field.label}
                    {field.type === "boolean" ? (
                      <select
                        value={String(pluginCfgDraft[field.key] ?? field.default ?? true)}
                        onChange={(e) =>
                          setPluginCfgDraft((d) => ({
                            ...d,
                            [field.key]: e.target.value === "true",
                          }))
                        }
                      >
                        <option value="true">{tr("on")}</option>
                        <option value="false">{tr("off")}</option>
                      </select>
                    ) : field.type === "select" ? (
                      <select
                        value={String(pluginCfgDraft[field.key] ?? field.default ?? "")}
                        onChange={(e) =>
                          setPluginCfgDraft((d) => ({ ...d, [field.key]: e.target.value }))
                        }
                      >
                        {(field.options ?? []).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={
                          field.type === "password"
                            ? "password"
                            : field.type === "number"
                              ? "number"
                              : "text"
                        }
                        value={String(pluginCfgDraft[field.key] ?? field.default ?? "")}
                        onChange={(e) =>
                          setPluginCfgDraft((d) => ({
                            ...d,
                            [field.key]:
                              field.type === "number" ? Number(e.target.value) : e.target.value,
                          }))
                        }
                      />
                    )}
                    {field.description ? <span className="muted">{field.description}</span> : null}
                  </label>
                ))}
                {actionMsg && <p className="muted">{actionMsg}</p>}
                <button type="button" className="btn" onClick={() => void savePluginConfig()}>
                  {tr("saveConfig")}
                </button>
              </div>
            )}
            <div className="form">
              <button type="button" className="btn ghost" onClick={() => setPanel("plugins")}>
                {tr("backPlugins")}
              </button>
            </div>
          </section>
        )}

        {panel === "plugins" && (
          <section className="panel">
            <div className="hero">
              <h1>{tr("pluginManage")}</h1>
              <p>{tr("pluginManageHero")}</p>
            </div>
            {actionMsg && panel === "plugins" && <p className="muted pad">{actionMsg}</p>}
            <div className="list">
              {plugins.length === 0 && <p className="muted pad">{tr("noPlugins")}</p>}
              {plugins.map((p) => (
                <div className="list-row" key={p.id}>
                  <div>
                    <strong>{p.name}</strong>
                    <div className="muted">
                      {p.id}
                      {p.version ? ` @${p.version}` : ""}
                      {p.enabled === false ? ` · ${tr("pluginDisabled")}` : ""}
                    </div>
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn mini"
                      onClick={() => void openPluginConfig(p.id)}
                    >
                      {tr("pluginManageBtn")}
                    </button>
                    <button
                      type="button"
                      className="btn mini ghost"
                      onClick={() => void setPluginEnabled(p.id, p.enabled === false)}
                    >
                      {p.enabled === false ? tr("pluginEnable") : tr("pluginDisable")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <FloatModal
        open={dbModalOpen}
        onClose={() => setDbModalOpen(false)}
        title={tr("dbSwitchTitle")}
        subtitle={tr("dbSwitchLead")}
        footer={
          <>
            <button type="button" className="btn ghost" onClick={() => void openDbSwitchModal()}>
              {dbDetecting ? tr("dbDetecting") : tr("dbRedetect")}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!dbPick || dbDetecting}
              onClick={() => void switchDb(dbPick, dbPath)}
            >
              {tr("dbApply")}
            </button>
          </>
        }
      >
        {dbDetecting && <p className="muted">{tr("dbDetecting")}</p>}
        <label>
          {tr("dbPick")}
          <select
            value={dbPick}
            onChange={(e) => {
              const id = e.target.value;
              setDbPick(id);
              const backend = dbInfo?.backends?.find((b) => b.id === id);
              setDbPath(backend?.path ?? "");
            }}
          >
            {(dbDetect.length ? dbDetect : (dbInfo?.backends ?? []).map((b) => ({
              id: b.id,
              label: b.label,
              available: b.enabled,
              reason: b.enabled ? undefined : tr("dbDisabled"),
            }))).map((d) => (
              <option key={d.id} value={d.id} disabled={!d.available}>
                {d.label}
                {d.recommended ? ` · ${tr("dbRecommended")}` : ""}
                {!d.available ? ` · ${d.reason || tr("dbUnavailable")}` : ""}
              </option>
            ))}
          </select>
        </label>
        {dbPick !== "memory" && (
          <label>
            {tr("dbPath")}
            <input value={dbPath} onChange={(e) => setDbPath(e.target.value)} placeholder="data/…" />
          </label>
        )}
        <div className="list compact">
          {dbDetect.map((d) => (
            <div className="list-row" key={d.id}>
              <div>
                <strong>{d.label}</strong>
                <div className="muted">{d.reason || d.id}</div>
              </div>
              <span className={`badge ${d.available ? "ok" : ""}`}>
                {d.available ? tr("dbAvailable") : tr("dbUnavailable")}
              </span>
            </div>
          ))}
        </div>
        {actionMsg && <p className="muted">{actionMsg}</p>}
      </FloatModal>
    </div>
  );
}
