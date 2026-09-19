/**
 * Backend terminal REPL — type in the same window where gateway logs run.
 * Not the web console. Enabled only when stdin is a TTY.
 */
import * as readline from "node:readline";

export type TerminalReplHandler = (line: string) => Promise<string[]>;

export function startTerminalRepl(opts: {
  onLine: TerminalReplHandler;
  logTip?: (msg: string) => void;
}): readline.Interface | null {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    opts.logTip?.("当前无交互终端，跳过后端输入（日志仍正常输出）");
    return null;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "nexus> ",
    terminal: true,
  });

  let busy = false;

  const ask = () => {
    if (!busy) rl.prompt(true);
  };

  opts.logTip?.("后端终端已就绪。可发 #帮助，或自然语言（按管理控制台能力模式）");
  rl.prompt();

  rl.on("line", (raw) => {
    const line = raw.trim();
    if (!line) {
      ask();
      return;
    }
    if (busy) {
      console.log("上一条还在处理，请稍候");
      return;
    }
    busy = true;
    void (async () => {
      try {
        const replies = await opts.onLine(line);
        if (!replies.length) {
          console.log("(无回复)");
        } else {
          for (const r of replies) {
            for (const part of String(r).split(/\r?\n/)) {
              console.log(part);
            }
          }
        }
      } catch (e) {
        console.log(`错误：${e instanceof Error ? e.message : String(e)}`);
      } finally {
        busy = false;
        ask();
      }
    })();
  });

  rl.on("close", () => {
    /* process may exit elsewhere */
  });

  return rl;
}
