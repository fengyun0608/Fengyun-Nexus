/**
 * 桌宠渲染层：UI / 对话。
 * 呼唤在主进程 voice/pipeline（可插拔 KWS），不在网页里听写。
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

  let conversing = false;
  let busy = false;
  let speaking = false;
  let converseTimer = 0;
  let bubbleTimer = 0;
  let engineOk = false;

  function setMood(next) {
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

  function armConverseWindow() {
    conversing = true;
    setMood("listen");
    window.clearTimeout(converseTimer);
    converseTimer = window.setTimeout(() => {
      conversing = false;
      if (!busy && !speaking) {
        setMood("idle");
        setStatus(engineOk ? "听呼唤中…" : "呼唤引擎未就绪");
      }
    }, 16_000);
  }

  function speak(text) {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text || "").slice(0, 400));
      u.lang = "zh-CN";
      u.rate = 1.05;
      speaking = true;
      setMood("talk");
      u.onend = () => {
        speaking = false;
        setMood(conversing ? "listen" : "idle");
      };
      u.onerror = () => {
        speaking = false;
      };
      window.speechSynthesis.speak(u);
    } catch {
      speaking = false;
    }
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
      setStatus(conversing ? "继续说…" : "听呼唤中…");
    } catch (e) {
      const tip = e instanceof Error ? e.message : String(e);
      showBubble(`对话失败：${tip}`);
      setStatus("对话失败");
    } finally {
      busy = false;
      setMood(conversing ? "listen" : "idle");
    }
  }

  function onWake(word) {
    armConverseWindow();
    setStatus(`听到呼唤：${word || "名字"}`);
    showBubble(`嗯，${word || "我"}在听。`, 2200);
    speak("我在");
  }

  function onDictate(text) {
    const raw = String(text || "").trim();
    if (!raw || busy || speaking) return;
    armConverseWindow();
    setStatus(`听到：${raw.slice(0, 28)}`);
    showBubble(`你说：${raw.slice(0, 40)}${raw.length > 40 ? "…" : ""}`, 2500);
    void askGateway(raw);
  }

  btnMic?.addEventListener("click", (e) => {
    e.stopPropagation();
    armConverseWindow();
    setStatus("请直接说…");
    showBubble("说吧。", 1800);
    if (window.nexusPet?.listenAgain) void window.nexusPet.listenAgain();
  });

  btnQuit?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (window.nexusPet?.quit) void window.nexusPet.quit();
    else window.close();
  });

  pet?.addEventListener("click", () => {
    armConverseWindow();
    setStatus("请直接说…");
    showBubble("点到我啦，说吧。", 2000);
    speak("我在");
    if (window.nexusPet?.listenAgain) void window.nexusPet.listenAgain();
  });

  if (window.nexusPet?.onRuntime) {
    window.nexusPet.onRuntime((data) => {
      if (!data || typeof data !== "object") return;
      runtime = {
        gatewayUrl: String(data.gatewayUrl || runtime.gatewayUrl).replace(/\/$/, ""),
        token: String(data.token || ""),
        wakeWords:
          Array.isArray(data.wakeWords) && data.wakeWords.length
            ? data.wakeWords.map(String)
            : runtime.wakeWords,
        chatId: String(data.chatId || "desktop-pet"),
        userId: String(data.userId || "desktop-pet"),
      };
      if (window.nexusPet.setWakeWords) {
        void window.nexusPet.setWakeWords(runtime.wakeWords);
      }
      setStatus("已连接 · 等待本机呼唤引擎");
    });
  }

  if (window.nexusPet?.onWake) {
    window.nexusPet.onWake((data) => onWake(data?.word || ""));
  }
  if (window.nexusPet?.onDictate) {
    window.nexusPet.onDictate((data) => onDictate(data?.text || ""));
  }
  if (window.nexusPet?.onWakeStatus) {
    window.nexusPet.onWakeStatus((data) => {
      engineOk = Boolean(data?.ok);
      const msg = String(data?.message || "");
      if (msg) setStatus(msg);
      if (data?.ok === false && msg) showBubble(msg, 5000);
    });
  }

  if (btnMic) btnMic.textContent = "说话";
  setStatus("启动本机呼唤…");
})();
