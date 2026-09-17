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
  | "automation"
  | "database"
  | "dashboard"
  | "plugins"
  | "plugin-config"
  | "registry"
  | "ai"
  | "logs"
  | "status"
  | "config"
  | "admin"
  | "env-setup"
  | "env-tasks";

type Meta = {
  version?: string;
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
  kind?: "channel" | "framework";
  adapterScope?: "all" | "channel" | "specified";
  channels?: string[];
  configSupported?: boolean;
  enabled?: boolean;
};
type EnvRuntimeId = "go" | "python" | "browser";
type EnvTaskStatus = "pending" | "running" | "paused" | "done" | "failed";
type EnvRuntimeDef = {
  id: EnvRuntimeId;
  label: string;
  versions: string[];
  modes: Array<"compile" | "binary">;
  installed?: boolean;
  activeVersion?: string;
};
type EnvTask = {
  id: string;
  runtime: EnvRuntimeId;
  version: string;
  mode: "compile" | "binary";
  status: EnvTaskStatus;
  progress?: number;
  logs?: string[];
  createdAt: string;
  updatedAt: string;
  note?: string;
  error?: string;
};
type EnvTaskCounts = {
  pending: number;
  running: number;
  paused: number;
  done: number;
  failed: number;
};

type PluginLayer =
  | { step: "home" }
  | { step: "channels" }
  | { step: "list"; kind: "channel" | "framework"; channelId?: string }
  | { step: "docs"; kind: "channel" | "framework" };
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
type FeedMsg = {
  id: string;
  channel: string;
  chatId: string;
  userId: string;
  role: string;
  content: string;
  createdAt: string;
};
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
  message?: string;
  config?: {
    enabled?: boolean;
    accessToken?: string;
    reverseWsPath?: string;
    httpPath?: string;
  };
};

type UiModal =
  | null
  | { kind: "db" }
  | { kind: "channel-settings" }
  | { kind: "channel-plugins" }
  | { kind: "channel-docs" }
  | { kind: "onebot-conn" }
  | { kind: "plugin-config"; id: string }
  | { kind: "password" }
  | { kind: "update" };

function resolveAdapterScope(p: PluginItem): "all" | "channel" | "specified" {
  if (p.adapterScope) return p.adapterScope;
  const kind = p.kind ?? "framework";
  const chs = p.channels ?? [];
  if (kind === "framework" || !chs.length) return "all";
  return chs.length === 1 ? "channel" : "specified";
}

/** 管理端主标题：显示中文 name；id 仅作副标题 */
function pluginDisplayName(p: { name?: string; id: string }): string {
  return (p.name || "").trim() || p.id;
}

/** 本通道可见：专用/指定通道插件 + 框架通用（all）插件，两边同时显示 */
function pluginsVisibleOnChannel(items: PluginItem[], channelId?: string): PluginItem[] {
  return items.filter((p) => {
    const scope = resolveAdapterScope(p);
    if (scope === "all") return true;
    if (scope !== "channel" && scope !== "specified") return false;
    if (!channelId) return true;
    return (p.channels ?? []).includes(channelId);
  });
}

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

async function api<T>(path: string, init?: RequestInit & { token?: string; timeoutMs?: number }): Promise<T> {
  const { token, timeoutMs, headers: initHeaders, ...rest } = init ?? {};
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(initHeaders as Record<string, string> | undefined),
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const ctrl = new AbortController();
  const ms = timeoutMs ?? 45_000;
  const timer = window.setTimeout(() => ctrl.abort(), ms);
  let res: Response;
  try {
    res = await fetch(path, { ...rest, headers, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(`请求超时（${Math.round(ms / 1000)} 秒）`);
    }
    throw e;
  } finally {
    window.clearTimeout(timer);
  }

  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(res.ok ? "响应不是 JSON" : `HTTP ${res.status}`);
    }
  }
  if (!res.ok) {
    const tip = String(data.error || data.message || res.statusText || "请求失败");
    const hint = data.hint ? `（${String(data.hint)}）` : "";
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
    environment: true,
    settings: true,
    aiLayer: true,
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 821px)").matches;
  });
  const [narrowUi, setNarrowUi] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 820px)").matches;
  });
  const [rawPage, setRawPage] = useState(false);
  const [logsTab, setLogsTab] = useState<"gateway" | "messages">("gateway");
  const [pwConfirmStep, setPwConfirmStep] = useState(false);
  const [envRuntimes, setEnvRuntimes] = useState<EnvRuntimeDef[]>([]);
  const [envTasks, setEnvTasks] = useState<EnvTask[]>([]);
  const [envCounts, setEnvCounts] = useState<EnvTaskCounts>({
    pending: 0,
    running: 0,
    paused: 0,
    done: 0,
    failed: 0,
  });
  const [envPickRuntime, setEnvPickRuntime] = useState<EnvRuntimeId>("go");
  const [envPickVersion, setEnvPickVersion] = useState("");
  const [envPickMode, setEnvPickMode] = useState<"compile" | "binary">("binary");
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
  const [feedItems, setFeedItems] = useState<FeedMsg[]>([]);
  const [feedPowerOff, setFeedPowerOff] = useState(false);
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [dbDetect, setDbDetect] = useState<DbDetectItem[]>([]);
  const [uiModal, setUiModal] = useState<UiModal>(null);
  /** 弹窗返回栈：如 本通道插件 → 配置主人，关闭后回到本通道插件，不进插件管理首页 */
  const [modalBack, setModalBack] = useState<UiModal>(null);
  const [modalStatus, setModalStatus] = useState("");
  const [modalTone, setModalTone] = useState<"muted" | "ok" | "error">("muted");
  const [dbDetecting, setDbDetecting] = useState(false);
  const [dbPick, setDbPick] = useState("");
  const [dbPath, setDbPath] = useState("");
  const [editProviderId, setEditProviderId] = useState("");
  const [chMasters, setChMasters] = useState("");
  const [chOnlyMasters, setChOnlyMasters] = useState(false);
  const [chNote, setChNote] = useState("");
  const [pluginLayer, setPluginLayer] = useState<PluginLayer>({ step: "home" });
  const [updateInfo, setUpdateInfo] = useState<{
    currentVersion: string;
    remoteVersion?: string;
    updateAvailable: boolean;
    message: string;
    currentCommit?: string;
    remoteCommit?: string;
  } | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);

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
    void checkFrameworkUpdate({ silent: true });
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
    void refreshEnv();
  }, [token, mustReconfigure]);

  useEffect(() => {
    if ((panel !== "logs" || logsTab !== "messages") || !token) return;
    void refreshMessages();
    const timer = window.setInterval(() => void refreshMessages(), 2500);
    return () => window.clearInterval(timer);
  }, [panel, logsTab, token]);

  useEffect(() => {
    if (panel !== "dashboard" && panel !== "database") setRawPage(false);
  }, [panel]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 820px)");
    const apply = () => {
      const narrow = mq.matches;
      setNarrowUi(narrow);
      // 切到窄屏时默认收起侧栏，避免遮罩挡住对话输入
      if (narrow) setSidebarOpen(false);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!token || (panel !== "env-setup" && panel !== "env-tasks")) return;
    void autoQueueEnv();
    const timer = window.setInterval(() => void refreshEnv(), 1200);
    return () => window.clearInterval(timer);
  }, [panel, token]);

  const sessionHours = meta?.admin?.sessionHours ?? 12;
  const displayEnv = envLabel(locale, meta?.env.id ?? envPick, meta?.env.label);
  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const hint = activeChannelId ? channelHint(locale, activeChannelId) : null;
  const taskBadgeCount = envCounts.pending + envCounts.running;

  const scopeLabel = (scope: "all" | "channel" | "specified") => {
    if (scope === "all") return tr("adapterScopeAll");
    if (scope === "channel") return tr("adapterScopeChannel");
    return tr("adapterScopeSpecified");
  };

  const filteredPlugins = (() => {
    if (pluginLayer.step !== "list") return plugins;
    if (pluginLayer.kind === "framework") {
      return plugins.filter((p) => resolveAdapterScope(p) === "all");
    }
    return pluginsVisibleOnChannel(plugins, pluginLayer.channelId);
  })();

  const refreshEnv = async () => {
    if (!token) return;
    try {
      const [rt, tk] = await Promise.all([
        api<{ runtimes: EnvRuntimeDef[]; counts?: EnvTaskCounts }>("/v1/admin/env-runtimes", {
          token,
        }),
        api<{ items: EnvTask[]; counts?: EnvTaskCounts }>("/v1/admin/env-tasks", { token }),
      ]);
      setEnvRuntimes(rt.runtimes ?? []);
      setEnvTasks(tk.items ?? []);
      const counts = tk.counts ?? rt.counts;
      if (counts) setEnvCounts(counts);
      const first = rt.runtimes?.[0];
      if (first && !envPickVersion) {
        setEnvPickRuntime(first.id);
        setEnvPickVersion(first.versions[0] || "");
        setEnvPickMode(first.modes.includes("binary") ? "binary" : first.modes[0] || "binary");
      }
    } catch {
      /* ignore */
    }
  };

  const autoQueueEnv = async () => {
    if (!token) return;
    try {
      const res = await api<{
        message?: string;
        items?: EnvTask[];
        counts?: EnvTaskCounts;
        runtimes?: EnvRuntimeDef[];
      }>("/v1/admin/env-runtimes/auto-queue", { method: "POST", token });
      if (res.runtimes) setEnvRuntimes(res.runtimes);
      if (res.items) setEnvTasks(res.items);
      if (res.counts) setEnvCounts(res.counts);
      if (res.message) setActionMsg(res.message);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const openPluginHome = () => {
    setPluginLayer({ step: "home" });
    setPanel("plugins");
    setActionMsg("");
  };

  const openPluginList = (kind: "channel" | "framework", channelId?: string) => {
    if (kind === "channel" && !channelId) {
      setPluginLayer({ step: "channels" });
      setPanel("plugins");
      setActionMsg("");
      return;
    }
    setPluginLayer({ step: "list", kind, channelId });
    setPanel("plugins");
    setActionMsg("");
  };

  const openPluginDocs = (kind: "channel" | "framework") => {
    setPluginLayer({ step: "docs", kind });
    setPanel("plugins");
  };

  /** 返回：通道插件列表 → 通道选择 → 插件首页；框架列表/文档 → 插件首页 */
  const backPluginLayer = () => {
    if (pluginLayer.step === "list" && pluginLayer.kind === "channel" && pluginLayer.channelId) {
      setPluginLayer({ step: "channels" });
      setActionMsg("");
      return;
    }
    if (pluginLayer.step === "list" && pluginLayer.kind === "framework") {
      openPluginHome();
      return;
    }
    if (pluginLayer.step === "docs") {
      openPluginHome();
      return;
    }
    if (pluginLayer.step === "channels") {
      openPluginHome();
      return;
    }
    openPluginHome();
  };

  const openChannelMastersFromPlugins = (channelId: string) => {
    setActiveChannelId(channelId);
    setModalStatus("");
    // 从本通道插件弹窗进「配置主人」→ 返回仍回本通道插件弹窗
    if (uiModal?.kind === "channel-plugins") {
      setModalBack({ kind: "channel-plugins" });
    } else {
      setModalBack(null);
    }
    setUiModal({ kind: "channel-settings" });
    void loadChannelSettings(channelId);
  };

  const checkFrameworkUpdate = async (opts?: { silent?: boolean }) => {
    if (!token) return;
    try {
      const res = await api<{
        ok: boolean;
        currentVersion: string;
        remoteVersion?: string;
        updateAvailable: boolean;
        message: string;
        currentCommit?: string;
        remoteCommit?: string;
      }>("/v1/admin/update/check", { token });
      setUpdateInfo(res);
      if (res.updateAvailable) {
        setUiModal({ kind: "update" });
        setModalStatus(res.message);
        setModalTone("ok");
      } else if (!opts?.silent) {
        setActionMsg(res.message);
      }
    } catch (e) {
      if (!opts?.silent) {
        setActionMsg(e instanceof Error ? e.message : String(e));
      }
    }
  };

  const applyFrameworkUpdate = async () => {
    if (!token) return;
    setUpdateBusy(true);
    setModalStatus("");
    try {
      const res = await api<{ ok?: boolean; message?: string }>("/v1/admin/update/apply", {
        method: "POST",
        token,
        body: JSON.stringify({ confirm: true }),
      });
      flashModal(res.message || tr("updateApplying"), "ok");
    } catch (e) {
      flashModal(e instanceof Error ? e.message : String(e), "error");
      setUpdateBusy(false);
    }
  };

  const flashModal = (msg: string, tone: "muted" | "ok" | "error" = "ok") => {
    setModalStatus(msg);
    setModalTone(tone);
  };

  const closeModal = () => {
    setUiModal(null);
    setModalBack(null);
    setModalStatus("");
    setModalTone("muted");
    setPwConfirmStep(false);
  };

  /** 关闭当前弹窗；若有返回栈则回到上一层弹窗 */
  const popModal = () => {
    setModalStatus("");
    setModalTone("muted");
    setPwConfirmStep(false);
    if (modalBack) {
      const back = modalBack;
      setModalBack(null);
      setUiModal(back);
      return;
    }
    setUiModal(null);
  };

  /** 本通道插件弹窗「返回上一层」→ 始终回到通道中枢，绝不进全局插件管理 */
  const closeChannelPluginsModal = () => {
    setModalBack(null);
    setModalStatus("");
    setModalTone("muted");
    setUiModal(null);
    if (activeChannelId) setPanel("channel-detail");
  };

  const openChannel = (id: string) => {
    setActiveChannelId(id);
    setPanel("channel-detail");
    setActionMsg("");
    closeModal();
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
    if (!token || !activeChannelId) {
      flashModal(tr("needLogin"), "error");
      return;
    }
    setModalStatus("");
    try {
      const res = await api<{ ok?: boolean; message?: string; settings?: ChannelSettings }>(
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
      if (res.settings) {
        setChMasters((res.settings.masters ?? []).join(", "));
        setChOnlyMasters(Boolean(res.settings.onlyMasters));
        setChNote(res.settings.note ?? "");
        setChannels((prev) =>
          prev.map((c) =>
            c.id === activeChannelId
              ? {
                  ...c,
                  masters: res.settings!.masters,
                  onlyMasters: res.settings!.onlyMasters,
                  label: res.settings!.label || c.label,
                }
              : c,
          ),
        );
      }
      flashModal(res.message || tr("saveOk"), "ok");
      void refreshSide();
    } catch (e) {
      flashModal(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const setPluginEnabled = async (id: string, enabled: boolean) => {
    if (!token) {
      flashModal(tr("needLogin"), "error");
      return;
    }
    setModalStatus("");
    try {
      const res = await api<{ message?: string; items?: PluginItem[] }>(
        `/v1/plugins/${encodeURIComponent(id)}/${enabled ? "enable" : "disable"}`,
        { method: "POST", token },
      );
      if (res.items?.length) setPlugins(res.items);
      else await refreshSide();
      flashModal(res.message || tr("saveOk"), "ok");
      setActionMsg(res.message || tr("saveOk"));
    } catch (e) {
      flashModal(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const send = async () => {
    const content = input.trim();
    if (!content || busy) return;
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", content }]);
    setInput("");
    try {
      const res = await api<{ assistant: string }>("/v1/chat", {
        method: "POST",
        token: token || undefined,
        timeoutMs: 60_000,
        body: JSON.stringify({ content, chatId: "web-main", userId: "web-user" }),
      });
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: res.assistant || tr("emptyReply"),
        },
      ]);
      if ((panel === "logs" && logsTab === "messages") || content.startsWith("#")) {
        void refreshMessages();
      }
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
      setPwConfirmStep(false);
      closeModal();
      clearSession(res.message || tr("credsUpdated"));
    } catch (e) {
      setLoginErr(e instanceof Error ? e.message : String(e));
      setPwConfirmStep(false);
    }
  };

  const openPasswordModal = () => {
    setLoginErr("");
    setPwConfirmStep(false);
    setCurPass("");
    setNewUser("");
    setNewPass("");
    setNewPass2("");
    setUiModal({ kind: "password" });
  };

  const createEnvTask = async () => {
    if (!token) return;
    setActionMsg("");
    try {
      const res = await api<{ message?: string; counts?: EnvTaskCounts; items?: EnvTask[] }>(
        "/v1/admin/env-tasks",
        {
          method: "POST",
          token,
          body: JSON.stringify({
            runtime: envPickRuntime,
            version: envPickVersion,
            mode: envPickMode,
          }),
        },
      );
      if (res.counts) setEnvCounts(res.counts);
      if (res.items) setEnvTasks(res.items);
      setActionMsg(res.message || tr("envTaskQueued"));
      void refreshEnv();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const setEnvTaskStatus = async (id: string, status: EnvTaskStatus) => {
    if (!token) return;
    try {
      const res = await api<{ counts?: EnvTaskCounts }>(`/v1/admin/env-tasks/${id}/status`, {
        method: "POST",
        token,
        body: JSON.stringify({ status }),
      });
      if (res.counts) setEnvCounts(res.counts);
      void refreshEnv();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
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
    setModalStatus("");
    try {
      const res = await api<DbInfo & { message?: string }>("/v1/admin/db/switch", {
        method: "POST",
        token,
        body: JSON.stringify({ id, path: path || undefined }),
      });
      setDbInfo({
        active: res.active,
        info: res.info,
        stats: res.stats,
        backends: res.backends,
        message: res.message,
      });
      flashModal(res.message || tr("saveOk"), "ok");
      void refreshSide();
    } catch (e) {
      flashModal(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const openDbSwitchModal = async () => {
    if (!token) {
      setInfo(tr("needLogin"));
      return;
    }
    setUiModal({ kind: "db" });
    setDbDetecting(true);
    setModalStatus("");
    try {
      const res = await api<DbInfo>("/v1/admin/db/detect", { token });
      setDbDetect(res.items ?? []);
      setDbInfo((prev) => ({ ...prev, ...res }));
      const pick = res.active || res.items?.find((d) => d.recommended)?.id || "sqlite";
      setDbPick(pick);
      const backend = res.backends?.find((b) => b.id === pick);
      setDbPath(backend?.path ?? "");
    } catch (e) {
      flashModal(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setDbDetecting(false);
    }
  };

  const openPluginConfig = async (id: string) => {
    setActivePluginId(id);
    setUiModal({ kind: "plugin-config", id });
    setModalStatus("");
    setPluginCfg(null);
    if (!token) {
      setPluginCfg({ supported: false, message: tr("needLogin") });
      flashModal(tr("needLogin"), "error");
      return;
    }
    try {
      const res = await api<PluginConfigRes>(`/v1/plugins/${encodeURIComponent(id)}/config`, {
        token,
      });
      setPluginCfg(res);
      setPluginCfgDraft({ ...(res.values ?? {}) });
      if (!res.supported) flashModal(res.message || tr("pluginNoConfig"), "muted");
    } catch (e) {
      setPluginCfg({
        supported: false,
        message: e instanceof Error ? e.message : String(e),
      });
      flashModal(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const savePluginConfig = async () => {
    if (!token || !activePluginId) return;
    setModalStatus("");
    try {
      const res = await api<{ message?: string; values?: Record<string, unknown>; ok?: boolean }>(
        `/v1/plugins/${encodeURIComponent(activePluginId)}/config`,
        {
          method: "PUT",
          token,
          body: JSON.stringify(pluginCfgDraft),
        },
      );
      if (res.values) {
        setPluginCfgDraft(res.values);
        setPluginCfg((prev) => (prev ? { ...prev, values: res.values } : prev));
      }
      flashModal(res.message || tr("saveOk"), "ok");
    } catch (e) {
      flashModal(e instanceof Error ? e.message : String(e), "error");
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

  const refreshMessages = async () => {
    if (!token) return;
    try {
      const r = await api<{ items: FeedMsg[]; powerOff?: boolean }>("/v1/messages/recent?limit=80", {
        token,
      });
      setFeedItems(r.items ?? []);
      setFeedPowerOff(Boolean(r.powerOff));
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
    if (!token) {
      flashModal(tr("needLogin"), "error");
      return;
    }
    setModalStatus("");
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
      setObEnabled(res.enabled !== false);
      setObWsPath(res.reverseWsPath || res.config?.reverseWsPath || obWsPath);
      setObHttpPath(res.httpPath || res.config?.httpPath || obHttpPath);
      if (res.config?.accessToken != null) setObToken(res.config.accessToken);
      flashModal(res.message || tr("saveOk"), "ok");
    } catch (e) {
      flashModal(e instanceof Error ? e.message : String(e), "error");
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
          <div className="brand-row">
            <strong>{BRAND}</strong>
            <button
              type="button"
              className="task-badge"
              title={tr("envTasks")}
              onClick={() => {
                setPanel("env-tasks");
                void refreshEnv();
              }}
            >
              {taskBadgeCount}
            </button>
          </div>
          <span>{displayEnv}</span>
        </div>

        <div className="tree-top">
          <TreeItem
            label={tr("status")}
            active={panel === "dashboard" || panel === "status"}
            onClick={() => {
              setPanel("dashboard");
              void refreshSide();
              if (token) {
                void refreshMessages();
                void refreshLogs();
              }
            }}
            badge={health?.ok ? "OK" : "…"}
          />
        </div>

        <TreeGroup
          title={tr("usage")}
          open={openGroups.usage}
          onToggle={() => toggleGroup("usage")}
        >
          <TreeItem label={tr("chat")} active={panel === "chat"} onClick={() => setPanel("chat")} />
          <TreeItem
            label={tr("allChannels")}
            active={panel === "channels" || panel === "channel-detail"}
            onClick={() => setPanel("channels")}
            badge={String(channels.length || 0)}
          />
          <TreeItem
            label={tr("automation")}
            active={panel === "automation"}
            onClick={() => setPanel("automation")}
            badge={String(workflows.length + mcpTools.length)}
          />
        </TreeGroup>

        <TreeGroup
          title={tr("database")}
          open={openGroups.database}
          onToggle={() => toggleGroup("database")}
        >
          <TreeItem
            label={tr("dbCurrent")}
            active={panel === "database" || uiModal?.kind === "db"}
            onClick={() => setPanel("database")}
            badge={dbInfo?.info?.driver ?? dbInfo?.active ?? "…"}
          />
        </TreeGroup>

        <TreeGroup
          title={tr("environment")}
          open={openGroups.environment}
          onToggle={() => toggleGroup("environment")}
        >
          <TreeItem
            label={tr("envSetup")}
            active={panel === "env-setup"}
            onClick={() => {
              setPanel("env-setup");
              void refreshEnv();
            }}
          />
        </TreeGroup>

        <TreeGroup
          title={tr("settings")}
          open={openGroups.settings}
          onToggle={() => toggleGroup("settings")}
        >
          <TreeItem
            label={tr("pluginManage")}
            active={panel === "plugins"}
            onClick={() => openPluginHome()}
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
            label={tr("logs")}
            active={panel === "logs"}
            onClick={() => {
              setPanel("logs");
              void refreshLogs();
              void refreshMessages();
            }}
            badge={String(logItems.length || "…")}
          />
          <TreeItem label={tr("config")} active={panel === "config"} onClick={() => setPanel("config")} />
          <TreeItem label={tr("admin")} active={panel === "admin"} onClick={() => setPanel("admin")} />
        </TreeGroup>

        <TreeGroup
          title={tr("aiLayer")}
          open={openGroups.aiLayer}
          onToggle={() => toggleGroup("aiLayer")}
        >
          <TreeItem
            label={tr("aiProvider")}
            active={panel === "ai"}
            onClick={() => {
              setActionMsg("");
              setPanel("ai");
            }}
          />
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
      {narrowUi && sidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label={tr("collapse")}
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <main className="workspace">
        <div className="workspace-topbar">
          <span className="muted">{tr("workspace")}</span>
          <button type="button" className="btn ghost mini" onClick={() => clearSession()}>
            {tr("signOut")}
          </button>
        </div>
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
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                rows={2}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <button
                className="btn"
                type="button"
                disabled={busy || !input.trim()}
                onClick={() => void send()}
              >
                {busy ? tr("sending") : tr("send")}
              </button>
            </div>
          </section>
        )}

        {panel === "channels" && (
          <section className="panel">
            <div className="hero">
              <h1>{tr("channels")}</h1>
              <p>{tr("channelsLayerHero")}</p>
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
                      {c.id}
                      {c.id === "onebot11" && onebotInfo?.connected ? ` · ${tr("onebotConnected")}` : ""}
                      {c.masters?.length ? ` · ${tr("channelMastersShort")}:${c.masters.length}` : ""}
                    </div>
                  </div>
                  <span className="badge ok">{tr("enterChannel")}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {panel === "channel-detail" && activeChannel && (
          <section className="panel">
            <div className="hero">
              <p className="crumb">
                <button type="button" className="linkish" onClick={() => setPanel("channels")}>
                  {tr("allChannels")}
                </button>
                <span> / </span>
                <strong>{channelLabel(locale, activeChannel.id, activeChannel.label)}</strong>
              </p>
              <h1>{channelLabel(locale, activeChannel.id, activeChannel.label)}</h1>
              <p>
                {tr("channelId")}: <code>{activeChannel.id}</code> · {tr("channelHubHero")}
              </p>
            </div>
            <div className="layer-grid">
              <button
                type="button"
                className="layer-card"
                onClick={() => {
                  setModalStatus("");
                  setModalBack(null);
                  setUiModal({ kind: "channel-settings" });
                  void loadChannelSettings(activeChannel.id);
                }}
              >
                <strong>{tr("channelSettings")}</strong>
                <span>{tr("channelSettingsHint")}</span>
              </button>
              <button
                type="button"
                className="layer-card"
                onClick={() => {
                  setModalStatus("");
                  setModalBack(null);
                  setUiModal({ kind: "channel-plugins" });
                }}
              >
                <strong>{tr("channelPluginManage")}</strong>
                <span>{tr("channelPluginManageHint")}</span>
              </button>
              <button
                type="button"
                className="layer-card"
                onClick={() => {
                  setModalStatus("");
                  setModalBack(null);
                  setUiModal({ kind: "channel-docs" });
                }}
              >
                <strong>{tr("pluginBaseline")}</strong>
                <span>{tr("channelDocsHint")}</span>
              </button>
              {activeChannel.id === "onebot11" && (
                <button
                  type="button"
                  className="layer-card"
                  onClick={() => {
                    setModalStatus("");
                    setModalBack(null);
                    setUiModal({ kind: "onebot-conn" });
                    void refreshOnebot();
                  }}
                >
                  <strong>{tr("onebotConn")}</strong>
                  <span>
                    {onebotInfo?.connected ? tr("onebotConnected") : tr("onebotDisconnected")}
                  </span>
                </button>
              )}
            </div>
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

        {panel === "automation" && (
          <section className="panel">
            <div className="hero">
              <h1>{tr("automation")}</h1>
              <p>{tr("automationHero")}</p>
            </div>
            <div className="hero sub">
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
            {actionMsg && panel === "automation" && <p className="error pad">{actionMsg}</p>}
            {wfResult != null && (
              <>
                <div className="hero sub">
                  <h1>{tr("runResult")}</h1>
                </div>
                <pre className="code-block">{JSON.stringify(wfResult, null, 2)}</pre>
              </>
            )}
            <div className="hero sub">
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
                      {pluginDisplayName(p)}（{p.id}）
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
                    <strong>{pluginDisplayName(p)}</strong>
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
              <div className="seg-tabs">
                <button
                  type="button"
                  className={`btn mini ${logsTab === "gateway" ? "" : "ghost"}`}
                  onClick={() => {
                    setLogsTab("gateway");
                    void refreshLogs();
                  }}
                >
                  {tr("logsGateway")}
                </button>
                <button
                  type="button"
                  className={`btn mini ${logsTab === "messages" ? "" : "ghost"}`}
                  onClick={() => {
                    setLogsTab("messages");
                    void refreshMessages();
                  }}
                >
                  {tr("liveMessages")}
                </button>
              </div>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  if (logsTab === "gateway") void refreshLogs();
                  else void refreshMessages();
                }}
              >
                {tr("refresh")}
              </button>
            </div>
            {logsTab === "gateway" ? (
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
            ) : (
              <>
                <div className="chips">
                  <div className="chip">
                    {tr("powerState")}{" "}
                    <strong>{feedPowerOff ? tr("powerOff") : tr("powerOn")}</strong>
                  </div>
                  <div className="chip">
                    {tr("messages")} <strong>{feedItems.length}</strong>
                  </div>
                </div>
                <p className="muted pad">{tr("hashHint")}</p>
                <div className="log-list">
                  {feedItems.length === 0 && <p className="muted pad">{tr("noLiveMessages")}</p>}
                  {feedItems.map((row) => (
                    <div className="log-row" key={row.id}>
                      <span className="muted">{row.createdAt.replace("T", " ").slice(0, 19)}</span>
                      <span className="lvl">{row.channel}</span>
                      <span className="muted">
                        {row.role}:{row.userId}
                      </span>
                      <span>{row.content}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {panel === "dashboard" && (
          <section className="panel">
            <div className="hero hero-with-raw">
              <div>
                <h1
                  className="title-toggle"
                  onClick={() => setRawPage((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setRawPage((v) => !v);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {tr("dashboard")}
                </h1>
                <p>{tr("dashboardHero")}</p>
              </div>
              <button type="button" className="btn ghost mini" onClick={() => setRawPage((v) => !v)}>
                {rawPage ? tr("hideRaw") : tr("showRaw")}
              </button>
            </div>
            {rawPage ? (
              <pre className="code-block raw-page">
                {JSON.stringify(
                  {
                    health,
                    meta,
                    db: dbInfo,
                    channels,
                    plugins,
                    llm: llmInfo,
                    onebot: onebotInfo,
                    powerOff: feedPowerOff,
                    recentMessages: feedItems.slice(0, 20),
                  },
                  null,
                  2,
                )}
              </pre>
            ) : (
              <div className="dash-board">
                <div className="dash-grid">
                  <div className="dash-tile">
                    <span>{tr("health")}</span>
                    <strong>{health?.ok ? tr("ok") : tr("unknown")}</strong>
                  </div>
                  <div className="dash-tile">
                    <span>{tr("env")}</span>
                    <strong>{displayEnv}</strong>
                  </div>
                  <div className="dash-tile">
                    <span>{tr("channels")}</span>
                    <strong>{channels.length}</strong>
                  </div>
                  <div className="dash-tile">
                    <span>{tr("plugins")}</span>
                    <strong>{plugins.length}</strong>
                  </div>
                  <div className="dash-tile">
                    <span>{tr("pluginKindChannel")}</span>
                    <strong>
                      {plugins.filter((p) => resolveAdapterScope(p) !== "all").length}
                    </strong>
                  </div>
                  <div className="dash-tile">
                    <span>{tr("pluginKindFramework")}</span>
                    <strong>
                      {plugins.filter((p) => resolveAdapterScope(p) === "all").length}
                    </strong>
                  </div>
                  <div className="dash-tile">
                    <span>{tr("messages")}</span>
                    <strong>
                      {dbInfo?.stats?.messages ?? meta?.db?.messages ?? feedItems.length}
                    </strong>
                  </div>
                  <div className="dash-tile">
                    <span>{tr("dbDriver")}</span>
                    <strong>{dbInfo?.info?.driver ?? "…"}</strong>
                  </div>
                  <div className="dash-tile">
                    <span>{tr("powerState")}</span>
                    <strong>{feedPowerOff ? tr("powerOff") : tr("powerOn")}</strong>
                  </div>
                  <div className="dash-tile">
                    <span>{tr("onebotStatus")}</span>
                    <strong>
                      {onebotInfo?.connected ? tr("onebotConnected") : tr("onebotDisconnected")}
                    </strong>
                  </div>
                  <div className="dash-tile">
                    <span>{tr("aiProvider")}</span>
                    <strong>
                      {llmInfo?.providers?.find((p) => p.id === llmInfo.activeId)?.name ?? "—"}
                    </strong>
                  </div>
                  <div className="dash-tile">
                    <span>{tr("user")}</span>
                    <strong>{adminUser || "…"}</strong>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {panel === "database" && (
          <section className="panel">
            <div className="hero hero-with-raw">
              <div>
                <h1
                  className="title-toggle"
                  onClick={() => setRawPage((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setRawPage((v) => !v);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {tr("database")}
                </h1>
                <p>{tr("databaseHeroMulti")}</p>
              </div>
              <button type="button" className="btn ghost mini" onClick={() => setRawPage((v) => !v)}>
                {rawPage ? tr("hideRaw") : tr("showRaw")}
              </button>
            </div>
            {rawPage ? (
              <pre className="code-block raw-page">{JSON.stringify(dbInfo ?? meta?.db ?? {}, null, 2)}</pre>
            ) : (
              <>
                <div className="form">
                  <button type="button" className="btn" onClick={() => void openDbSwitchModal()}>
                    {tr("dbSwitchOpen")}
                  </button>
                </div>
                {actionMsg && <p className="muted pad">{actionMsg}</p>}
                <div className="chips">
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
              </>
            )}
          </section>
        )}

        {panel === "status" && (
          <section className="panel">
            <div className="hero">
              <h1>{tr("dashboard")}</h1>
              <p>{tr("dashboardHero")}</p>
            </div>
            <div className="form">
              <button type="button" className="btn" onClick={() => setPanel("dashboard")}>
                {tr("openDashboard")}
              </button>
            </div>
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
              <p className="muted">
                {tr("frameworkVersion")}: {meta?.version ?? "…"}
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => void checkFrameworkUpdate()}
              >
                {tr("checkUpdate")}
              </button>
              {actionMsg && <p className="muted">{actionMsg}</p>}
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
            <div className="admin-row">
              <div>
                <strong>{tr("changePassword")}</strong>
                <p className="muted">{tr("changePasswordHint")}</p>
              </div>
              <button type="button" className="btn" onClick={() => openPasswordModal()}>
                {tr("changePasswordBtn")}
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
                      <strong>
                        {Array.isArray((overview as { plugins?: unknown[] }).plugins)
                          ? (overview as { plugins: unknown[] }).plugins.length
                          : "…"}
                      </strong>
                    </div>
                    <div className="chip">
                      {tr("channels")}{" "}
                      <strong>
                        {Array.isArray((overview as { channels?: unknown[] }).channels)
                          ? (overview as { channels: unknown[] }).channels.length
                          : "…"}
                      </strong>
                    </div>
                  </div>
                }
                raw={overview}
              />
            )}
          </section>
        )}

        {panel === "env-setup" && (
          <section className="panel">
            <div className="hero">
              <h1>{tr("envSetup")}</h1>
              <p>{tr("envSetupHero")}</p>
            </div>
            <div className="env-grid">
              {envRuntimes.map((rt) => (
                <button
                  type="button"
                  key={rt.id}
                  className={`env-card ${envPickRuntime === rt.id ? "active" : ""}`}
                  onClick={() => {
                    setEnvPickRuntime(rt.id);
                    setEnvPickVersion(rt.versions[0] || "");
                    setEnvPickMode(rt.modes.includes("binary") ? "binary" : rt.modes[0] || "binary");
                    if (!rt.installed && token) {
                      void api("/v1/admin/env-tasks", {
                        method: "POST",
                        token,
                        body: JSON.stringify({
                          runtime: rt.id,
                          version: rt.versions[0],
                          mode: rt.modes.includes("binary") ? "binary" : "compile",
                          auto: true,
                        }),
                      }).then(() => void refreshEnv());
                    }
                  }}
                >
                  <strong>{rt.label}</strong>
                  <span className="muted">
                    {rt.installed
                      ? `${tr("envInstalled")}: ${rt.activeVersion || "—"}`
                      : tr("envNotInstalledAuto")}
                  </span>
                </button>
              ))}
            </div>
            {actionMsg && <p className="muted pad">{actionMsg}</p>}
            <div className="hero sub">
              <h1>{tr("envLiveInstall")}</h1>
              <p>{tr("envLiveInstallHint")}</p>
            </div>
            {envTasks.filter((t) => t.status === "pending" || t.status === "running").length ===
              0 && <p className="muted pad">{tr("noEnvTasksRunning")}</p>}
            {envTasks
              .filter((t) => t.status === "pending" || t.status === "running" || t.status === "failed")
              .slice(0, 6)
              .map((task) => (
                <div className="install-block" key={task.id}>
                  <div className="install-head">
                    <strong>
                      {task.runtime} · {task.version}
                    </strong>
                    <span className="muted">
                      {tr(`taskStatus_${task.status}`)} · {task.progress ?? 0}%
                    </span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${task.progress ?? 0}%` }} />
                  </div>
                  <pre className="code-block install-log">
                    {(task.logs && task.logs.length
                      ? task.logs
                      : [tr("envWaitingLog")]
                    ).join("\n")}
                  </pre>
                </div>
              ))}
            <div className="form">
              <button type="button" className="btn ghost" onClick={() => setPanel("env-tasks")}>
                {tr("envTasks")}
              </button>
            </div>
          </section>
        )}

        {panel === "env-tasks" && (
          <section className="panel">
            <div className="hero">
              <h1>{tr("envTasks")}</h1>
              <p>{tr("envTasksHero")}</p>
            </div>
            {(["running", "pending", "failed", "done", "paused"] as const).map((st) => {
              const rows = envTasks.filter((t) => t.status === st);
              if (rows.length === 0 && st !== "running" && st !== "pending") return null;
              return (
                <div key={st}>
                  <div className="hero sub">
                    <h1>
                      {tr(`taskStatus_${st}`)} ({rows.length})
                    </h1>
                  </div>
                  <div className="list">
                    {rows.length === 0 && <p className="muted pad">{tr("noEnvTasks")}</p>}
                    {rows.map((task) => (
                      <div className="install-block" key={task.id}>
                        <div className="install-head">
                          <strong>
                            {task.runtime} · {task.version}
                          </strong>
                          <span className="muted">
                            {task.note || task.id} · {task.progress ?? 0}%
                          </span>
                        </div>
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{ width: `${task.progress ?? 0}%` }}
                          />
                        </div>
                        <pre className="code-block install-log">
                          {(task.logs && task.logs.length
                            ? task.logs
                            : [tr("envWaitingLog")]
                          ).join("\n")}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {panel === "plugins" && (
          <section className="panel">
            {pluginLayer.step === "home" && (
              <>
                <div className="hero">
                  <h1>{tr("pluginManage")}</h1>
                  <p>{tr("pluginManageLayerHero")}</p>
                </div>
                <div className="layer-grid">
                  <button
                    type="button"
                    className="layer-card"
                    onClick={() => openPluginList("channel")}
                  >
                    <strong>{tr("pluginKindChannel")}</strong>
                    <span>{tr("pluginKindChannelHint")}</span>
                  </button>
                  <button
                    type="button"
                    className="layer-card"
                    onClick={() => openPluginList("framework")}
                  >
                    <strong>{tr("pluginKindFramework")}</strong>
                    <span>{tr("pluginKindFrameworkHint")}</span>
                  </button>
                  <button
                    type="button"
                    className="layer-card"
                    onClick={() => openPluginDocs("channel")}
                  >
                    <strong>{tr("docsChannel")}</strong>
                    <span>{tr("docsChannelHint")}</span>
                  </button>
                  <button
                    type="button"
                    className="layer-card"
                    onClick={() => openPluginDocs("framework")}
                  >
                    <strong>{tr("docsFramework")}</strong>
                    <span>{tr("docsFrameworkHint")}</span>
                  </button>
                </div>
              </>
            )}

            {pluginLayer.step === "channels" && (
              <>
                <div className="hero">
                  <p className="crumb">
                    <button type="button" className="linkish" onClick={() => backPluginLayer()}>
                      {tr("pluginManage")}
                    </button>
                    <span> / </span>
                    <strong>{tr("pluginKindChannel")}</strong>
                  </p>
                  <h1>{tr("pluginKindChannel")}</h1>
                  <p>{tr("pluginChannelPickHero")}</p>
                </div>
                <div className="list">
                  {channels.length === 0 && <p className="muted pad">{tr("noChannels")}</p>}
                  {channels.map((c) => {
                    const count = pluginsVisibleOnChannel(plugins, c.id).length;
                    return (
                      <div className="list-row" key={c.id}>
                        <div>
                          <strong>{channelLabel(locale, c.id, c.label)}</strong>
                          <div className="muted">
                            {c.id}
                            {c.masters?.length
                              ? ` · ${tr("channelMastersShort")}:${c.masters.length}`
                              : ` · ${tr("mastersNotSet")}`}
                          </div>
                        </div>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn mini ghost"
                            onClick={() => openChannelMastersFromPlugins(c.id)}
                          >
                            {tr("channelSettings")}
                          </button>
                          <button
                            type="button"
                            className="btn mini"
                            onClick={() => openPluginList("channel", c.id)}
                          >
                            {tr("channelPluginManage")} · {count}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="form">
                  <button type="button" className="btn ghost" onClick={() => backPluginLayer()}>
                    {tr("backLayer")}
                  </button>
                </div>
              </>
            )}

            {pluginLayer.step === "list" && (
              <>
                <div className="hero">
                  <p className="crumb">
                    <button type="button" className="linkish" onClick={() => backPluginLayer()}>
                      {pluginLayer.kind === "channel" && pluginLayer.channelId
                        ? tr("pluginKindChannel")
                        : tr("pluginManage")}
                    </button>
                    <span> / </span>
                    <strong>
                      {pluginLayer.kind === "channel"
                        ? tr("pluginKindChannel")
                        : tr("pluginKindFramework")}
                    </strong>
                    {pluginLayer.channelId ? (
                      <>
                        <span> / </span>
                        <strong>{pluginLayer.channelId}</strong>
                      </>
                    ) : null}
                  </p>
                  <h1>
                    {pluginLayer.kind === "channel"
                      ? tr("pluginKindChannel")
                      : tr("pluginKindFramework")}
                  </h1>
                  <p>
                    {pluginLayer.kind === "channel"
                      ? tr("pluginKindChannelHint")
                      : tr("pluginKindFrameworkHint")}
                  </p>
                </div>
                {pluginLayer.kind === "channel" && pluginLayer.channelId ? (
                  <div className="form" style={{ paddingTop: 0 }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => openChannelMastersFromPlugins(pluginLayer.channelId!)}
                    >
                      {tr("configMasters")}
                    </button>
                    <p className="muted">{tr("channelSettingsHint")}</p>
                  </div>
                ) : null}
                {actionMsg && <p className="muted pad">{actionMsg}</p>}
                <div className="list">
                  {filteredPlugins.length === 0 && (
                    <p className="muted pad">
                      {pluginLayer.kind === "channel"
                        ? tr("noChannelPluginsHint")
                        : tr("noPlugins")}
                    </p>
                  )}
                  {filteredPlugins.map((p) => (
                    <div className="list-row" key={p.id}>
                      <div>
                        <strong>{pluginDisplayName(p)}</strong>
                        <span className="cat-pill">{scopeLabel(resolveAdapterScope(p))}</span>
                        <div className="muted">
                          {p.id}
                          {p.version ? ` @${p.version}` : ""}
                          {p.enabled === false ? ` · ${tr("pluginDisabled")}` : ""}
                          {p.channels?.length ? ` · ${p.channels.join(",")}` : ""}
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
                <div className="form">
                  <button type="button" className="btn ghost" onClick={() => backPluginLayer()}>
                    {tr("backLayer")}
                  </button>
                </div>
              </>
            )}

            {pluginLayer.step === "docs" && (
              <>
                <div className="hero">
                  <p className="crumb">
                    <button type="button" className="linkish" onClick={() => backPluginLayer()}>
                      {tr("pluginManage")}
                    </button>
                    <span> / </span>
                    <strong>
                      {pluginLayer.kind === "channel" ? tr("docsChannel") : tr("docsFramework")}
                    </strong>
                  </p>
                  <h1>
                    {pluginLayer.kind === "channel" ? tr("docsChannel") : tr("docsFramework")}
                  </h1>
                  <p>
                    {pluginLayer.kind === "channel"
                      ? tr("docsChannelHint")
                      : tr("docsFrameworkHint")}
                  </p>
                </div>
                <div className="form">
                  <p className="muted">
                    {pluginLayer.kind === "channel"
                      ? tr("docsChannelBody")
                      : tr("docsFrameworkBody")}
                  </p>
                  <pre className="code-block">
                    {pluginLayer.kind === "channel"
                      ? `manifest.id = "z.onebot.hi";   // 英文 id
manifest.name = "QQ 打招呼"; // 中文显示名
manifest.kind = "channel";
manifest.adapterScope = "channel";
manifest.channels = ["onebot11"];
rule = [{ reg: "^#hi$", fnc: "hi" }];
async hi(e) {
  if (e.channel !== "onebot11") return;
  await e.reply("…");
}`
                      : `manifest.id = "z.menu";  // 英文 id
manifest.name = "菜单"; // 中文显示名（管理端显示这个）
manifest.kind = "framework";
manifest.adapterScope = "all";
rule = [{ reg: "^#菜单$", fnc: "menu" }];
async menu(e) {
  await e.reply("菜单…");
}`}
                  </pre>
                  <button type="button" className="btn ghost" onClick={() => backPluginLayer()}>
                    {tr("backLayer")}
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </main>

      <FloatModal
        open={uiModal?.kind === "update"}
        onClose={closeModal}
        title={tr("updateTitle")}
        subtitle={tr("updateLead")}
        status={modalStatus}
        statusTone={modalTone}
        footer={
          <>
            <button type="button" className="btn ghost" onClick={closeModal} disabled={updateBusy}>
              {tr("updateLater")}
            </button>
            <button
              type="button"
              className="btn"
              disabled={updateBusy || !updateInfo?.updateAvailable}
              onClick={() => void applyFrameworkUpdate()}
            >
              {updateBusy ? tr("updateApplying") : tr("updateNow")}
            </button>
          </>
        }
      >
        {updateInfo ? (
          <div className="chips" style={{ padding: 0 }}>
            <div className="chip">
              {tr("frameworkVersion")} <strong>{updateInfo.currentVersion}</strong>
            </div>
            <div className="chip">
              {tr("remoteVersion")} <strong>{updateInfo.remoteVersion || "—"}</strong>
            </div>
            {updateInfo.currentCommit ? (
              <div className="chip">
                HEAD <strong>{updateInfo.currentCommit}</strong>
              </div>
            ) : null}
            {updateInfo.remoteCommit ? (
              <div className="chip">
                remote <strong>{updateInfo.remoteCommit}</strong>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="muted">{tr("loading")}</p>
        )}
        <p className="muted">{tr("updateConfirmHint")}</p>
      </FloatModal>

      <FloatModal
        open={uiModal?.kind === "password"}
        onClose={closeModal}
        title={tr("changePassword")}
        subtitle={tr("changePasswordHint")}
        status={loginErr || modalStatus}
        statusTone={loginErr ? "error" : modalTone}
        footer={
          <>
            {!pwConfirmStep ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setLoginErr("");
                  if (!curPass) {
                    setLoginErr(tr("currentPassword"));
                    return;
                  }
                  if (newPass && newPass !== newPass2) {
                    setLoginErr(tr("confirmNewPassword"));
                    return;
                  }
                  setPwConfirmStep(true);
                }}
              >
                {tr("updateCreds")}
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => void updateCredentials()}>
                {tr("confirmUpdateCreds")}
              </button>
            )}
          </>
        }
      >
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
          <input type="password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} />
        </label>
        {pwConfirmStep && <p className="muted">{tr("confirmUpdateCredsHint")}</p>}
      </FloatModal>

      <FloatModal
        open={uiModal?.kind === "db"}
        onClose={closeModal}
        title={tr("dbSwitchTitle")}
        subtitle={tr("dbSwitchLead")}
        status={modalStatus}
        statusTone={modalTone}
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
            {(dbDetect.length
              ? dbDetect
              : (dbInfo?.backends ?? []).map((b) => ({
                  id: b.id,
                  label: b.label,
                  available: b.enabled,
                  reason: b.enabled ? undefined : tr("dbDisabled"),
                  recommended: false as boolean | undefined,
                }))
            ).map((d) => (
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
      </FloatModal>

      <FloatModal
        open={uiModal?.kind === "channel-settings"}
        onClose={popModal}
        closeLabel={tr("backLayer")}
        title={tr("channelSettings")}
        subtitle={tr("channelSettingsHint")}
        status={modalStatus}
        statusTone={modalTone}
        footer={
          <button type="button" className="btn" onClick={() => void saveChannelSettings()}>
            {tr("saveChannelSettings")}
          </button>
        }
      >
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
      </FloatModal>

      <FloatModal
        open={uiModal?.kind === "channel-plugins"}
        onClose={closeChannelPluginsModal}
        closeLabel={tr("backLayer")}
        title={tr("channelPluginManage")}
        subtitle={tr("channelPluginManageHint")}
        status={modalStatus}
        statusTone={modalTone}
      >
        <div className="form" style={{ padding: 0, marginBottom: 12 }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (activeChannelId) openChannelMastersFromPlugins(activeChannelId);
            }}
          >
            {tr("configMasters")}
          </button>
          <p className="muted">{tr("channelSettingsHint")}</p>
        </div>
        <div className="list compact">
          {pluginsVisibleOnChannel(plugins, activeChannelId).length === 0 && (
            <p className="muted">{tr("noPlugins")}</p>
          )}
          {pluginsVisibleOnChannel(plugins, activeChannelId).map((p) => (
            <div className="list-row" key={p.id}>
              <div>
                <strong>{pluginDisplayName(p)}</strong>
                <span className="cat-pill">{scopeLabel(resolveAdapterScope(p))}</span>
                <div className="muted">
                  {p.id}
                  {p.enabled === false ? ` · ${tr("pluginDisabled")}` : ""}
                </div>
              </div>
              <div className="row-actions">
                <button type="button" className="btn mini" onClick={() => void openPluginConfig(p.id)}>
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
      </FloatModal>

      <FloatModal
        open={uiModal?.kind === "channel-docs"}
        onClose={closeModal}
        title={tr("pluginBaseline")}
        subtitle={activeChannelId ? `${tr("channelId")}: ${activeChannelId}` : undefined}
      >
        {hint ? (
          <>
            <p className="muted">{hint.tip}</p>
            <p className="muted">{tr("canonicalPattern")}</p>
            <pre className="code-block">{hint.sample}</pre>
          </>
        ) : (
          <p className="muted">{tr("noChannelDocs")}</p>
        )}
      </FloatModal>

      <FloatModal
        open={uiModal?.kind === "onebot-conn"}
        onClose={closeModal}
        title={tr("onebotConn")}
        subtitle={tr("onebotHint")}
        status={modalStatus}
        statusTone={modalTone}
        footer={
          <>
            <button type="button" className="btn ghost" onClick={() => void refreshOnebot()}>
              {tr("refresh")}
            </button>
            <button type="button" className="btn" onClick={() => void saveOnebot()}>
              {tr("onebotSave")}
            </button>
          </>
        }
      >
        <div className="chips" style={{ padding: 0 }}>
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
      </FloatModal>

      <FloatModal
        open={uiModal?.kind === "plugin-config"}
        closeLabel={tr("backLayer")}
        onClose={() => {
          setModalStatus("");
          // 从本通道插件弹窗进入 → 回到本通道插件管理
          if (panel === "channel-detail") {
            setModalBack(null);
            setUiModal({ kind: "channel-plugins" });
            return;
          }
          // 从「带通道 id 的通道插件列表」进入 → 回到该列表，不进框架首页
          if (
            panel === "plugins" &&
            pluginLayer.step === "list" &&
            pluginLayer.kind === "channel" &&
            pluginLayer.channelId
          ) {
            closeModal();
            return;
          }
          closeModal();
        }}
        title={
          pluginDisplayName(plugins.find((p) => p.id === activePluginId) || { id: activePluginId }) ||
          tr("plugins")
        }
        subtitle={tr("pluginConfigHero")}
        status={modalStatus}
        statusTone={modalTone}
        footer={
          pluginCfg?.supported ? (
            <button type="button" className="btn" onClick={() => void savePluginConfig()}>
              {tr("saveConfig")}
            </button>
          ) : undefined
        }
      >
        {!pluginCfg ? (
          <p className="muted">{tr("loading")}</p>
        ) : !pluginCfg.supported ? (
          <p>{pluginCfg.message || tr("pluginNoConfig")}</p>
        ) : (
          <>
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
          </>
        )}
      </FloatModal>
    </div>
  );
}
