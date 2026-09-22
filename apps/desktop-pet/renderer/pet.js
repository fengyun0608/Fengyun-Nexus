/**
 * 桌宠渲染：系统麦克风采集 + 本机听写（网关 Windows System.Speech）。
 * 不依赖网页在线 SpeechRecognition。
 */
(() => {
  /** @type {{ gatewayUrl: string; token: string; wakeWords: string[]; chatId: string; userId: string }} */
  let runtime = {
    gatewayUrl: "http://127.0.0.1:8787",
    token: "",
    wakeWords: ["喵璃", "小璃", "小璃璃", "Nexus", "风云", "风云枢纽"],
    chatId: "desktop-pet",
    userId: "desktop-pet",
  };

  const pet = document.getElementById("pet");
  const bubble = document.getElementById("bubble");
  const statusEl = document.getElementById("status");
  const btnMic = document.getElementById("btnMic");
  const btnQuit = document.getElementById("btnQuit");

  let listening = false;
  let conversing = false;
  let busy = false;
  let speaking = false;
  let converseTimer = 0;
  let bubbleTimer = 0;
  let lastWakeAt = 0;
  let loopTimer = 0;
  /** @type {MediaStream | null} */
  let micStream = null;

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

  function normalizeHeard(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^\u4e00-\u9fff a-z0-9]/gi, "")
      .replace(/\s+/g, "");
  }

  function wakeAliases(word) {
    const w = String(word || "").trim();
    if (!w) return [];
    const map = {
      喵璃: ["喵璃", "喵哩", "喵里", "苗璃", "秒璃", "妙璃", "喵梨"],
      小璃: ["小璃", "小哩", "小里", "小梨", "小丽"],
      风云: ["风云", "疯云", "丰云"],
      nexus: ["nexus", "neksus", "耐克瑟斯"],
    };
    const key = w.toLowerCase();
    const extras = map[w] || map[key] || [];
    return [...new Set([w, ...extras])];
  }

  function hitWake(text) {
    const raw = normalizeHeard(text);
    if (!raw) return false;
    for (const w of runtime.wakeWords || []) {
      for (const a of wakeAliases(w)) {
        const n = normalizeHeard(a);
        if (n && raw.includes(n)) return true;
      }
    }
    if (/喵[璃哩里梨丽]|小[璃哩里梨丽]/.test(raw)) return true;
    return false;
  }

  function stripWake(text) {
    let t = String(text || "").trim();
    for (const w of runtime.wakeWords || []) {
      for (const a of wakeAliases(w)) {
        if (!a) continue;
        const re = new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
        t = t.replace(re, " ");
      }
    }
    return t.replace(/\s+/g, " ").trim();
  }

  function armConverseWindow() {
    conversing = true;
    window.clearTimeout(converseTimer);
    converseTimer = window.setTimeout(() => {
      conversing = false;
      if (listening) setStatus("听呼唤中…");
    }, 28_000);
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
        if (listening) setMood("listen");
        else setMood("idle");
      };
      u.onerror = () => {
        speaking = false;
      };
      window.speechSynthesis.speak(u);
    } catch {
      speaking = false;
      setMood(listening ? "listen" : "idle");
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
    if (speaking || busy) return;
    const raw = String(text || "").trim();
    if (!raw) return;
    setStatus(`听到：${raw.slice(0, 28)}`);
    if (!conversing) {
      if (!hitWake(raw)) return;
      const now = Date.now();
      if (now - lastWakeAt < 1800) return;
      lastWakeAt = now;
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

  async function ensureMic() {
    if (micStream) return micStream;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("打不开系统麦克风");
    }
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    return micStream;
  }

  function encodeWav(float32, sampleRate) {
    const len = float32.length;
    const buffer = new ArrayBuffer(44 + len * 2);
    const view = new DataView(buffer);
    const writeStr = (off, s) => {
      for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + len * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, len * 2, true);
    let off = 44;
    for (let i = 0; i < len; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
    return new Blob([buffer], { type: "audio/wav" });
  }

  function downsample(float32, fromRate, toRate) {
    if (toRate >= fromRate) return { data: float32, rate: fromRate };
    const ratio = fromRate / toRate;
    const newLen = Math.floor(float32.length / ratio);
    const out = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      out[i] = float32[Math.floor(i * ratio)] || 0;
    }
    return { data: out, rate: toRate };
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const buf = reader.result;
        if (!(buf instanceof ArrayBuffer)) {
          reject(new Error("读录音失败"));
          return;
        }
        const bytes = new Uint8Array(buf);
        let bin = "";
        const step = 0x8000;
        for (let i = 0; i < bytes.length; i += step) {
          bin += String.fromCharCode(...bytes.subarray(i, i + step));
        }
        resolve(btoa(bin));
      };
      reader.onerror = () => reject(reader.error || new Error("读录音失败"));
      reader.readAsArrayBuffer(blob);
    });
  }

  async function recordOnce(ms) {
    const stream = await ensureMic();
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    /** @type {Float32Array[]} */
    const chunks = [];
    proc.onaudioprocess = (e) => {
      chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    src.connect(proc);
    proc.connect(mute);
    mute.connect(ctx.destination);
    await new Promise((r) => window.setTimeout(r, ms));
    proc.disconnect();
    src.disconnect();
    mute.disconnect();
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Float32Array(total);
    let o = 0;
    for (const c of chunks) {
      merged.set(c, o);
      o += c.length;
    }
    const fromRate = ctx.sampleRate || 48000;
    await ctx.close().catch(() => undefined);
    const { data, rate } = downsample(merged, fromRate, 16000);
    return encodeWav(data, rate);
  }

  async function sttChunk(blob) {
    if (!runtime.token) return "";
    const b64 = await blobToBase64(blob);
    const res = await fetch(`${runtime.gatewayUrl}/v1/admin/desktop-pet/stt`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${runtime.token}`,
      },
      body: JSON.stringify({ audioBase64: b64, mime: "audio/wav" }),
    });
    if (!res.ok) {
      const tip = await res.text().catch(() => "");
      throw new Error(tip || `听写 HTTP ${res.status}`);
    }
    const data = await res.json().catch(() => ({}));
    return String(data.text || "").trim();
  }

  function stopListenLoop() {
    window.clearTimeout(loopTimer);
    loopTimer = 0;
  }

  async function startListenLoop() {
    if (loopTimer) return;
    setStatus("本机听写中…呼唤名字");
    const tick = async () => {
      if (!listening) return;
      if (speaking || busy) {
        loopTimer = window.setTimeout(tick, 500);
        return;
      }
      try {
        const blob = await recordOnce(2000);
        if (!listening) return;
        const text = await sttChunk(blob);
        if (text) handleHeard(text);
        else if (listening && !conversing) setStatus("听呼唤中…");
      } catch (e) {
        setStatus(e instanceof Error ? e.message.slice(0, 40) : "听写失败");
      }
      if (listening) loopTimer = window.setTimeout(tick, 200);
    };
    loopTimer = window.setTimeout(tick, 100);
  }

  async function startListen() {
    listening = true;
    btnMic.textContent = "关麦";
    setMood("listen");
    setStatus("打开系统麦克风…");
    try {
      await ensureMic();
    } catch (e) {
      listening = false;
      btnMic.textContent = "开麦";
      setMood("idle");
      const tip = e instanceof Error ? e.message : String(e);
      setStatus(tip);
      showBubble(`麦克风打不开：${tip}`);
      return;
    }
    void startListenLoop();
  }

  function stopListen() {
    listening = false;
    conversing = false;
    btnMic.textContent = "开麦";
    setMood("idle");
    setStatus("待命 · 呼唤名字或点我");
    stopListenLoop();
    if (micStream) {
      for (const t of micStream.getTracks()) t.stop();
      micStream = null;
    }
  }

  btnMic?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (listening) stopListen();
    else void startListen();
  });

  btnQuit?.addEventListener("click", (e) => {
    e.stopPropagation();
    stopListen();
    if (window.nexusPet?.quit) void window.nexusPet.quit();
    else window.close();
  });

  pet?.addEventListener("click", () => {
    if (!listening) void startListen();
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
        wakeWords:
          Array.isArray(data.wakeWords) && data.wakeWords.length
            ? data.wakeWords.map(String)
            : runtime.wakeWords,
        chatId: String(data.chatId || "desktop-pet"),
        userId: String(data.userId || "desktop-pet"),
      };
      setStatus("已连接 · 用系统麦克风听呼唤");
      void startListen();
    });
  } else {
    setStatus("未注入运行时");
  }
})();
