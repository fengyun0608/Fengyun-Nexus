/** Product brand — always English in every locale. */
export const BRAND = "Fengyun Nexus";

export type Locale = "zh" | "en";

export const LANG_KEY = "nexus_lang";

export function readLocale(): Locale {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === "en" || v === "zh") return v;
  } catch {
    /* ignore */
  }
  return "zh";
}

export function writeLocale(locale: Locale): void {
  try {
    localStorage.setItem(LANG_KEY, locale);
  } catch {
    /* ignore */
  }
}

type Dict = Record<string, string>;

const zh: Dict = {
  restoring: "正在恢复登录…",
  signInLead: "登录后进入控制台。",
  username: "用户名",
  password: "密码",
  signIn: "登录",
  defaultCreds: "初始账号：console / console",
  firstSetup: "首次设置",
  firstSetupLead: "请设置正式用户名与密码。",
  newUsername: "新用户名（4–8 位英文字母）",
  newPassword: "新密码",
  confirmPassword: "确认密码",
  saveRelogin: "保存并重新登录",
  channels: "消息通道",
  allChannels: "全部通道",
  usage: "使用",
  workspace: "工作区",
  chat: "对话",
  status: "运行状态",
  automation: "自动化",
  workflows: "工作流",
  mcpTools: "MCP 工具",
  plugins: "插件",
  registry: "插件更新",
  pluginUpdate: "插件更新",
  aiProvider: "AI 供应商",
  data: "数据",
  database: "数据库",
  dbCurrent: "当前数据库",
  settings: "系统设置",
  config: "配置",
  admin: "管理",
  refresh: "刷新状态",
  collapse: "收起",
  menu: "目录",
  chatHero: "框架内对话。可用 /echo 你好 测试插件。",
  typeMessage: "输入消息…",
  send: "发送",
  sending: "发送中…",
  channelsHero: "通过 ChannelRegistry 插拔适配器。每个通道有对应的插件写法基准。",
  noChannels: "暂无通道",
  openBaseline: "打开查看插件写法基准",
  online: "运行中",
  channelId: "通道 id",
  pluginBaseline: "本通道的插件编写基准。",
  canonicalPattern:
    "标准写法：继承 Plugin，用 rule 或 accept(e) 匹配，e.reply() 回复，必要时用 e.channel 过滤。插件 id 优先 z.*。",
  backChannels: "返回全部通道",
  workflowsHero: "已注册工作流。可在此试跑（trigger / memory / llm / tool / delay / branch）。",
  noWorkflows: "暂无工作流",
  ready: "就绪",
  runWorkflow: "试跑",
  running: "运行中…",
  runResult: "运行结果",
  mcpHero: "MCP Host 已暴露的工具。",
  noTools: "暂无工具",
  tool: "工具",
  databaseHero: "嵌入式存储：data/nexus.db.json",
  messages: "消息",
  kv: "键值",
  statusHero: "网关健康检查、数据库与环境信息。",
  health: "健康",
  env: "环境",
  user: "用户",
  configHero: "也可用指令：pnpm nexus setup / env / set。本地配置不会上传。",
  runtimeProfile: "当前运行姿态（只读；切换请用 nexus env）",
  sessionPolicy: "会话：刷新保持登录 · {hours} 小时过期 · 改密踢全部会话",
  features: "已启用能力",
  pluginsLoaded: "已加载插件",
  manageCreds: "去管理端改账号密码",
  language: "界面语言",
  langZh: "中文",
  langEn: "English",
  languageHint: "默认中文。产品名称始终为 Fengyun Nexus。",
  adminHero: "当前登录：{user}。刷新页面会保持登录态。",
  signOut: "退出登录",
  currentPassword: "当前密码",
  newUsernameOpt: "新用户名（可空）",
  newPasswordOpt: "新密码（可空）",
  confirmNewPassword: "确认新密码",
  updateCreds: "更新凭据",
  pluginsHero: "已加载插件在左侧「使用」中逐个显示；点开即可配置。",
  noPlugins: "暂无插件",
  loaded: "已加载",
  openConfig: "打开配置",
  pluginConfigHero: "插件可扩展配置表单。未声明 schema 的插件会提示暂未支持。",
  pluginNoConfig: "该插件暂未支持配置",
  saveConfig: "保存配置",
  loading: "加载中…",
  on: "开",
  off: "关",
  needLogin: "请先登录管理端",
  registryHero: "从仓库同步与登记插件。Token 仅存本地。",
  registryBase: "仓库地址",
  registryToken: "仓库 Token",
  registryTokenOk: "已配置",
  registryTokenMissing: "未配置（pnpm nexus set registry-token）",
  registryCategories: "分类",
  publishPlugin: "登记上传",
  pickPlugin: "选择本地插件",
  pickCategory: "选择分类",
  publishBtn: "提交上传意图",
  aiHero: "配置对话用的大模型供应商（OpenAI 兼容接口）。密钥仅存本地 llm.local.json。",
  aiHeroMulti: "多供应商按分类管理（cloud / local / custom），可实时切换，立即生效。",
  aiActive: "使用中",
  aiSwitch: "切换",
  aiEditProvider: "编辑供应商",
  aiApiKey: "API Key",
  logs: "日志",
  logsHero: "网关运行日志（内存环形缓冲）。报错会尽量翻译成中文提示。",
  noLogs: "暂无日志",
  showRaw: "查看原始数据",
  hideRaw: "收起原始数据",
  databaseHeroMulti: "独立数据库分类：点击切换时先检测环境，再用悬浮窗配置连接。",
  dbActive: "已连接",
  dbSwitch: "切换",
  dbSwitchOpen: "切换数据库",
  dbSwitchTitle: "切换数据库",
  dbSwitchLead: "已检测本机可用驱动，选择后写入连接并立即生效。",
  dbDetecting: "正在检测环境…",
  dbRedetect: "重新检测",
  dbPick: "可用数据库",
  dbPath: "数据文件路径",
  dbApply: "应用并连接",
  dbRecommended: "推荐",
  dbAvailable: "可用",
  dbUnavailable: "不可用",
  dbDisabled: "未启用",
  dbDriver: "驱动",
  dbEngine: "引擎",
  aiBaseUrl: "Base URL",
  aiModel: "模型名",
  aiSave: "保存供应商",
  aiClearKey: "清除密钥",
  aiHasKey: "已配置密钥",
  aiNoKey: "未配置密钥（无自动回复）",
  saveOk: "已保存",
  welcome:
    "欢迎使用 Fengyun Nexus。试试 /echo 你好。未配置 AI 时不会自动回复（插件仍可用）。",
  requestFailed: "请求失败：{msg}",
  sessionExpired: "登录已过期，请重新登录。",
  setPermanent: "请设置正式用户名与密码。",
  setupDone: "配置完成，请重新登录。",
  credsUpdated: "凭据已更新，请重新登录。",
  ok: "正常",
  unknown: "未知",
  ch_web_title: "网页控制台通道",
  ch_web_tip: "入站：POST /v1/chat。插件侧 e.channel === \"web\"，用 e.reply() 回复。",
  ch_webhook_title: "HTTP Webhook 通道",
  ch_webhook_tip:
    "入站：POST /v1/channels/webhook（content|text、chatId|room、userId|from）。",
  ch_web_label: "网页控制台",
  ch_webhook_label: "HTTP Webhook",
  ch_onebot11_title: "OneBot 11 通道",
  ch_onebot11_tip:
    "入站：OneBot 11 事件（NapCat）。插件侧 e.channel === \"onebot11\"，用 e.reply() 回复。",
  ch_onebot11_label: "OneBot 11",
  env_desktop: "电脑端",
  env_mobile: "手机端",
  env_server: "服务器",
  env_termux: "Termux",
  onebotDev: "OneBot 11 开发区",
  onebotHero:
    "内置 OneBot 11（兼容 NapCat）。在 NapCat 配置「WS 客户端」连到本框架反向 WS；有连接后自动适配。",
  onebotDocs: "NapCat 文档",
  onebotStatus: "连接状态",
  onebotConnected: "已连接",
  onebotDisconnected: "未连接",
  onebotClients: "客户端数",
  onebotSelfId: "Bot QQ",
  onebotWsPath: "反向 WS 路径",
  onebotHttpPath: "HTTP 上报路径",
  onebotToken: "Access Token（可空）",
  onebotEnabled: "启用 OneBot 11",
  onebotSave: "保存通道配置",
  onebotHint:
    "NapCat → 网络配置 → 新建「WebSocket 客户端」，URL 填 ws://127.0.0.1:端口/onebot/v11/ws。未对接 AI 且无插件命中时不回复。",
};
const en: Dict = {
  restoring: "Restoring session…",
  signInLead: "Sign in to open the console.",
  username: "Username",
  password: "Password",
  signIn: "Sign in",
  defaultCreds: "Default: console / console",
  firstSetup: "First-time setup",
  firstSetupLead: "Set a permanent username and password.",
  newUsername: "New username (4–8 English letters)",
  newPassword: "New password",
  confirmPassword: "Confirm password",
  saveRelogin: "Save & re-login",
  channels: "Message Channels",
  allChannels: "All channels",
  usage: "Use",
  workspace: "Workspace",
  chat: "Chat",
  status: "Status",
  automation: "Automation",
  workflows: "Workflows",
  mcpTools: "MCP Tools",
  plugins: "Plugins",
  registry: "Plugin Updates",
  pluginUpdate: "Plugin Updates",
  aiProvider: "AI Provider",
  data: "Data",
  database: "Database",
  dbCurrent: "Current database",
  settings: "Settings",
  config: "Config",
  admin: "Admin",
  refresh: "Refresh",
  collapse: "Collapse",
  menu: "Menu",
  chatHero: "In-framework chat. Try /echo hello.",
  typeMessage: "Type a message…",
  send: "Send",
  sending: "Sending…",
  channelsHero:
    "Pluggable adapters via ChannelRegistry. Each channel has its plugin writing baseline.",
  noChannels: "No channels",
  openBaseline: "Open for plugin baseline",
  online: "online",
  channelId: "Channel id",
  pluginBaseline: "Plugin writing baseline for this adapter.",
  canonicalPattern:
    "Canonical pattern: extend Plugin, match with rule or accept(e), reply via e.reply(), filter with e.channel. Prefer z.* plugin ids.",
  backChannels: "Back to all channels",
  workflowsHero: "Registered flows. Run a trial here (trigger / memory / llm / tool / delay / branch).",
  noWorkflows: "No workflows",
  ready: "ready",
  runWorkflow: "Run",
  running: "Running…",
  runResult: "Run result",
  mcpHero: "Tools exposed by the MCP host.",
  noTools: "No tools",
  tool: "tool",
  databaseHero: "Embedded store at data/nexus.db.json",
  messages: "Messages",
  kv: "KV",
  statusHero: "Gateway health, database, and environment.",
  health: "Health",
  env: "Env",
  user: "User",
  configHero: "CLI: pnpm nexus setup / env / set. Local configs are never uploaded.",
  runtimeProfile: "Runtime profile (read-only; switch with nexus env)",
  sessionPolicy: "Session: refresh keeps login · {hours}h expiry · credential change kicks all",
  features: "Features",
  pluginsLoaded: "Plugins loaded",
  manageCreds: "Manage credentials",
  language: "Language",
  langZh: "中文",
  langEn: "English",
  languageHint: "Default is Chinese. Product name is always Fengyun Nexus.",
  adminHero: "Signed in as {user}. Token persists across page refresh.",
  signOut: "Sign out",
  currentPassword: "Current password",
  newUsernameOpt: "New username (optional)",
  newPasswordOpt: "New password (optional)",
  confirmNewPassword: "Confirm new password",
  updateCreds: "Update credentials",
  pluginsHero: "Loaded plugins appear under Use in the sidebar; open one to configure.",
  noPlugins: "No plugins",
  loaded: "loaded",
  openConfig: "Configure",
  pluginConfigHero: "Extensible plugin config forms. Plugins without a schema show unsupported.",
  pluginNoConfig: "This plugin does not support configuration yet",
  saveConfig: "Save config",
  loading: "Loading…",
  on: "On",
  off: "Off",
  needLogin: "Please sign in first",
  registryHero: "Sync and register plugins from the registry. Token stays local.",
  registryBase: "Registry URL",
  registryToken: "Registry token",
  registryTokenOk: "Configured",
  registryTokenMissing: "Missing (pnpm nexus set registry-token)",
  registryCategories: "Categories",
  publishPlugin: "Publish",
  pickPlugin: "Local plugin",
  pickCategory: "Category",
  publishBtn: "Queue publish",
  aiHero: "Configure the chat LLM (OpenAI-compatible). Key stays in local llm.local.json.",
  aiHeroMulti: "Multi providers by category (cloud / local / custom). Switch in realtime.",
  aiActive: "Active",
  aiSwitch: "Switch",
  aiEditProvider: "Edit provider",
  aiApiKey: "API Key",
  logs: "Logs",
  logsHero: "Gateway logs (in-memory ring). Errors are translated to Chinese tips when possible.",
  noLogs: "No logs",
  showRaw: "Show raw data",
  hideRaw: "Hide raw data",
  databaseHeroMulti: "Dedicated database section: detect environment, then configure in a float modal.",
  dbActive: "Connected",
  dbSwitch: "Switch",
  dbSwitchOpen: "Switch database",
  dbSwitchTitle: "Switch database",
  dbSwitchLead: "Detected available drivers. Pick one and apply to connect immediately.",
  dbDetecting: "Detecting environment…",
  dbRedetect: "Detect again",
  dbPick: "Available databases",
  dbPath: "Data file path",
  dbApply: "Apply & connect",
  dbRecommended: "recommended",
  dbAvailable: "available",
  dbUnavailable: "unavailable",
  dbDisabled: "disabled",
  dbDriver: "Driver",
  dbEngine: "Engine",
  aiBaseUrl: "Base URL",
  aiModel: "Model",
  aiSave: "Save provider",
  aiClearKey: "Clear key",
  aiHasKey: "Key configured",
  aiNoKey: "No key (no auto-reply)",
  saveOk: "Saved",
  welcome:
    "Welcome to Fengyun Nexus. Try /echo hello. Without AI configured there is no auto-reply (plugins still work).",
  requestFailed: "Request failed: {msg}",
  sessionExpired: "Session expired. Please sign in again.",
  setPermanent: "Please set a permanent username and password.",
  setupDone: "Setup complete. Please sign in again.",
  credsUpdated: "Credentials updated. Please sign in again.",
  ok: "OK",
  unknown: "?",
  ch_web_title: "Web Console channel",
  ch_web_tip: 'Inbound via POST /v1/chat. Plugins see e.channel === "web". Reply with e.reply().',
  ch_webhook_title: "HTTP Webhook channel",
  ch_webhook_tip:
    "Inbound via POST /v1/channels/webhook (content|text, chatId|room, userId|from).",
  ch_web_label: "Web Console",
  ch_webhook_label: "HTTP Webhook",
  ch_onebot11_title: "OneBot 11 channel",
  ch_onebot11_tip:
    'Inbound: OneBot 11 events (NapCat). Plugins see e.channel === "onebot11". Reply with e.reply().',
  ch_onebot11_label: "OneBot 11",
  env_desktop: "Desktop",
  env_mobile: "Mobile",
  env_server: "Server",
  env_termux: "Termux",
  onebotDev: "OneBot 11 Lab",
  onebotHero:
    "Built-in OneBot 11 (NapCat-compatible). Point NapCat WS Client to this reverse WS; adapts when connected.",
  onebotDocs: "NapCat docs",
  onebotStatus: "Connection",
  onebotConnected: "Connected",
  onebotDisconnected: "Disconnected",
  onebotClients: "Clients",
  onebotSelfId: "Bot QQ",
  onebotWsPath: "Reverse WS path",
  onebotHttpPath: "HTTP report path",
  onebotToken: "Access Token (optional)",
  onebotEnabled: "Enable OneBot 11",
  onebotSave: "Save channel config",
  onebotHint:
    "NapCat → Network → New WebSocket Client → ws://127.0.0.1:PORT/onebot/v11/ws. No AI and no plugin hit = no reply.",
};

const tables: Record<Locale, Dict> = { zh, en };

export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  let s = tables[locale][key] ?? tables.zh[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

export function channelLabel(locale: Locale, id: string, fallback?: string): string {
  const key = `ch_${id}_label`;
  if (tables[locale][key] || tables.zh[key]) return t(locale, key);
  return fallback || id;
}

export function envLabel(locale: Locale, id: string, fallback?: string): string {
  const key = `env_${id}`;
  if (tables[locale][key] || tables.zh[key]) return t(locale, key);
  return fallback || id;
}

export function channelHint(
  locale: Locale,
  id: string,
): { title: string; tip: string; sample: string } | null {
  const samples: Record<string, string> = {
    web: `rule = [{ reg: "^/hi$", fnc: "hi" }];
async hi(e) {
  if (e.channel !== "web") return;
  await e.reply("hello from web");
}`,
    webhook: `async accept(e, ctx) {
  if (e.channel !== "webhook") return false;
  await e.reply(\`ack: \${e.msg}\`);
  return true;
}`,
    onebot11: `rule = [{ reg: "^你好$", fnc: "hi" }];
async hi(e) {
  if (e.channel !== "onebot11") return;
  await e.reply("你好，我是 Fengyun Nexus");
}`,
  };
  if (!samples[id] && !tables.zh[`ch_${id}_title`]) {
    return {
      title: locale === "zh" ? `${id} 通道` : `${id} channel`,
      tip:
        locale === "zh"
          ? `插件侧 e.channel === "${id}"。使用 rule / accept + e.reply()。`
          : `Plugins receive e.channel === "${id}". Use rule / accept + e.reply().`,
      sample: `async accept(e) {\n  if (e.channel !== "${id}") return false;\n  await e.reply(e.msg);\n  return true;\n}`,
    };
  }
  if (!samples[id]) return null;
  return {
    title: t(locale, `ch_${id}_title`),
    tip: t(locale, `ch_${id}_tip`),
    sample: samples[id],
  };
}
