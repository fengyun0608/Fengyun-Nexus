import { readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { NexusEvent, PluginContext } from "@fengyun/nexus-plugin-sdk";
import { downloadToFile } from "./download.js";

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

async function uploadGroupFile(
  e: NexusEvent,
  ctx: PluginContext,
  filePath: string,
  botId?: string,
): Promise<boolean> {
  const gid = groupIdOf(e);
  if (!gid || !ctx.ob11?.call) return false;
  const up = await ctx.ob11.call(
    "upload_group_file",
    {
      group_id: gid,
      file: filePath,
      name: filePath.split(/[/\\]/).pop() || "video.mp4",
    },
    { botId },
  );
  return Boolean(up.ok);
}

/** 发本地视频：超过阈值直接群文件；否则先 video 段，失败再群文件 */
export async function sendLocalVideo(
  e: NexusEvent,
  ctx: PluginContext,
  filePath: string,
  opts?: { groupFileOverMb?: number },
): Promise<{ ok: boolean; message: string }> {
  if (!ctx.ob11?.call) {
    await e.reply(`已解析到视频，但当前通道不支持直发。文件：${filePath}`);
    return { ok: false, message: "无 OneBot" };
  }

  const botId = botIdOf(e, ctx);
  const mt = messageType(e);
  const limitMb = Math.max(1, opts?.groupFileOverMb ?? 15);
  const limitBytes = limitMb * 1024 * 1024;
  let size = 0;
  try {
    size = statSync(filePath).size;
  } catch {
    await e.reply("视频文件不存在");
    return { ok: false, message: "文件不存在" };
  }

  if (mt === "group" && size > limitBytes) {
    const ok = await uploadGroupFile(e, ctx, filePath, botId);
    if (ok) {
      await e.reply(`视频约 ${(size / 1024 / 1024).toFixed(1)}MB，已改发群文件`);
      return { ok: true, message: "已发群文件" };
    }
    await e.reply("视频过大且群文件上传失败");
    return { ok: false, message: "群文件失败" };
  }

  let fileRef = filePath;
  if (size > 0 && size <= 1_200_000) {
    fileRef = `base64://${readFileSync(filePath).toString("base64")}`;
  }

  const videoSeg = [{ type: "video", data: { file: fileRef } }];
  const params: Record<string, unknown> =
    mt === "group"
      ? { message_type: "group", group_id: groupIdOf(e), message: videoSeg }
      : { message_type: "private", user_id: userIdOf(e), message: videoSeg };

  const r = await ctx.ob11.call("send_msg", params, { botId });
  if (r.ok) return { ok: true, message: "已发视频" };

  if (mt === "group") {
    const ok = await uploadGroupFile(e, ctx, filePath, botId);
    if (ok) {
      await e.reply("视频发送失败，已改发群文件");
      return { ok: true, message: "已发群文件" };
    }
  }

  await e.reply(`视频发送失败：${r.message || "未知错误"}`);
  return { ok: false, message: r.message || "发送失败" };
}

export async function sendImages(e: NexusEvent, urls: string[]): Promise<void> {
  const max = Math.min(urls.length, 12);
  for (let i = 0; i < max; i++) {
    await e.replyImage(urls[i]);
  }
  if (urls.length > max) {
    await e.reply(`还有 ${urls.length - max} 张图未发完（已截断）`);
  }
}

/** 背景音乐用语音条发送 */
export async function sendMusicAsRecord(
  e: NexusEvent,
  ctx: PluginContext,
  musicUrl: string,
): Promise<void> {
  if (!musicUrl || !ctx.ob11?.call) return;
  const dl = await downloadToFile(musicUrl, {
    fileName: `bgm-${Date.now()}.mp3`,
    headers: { Referer: "https://www.douyin.com/" },
    maxBytes: 8 * 1024 * 1024,
  });
  if (!dl.ok) {
    await e.reply(`背景音乐下载失败：${dl.message}`);
    return;
  }

  const botId = botIdOf(e, ctx);
  const mt = messageType(e);
  let fileRef = dl.path;
  try {
    const size = statSync(dl.path).size;
    if (size > 0 && size <= 1_200_000) {
      fileRef = `base64://${readFileSync(dl.path).toString("base64")}`;
    }
  } catch {
    /* keep path */
  }

  const seg = [{ type: "record", data: { file: fileRef } }];
  const params: Record<string, unknown> =
    mt === "group"
      ? { message_type: "group", group_id: groupIdOf(e), message: seg }
      : { message_type: "private", user_id: userIdOf(e), message: seg };

  const r = await ctx.ob11.call("send_msg", params, { botId });
  if (!r.ok) {
    // 兜底 CQ
    const cq = `[CQ:record,file=${dl.path}]`;
    const r2 = await ctx.ob11.call(
      "send_msg",
      mt === "group"
        ? { message_type: "group", group_id: groupIdOf(e), message: cq }
        : { message_type: "private", user_id: userIdOf(e), message: cq },
      { botId },
    );
    if (!r2.ok) await e.reply("背景音乐语音条发送失败");
  }
}

export function fileUrl(path: string): string {
  return pathToFileURL(path).href;
}
