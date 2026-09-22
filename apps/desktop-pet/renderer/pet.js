/**
 * 桌宠渲染：本地麦克风呼唤 + 对话，请求本机网关。
 */
(() => {
  /** @type {{ gatewayUrl: string; token: string; wakeWords: string[]; chatId: string; userId: string }} */
  let runtime = {
    gatewayUrl: "http://127.0.0.1:8787",
    token: "",
    wakeWords: ["喵璃", "小璃", "Nexus", "风云"],
    chatId: "desktop-pet",
    userId: "desktop-pet",
  };

  const pet = document.getElementById("pet");
  const bubble = document.getElementById("bubble");
  const statusEl = document.getElementById("status");
  const btnMic = document.getElementById("btnMic");
  const btnQuit = document.getElementById("btnQuit");

  let mood = "idle";
  let listening = false;
  let conversing = false;
  let busy = false;
  /** @type {SpeechRecognition | null} */
  let recog = null;
  let converseTimer = 0;
  let bubbleTimer = 0;

  function setMood(next) {
    mood = next;
    if (pet) pet.dataset.mood = next;
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function showBubble(text, ms = 8000) {
    if (!bubble) return;
    const t = String(text || "").trim();
    if (!t) {
      bubble.hidden = true;
      return;
    }
    bubble.hidden = false;
    bubble.textContent = t.length > 180 ? `${t.slice(0, 180)}…` : t;
    window.clearTimeout(bubbleTimer);
    bubbleTimer = window.setTimeout(() => {
      bubble.hidden = true;
    }, ms);
  }

  function speak(text) {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text || "").slice(0, 400));
      u.lang = "zh-CN";
      u.rate = 1.05;
      setMood("talk");
      u.onend = () => {
        if (!listening) setMood("idle");
        else setMood(conversing ? "listen" : "idle");
      };
      window.speechSynthesis.speak(u);
    } catch {
      setMood(listening ? "listen" : "idle");
    }
  }

  function stripWake(text) {
    let t = String(text || "").trim();
    for (const w of runtime.wakeWords || []) {
      if (!w) continue;
      const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
      t = t.replace(re, " ");
    }
    return t.replace(/\s+/g, " ").trim();
  }

  function hitWake(text) {
    const raw = String(text || "");
    return (runtime.wakeWords || []).some((w) => w && raw.includes(w));
  }

  function armConverseWindow() {
    conversing = true;
    window.clearTimeout(converseTimer);
    converseTimer = window.setTimeout(() => {
      conversing = false;
      if (listening) setStatus("听呼唤中…");
    }, 25_000);
  }

  async function askGateway(userText) {
    const content = String(userText || "").trim();
    if (!content || busy) return;
    if (!runtime.token) {
      showBubble("还没拿到会话令牌，请在控制台重新打开桌宠开关。");
      return;
    }
    busy = true;
    setStatus("思考中…");
    setMood("talk");
    try {
      const res = await fetch(`${runtime.gatewayUrl}/v1/chat/stream`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${runtime.token}`,
        },
        body: JSON.stringify({
          content,
          chatId: runtime.chatId || "desktop-pet",
          userId: runtime.userId || "desktop-pet",
        }),
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let got = "";
      const flush = (line) => {
        const s = line.trim();
        if (!s.startsWith("data:")) return;
        const payload = s.slice(5).trim();
        if (!payload) return;
        let data;
        try {
          data = JSON.parse(payload);
        } catch {
          return;
        }
        if (data.error) throw new Error(data.error);
        if (data.delta) got += data.delta;
        if (data.done && data.assistant && !got) got = data.assistant;
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split(/\r?\n/);
        buf = lines.pop() || "";
        for (const line of lines) flush(line);
      }
      if (buf.trim()) flush(buf);
      const reply = (got || "（无回复）").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      showBubble(reply, 12_000);
      speak(reply);
      setStatus(listening ? (conversing ? "继续说…" : "听呼唤中…") : "待命");
    } catch (e) {
      const tip = e instanceof Error ? e.message : String(e);
      showBubble(`对话失败：${tip}`);
      setStatus("对话失败");
      setMood(listening ? "listen" : "idle");
    } finally {
      busy = false;
    }
  }

  function handleHeard(text) {
    const raw = String(text || "").trim();
    if (!raw) return;
    if (!conversing) {
      if (!hitWake(raw)) return;
      armConverseWindow();
      setStatus("我在，请说…");
      showBubble("嗯？我在听。", 2500);
      speak("我在");
      const rest = stripWake(raw);
      if (rest.length >= 2) void askGateway(rest);
      return;
    }
    armConverseWindow();
    const ask = stripWake(raw) || raw;
    if (ask.length < 1) return;
    void askGateway(ask);
  }

  function makeRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.lang = "zh-CN";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    let lastFinal = "";
    r.onresult = (ev) => {
      let finalText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const row = ev.results[i];
        if (row.isFinal) finalText += row[0].transcript;
      }
      finalText = finalText.trim();
      if (!finalText || finalText === lastFinal) return;
      lastFinal = finalText;
      handleHeard(finalText);
    };
    r.onerror = (ev) => {
      if (ev.error === "not-allowed") {
        setStatus("麦克风被拒绝");
        listening = false;
        btnMic.textContent = "开麦";
        setMood("idle");
      }
    };
    r.onend = () => {
      if (listening) {
        try {
          r.start();
        } catch {
          /* ignore */
        }
      }
    };
    return r;
  }

  function startListen() {
    if (!recog) recog = makeRecognition();
    if (!recog) {
      setStatus("本机不支持语音识别");
      showBubble("当前环境没有语音识别。可点角色后用键盘…（请用呼唤+说话）");
      return;
    }
    listening = true;
    btnMic.textContent = "关麦";
    setMood("listen");
    setStatus("听呼唤中…");
    try {
      recog.start();
    } catch {
      /* already started */
    }
  }

  function stopListen() {
    listening = false;
    conversing = false;
    btnMic.textContent = "开麦";
    setMood("idle");
    setStatus("待命 · 呼唤名字或点我");
    try {
      recog?.stop();
    } catch {
      /* ignore */
    }
  }

  btnMic?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (listening) stopListen();
    else startListen();
  });

  btnQuit?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (window.nexusPet?.quit) void window.nexusPet.quit();
    else window.close();
  });

  pet?.addEventListener("click", () => {
    if (!listening) startListen();
    else {
      armConverseWindow();
      setStatus("我在，请说…");
      showBubble("点到我啦，说吧。", 2000);
      speak("我在");
    }
  });

  if (window.nexusPet?.onRuntime) {
    window.nexusPet.onRuntime((data) => {
      if (!data || typeof data !== "object") return;
      runtime = {
        gatewayUrl: String(data.gatewayUrl || runtime.gatewayUrl).replace(/\/$/, ""),
        token: String(data.token || ""),
        wakeWords: Array.isArray(data.wakeWords) && data.wakeWords.length
          ? data.wakeWords.map(String)
          : runtime.wakeWords,
        chatId: String(data.chatId || "desktop-pet"),
        userId: String(data.userId || "desktop-pet"),
      };
      setStatus("已连接网关 · 自动开麦");
      startListen();
    });
  } else {
    setStatus("未注入运行时，仍可试麦");
  }
})();
