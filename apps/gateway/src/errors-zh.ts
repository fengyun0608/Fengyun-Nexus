export type TranslatedError = {
  type: string;
  title: string;
  hint: string;
  raw: string;
};

/** Map Node/network errors to Chinese console tips. */
export function translateError(err: unknown): TranslatedError {
  const raw = err instanceof Error ? err.message : String(err);
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code ?? "")
      : "";

  if (code === "EADDRINUSE" || /EADDRINUSE|address already in use/i.test(raw)) {
    return {
      type: "port_in_use",
      title: "端口被占用",
      hint: "当前端口已被其它程序占用。请关掉旧的 Nexus/网关进程，或换 PORT 环境变量后再启动。",
      raw,
    };
  }
  if (code === "ECONNREFUSED" || /ECONNREFUSED/i.test(raw)) {
    return {
      type: "conn_refused",
      title: "连接被拒绝",
      hint: "目标服务未启动或地址/端口写错。请检查 AI Base URL、数据库或 OneBot 对端是否在线。",
      raw,
    };
  }
  if (code === "ENOTFOUND" || /ENOTFOUND|getaddrinfo/i.test(raw)) {
    return {
      type: "dns",
      title: "域名无法解析",
      hint: "网络或 DNS 异常，或 Base URL 主机名写错。请检查网络与供应商地址。",
      raw,
    };
  }
  if (code === "ETIMEDOUT" || /timeout|ETIMEDOUT/i.test(raw)) {
    return {
      type: "timeout",
      title: "请求超时",
      hint: "对端响应太慢或网络不通。可稍后重试，或检查防火墙/代理。",
      raw,
    };
  }
  if (/401|Unauthorized|invalid.*key|Incorrect API key/i.test(raw)) {
    return {
      type: "auth",
      title: "鉴权失败",
      hint: "API Key / Token 无效或未配置。请到「AI 供应商」或 OneBot 开发区检查密钥。",
      raw,
    };
  }
  if (/ENOENT|no such file/i.test(raw)) {
    return {
      type: "file_missing",
      title: "文件不存在",
      hint: "缺少配置或数据文件。确认路径是否正确，或重新执行 pnpm boot 生成默认文件。",
      raw,
    };
  }
  if (/LLM error/i.test(raw)) {
    return {
      type: "llm",
      title: "AI 供应商调用失败",
      hint: "模型接口返回错误。请核对 Base URL、模型名与额度，或切换其它供应商。",
      raw,
    };
  }
  return {
    type: "unknown",
    title: "未知错误",
    hint: "请查看「日志」面板中的详细信息；若反复出现，把错误类型反馈给维护者。",
    raw,
  };
}

export function formatErrorForClient(err: unknown): {
  error: string;
  errorType: string;
  hint: string;
  raw?: string;
} {
  const t = translateError(err);
  return {
    error: `${t.title}：${t.hint}`,
    errorType: t.type,
    hint: t.hint,
    raw: t.raw,
  };
}
