import { readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { NexusEvent, PluginContext } from "@fengyun/nexus-plugin-sdk";

function groupIdOf(e: NexusEvent): number | null {
  const meta = e.raw.meta || {};
  const gid = Number(meta.groupId ?? String(e.chatId).replace(/^group:/, ""));
  return Number.isFinite(gid) && gid > 0 ? gid : null;
}

function userIdOf(e: NexusEvent): number | null {
  const uid = Number(e.userId);
  return Number.isFinite(uid) && uid > 0 ? uid : null;
}

function messageType(e: NexusEvent): "group" | "private" {
  const mt = String(e.raw.meta?.messageType || "");
  if (mt === "group") return "group";
  if (String(e.chatId).startsWith("group:")) return "group";
  return "private";
}

function botIdOf(e: NexusEvent, ctx: PluginContext): string | undefined {
  const fromMeta = String(e.raw.meta?.botId || e.raw.meta?.selfId || "");
  if (fromMeta) return fromMeta;
  return ctx.ob11?.selfId?.() || undefined;
}

/** 发本地视频：优先 video 段；失败则群文件 */
export async function sendLocalVideo(
  e: NexusEvent,
  ctx: PluginContext,
  filePath: string,
  caption?: string,
): Promise<{ ok: boolean; message: string }> {
  if (caption) await e.reply(caption);

  if (!ctx.ob11?.call) {
    await e.reply(`已解析到视频，但当前通道不支持直发。文件：${filePath}`);
    return { ok: false, message: "无 OneBot" };
  }

  const botId = botIdOf(e, ctx);
  const mt = messageType(e);
  let fileRef = filePath;
  try {
    const size = statSync(filePath).size;
    // 约 1.2MB 内用 base64，大文件走路径/HTTP 由协议端处理
    if (size > 0 && size <= 1_200_000) {
      const b64 = readFileSync(filePath).toString("base64");
      fileRef = `base64://${b64}`;
    }
  } catch {
    /* keep path */
  }

  const videoSeg = [{ type: "video", data: { file: fileRef } }];
  const params: Record<string, unknown> =
    mt === "group"
      ? { message_type: "group", group_id: groupIdOf(e), message: videoSeg }
      : { message_type: "private", user_id: userIdOf(e), message: videoSeg };

  const r = await ctx.ob11.call("send_msg", params, { botId });
  if (r.ok) return { ok: true, message: "已发视频" };

  if (mt === "group") {
    const gid = groupIdOf(e);
    if (gid) {
      const up = await ctx.ob11.call(
        "upload_group_file",
        {
          group_id: gid,
          file: filePath,
          name: filePath.split(/[/\\]/).pop() || "video.mp4",
        },
        { botId },
      );
      if (up.ok) {
        await e.reply("视频较大，已改发群文件");
        return { ok: true, message: "已发群文件" };
      }
    }
  }

  await e.reply(`视频发送失败：${r.message || "未知错误"}`);
  return { ok: false, message: r.message || "发送失败" };
}

export async function sendImages(
  e: NexusEvent,
  urls: string[],
  caption?: string,
): Promise<void> {
  if (caption) await e.reply(caption);
  const max = Math.min(urls.length, 12);
  for (let i = 0; i < max; i++) {
    await e.replyImage(urls[i]);
  }
  if (urls.length > max) {
    await e.reply(`还有 ${urls.length - max} 张图未发完（已截断）`);
  }
}

export function fileUrl(path: string): string {
  return pathToFileURL(path).href;
}
