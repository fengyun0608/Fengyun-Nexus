#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fengyun Nexus 桌面 UIA 工人：列窗口、扫控件树、点击、填字、模拟按键、听歌搜播。

依赖：pip install pywinauto
仅 Windows。输出一律 JSON 到 stdout（UTF-8）。
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time

if sys.platform == "win32":
    import ctypes

    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass


def out(obj: dict) -> None:
    raw = json.dumps(obj, ensure_ascii=False)
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass
    sys.stdout.buffer.write((raw + "\n").encode("utf-8", errors="replace"))
    sys.stdout.buffer.flush()


def fail(msg: str, **extra) -> int:
    out({"ok": False, "message": msg, **extra})
    return 1


def ensure_win() -> int | None:
    if sys.platform != "win32":
        return fail("桌面 UIA 仅支持 Windows")
    return None


def load_uia():
    try:
        from pywinauto import Desktop  # type: ignore
        from pywinauto.keyboard import send_keys  # type: ignore
    except Exception as e:
        raise RuntimeError(
            "未安装 pywinauto。请执行：python -m pip install pywinauto"
        ) from e
    return Desktop, send_keys


def set_clipboard(text: str) -> None:
    import ctypes

    CF_UNICODETEXT = 13
    GMEM_MOVEABLE = 0x0002
    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    if not user32.OpenClipboard(None):
        raise RuntimeError("剪贴板打不开")
    try:
        user32.EmptyClipboard()
        data = text.encode("utf-16-le") + b"\x00\x00"
        h = kernel32.GlobalAlloc(GMEM_MOVEABLE, len(data))
        if not h:
            raise RuntimeError("剪贴板分配失败")
        p = kernel32.GlobalLock(h)
        ctypes.memmove(p, data, len(data))
        kernel32.GlobalUnlock(h)
        if not user32.SetClipboardData(CF_UNICODETEXT, h):
            raise RuntimeError("写入剪贴板失败")
    finally:
        user32.CloseClipboard()


def find_window(Desktop, title: str, handle: int = 0):
    desk = Desktop(backend="uia")
    if handle:
        for w in desk.windows():
            try:
                if int(getattr(w.element_info, "handle", 0) or 0) == handle:
                    return w
            except Exception:
                continue
        raise RuntimeError(f"找不到句柄 {handle}")
    title = (title or "").strip()
    if not title:
        raise RuntimeError("需要 title 或 handle")
    for w in desk.windows():
        try:
            t = (w.window_text() or "").strip()
            if t == title:
                return w
        except Exception:
            continue
    for w in desk.windows():
        try:
            t = (w.window_text() or "").strip()
            if title.lower() in t.lower():
                return w
        except Exception:
            continue
    raise RuntimeError(f"找不到窗口：{title}")


def _decode_out(raw: bytes) -> str:
    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
        return raw.decode("utf-16", errors="replace")
    return raw.decode("utf-8", errors="replace")


def ocr_png(path: str) -> list[dict]:
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "win_ocr.ps1")
    if not os.path.isfile(script):
        raise RuntimeError("缺少文字识别脚本")
    proc = subprocess.run(
        [
            "powershell.exe",
            "-NoProfile",
            "-STA",
            "-NonInteractive",
            "-File",
            script,
            "-ImagePath",
            path,
        ],
        capture_output=True,
        timeout=22,
    )
    text = _decode_out(proc.stdout).strip()
    err = _decode_out(proc.stderr).strip()
    start = text.find("[")
    if start < 0:
        start = text.find("{")
    blob = text[start:] if start >= 0 else ""
    if proc.returncode != 0 or not blob:
        raise RuntimeError((err or text or "文字识别失败")[-240:])
    data = json.loads(blob)
    if isinstance(data, dict):
        return [data]
    return list(data or [])


def window_texts(win) -> list[dict]:
    img = win.capture_as_image()
    fd, path = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    try:
        img.save(path)
        words = ocr_png(path)
    finally:
        try:
            os.remove(path)
        except Exception:
            pass
    rect = win.rectangle()
    left, top = int(rect.left), int(rect.top)
    ww = max(1, int(rect.width()))
    wh = max(1, int(rect.height()))
    iw, ih = img.size
    sx = ww / max(1, iw)
    sy = wh / max(1, ih)
    out_words: list[dict] = []
    for w in words:
        text = str(w.get("text") or "").strip()
        if not text:
            continue
        x = int(float(w.get("x") or 0) * sx)
        y = int(float(w.get("y") or 0) * sy)
        rw = max(1, int(float(w.get("w") or 1) * sx))
        rh = max(1, int(float(w.get("h") or 1) * sy))
        out_words.append(
            {
                "text": text[:40],
                "x": left + x,
                "y": top + y,
                "w": rw,
                "h": rh,
                "rel_x": x,
                "rel_y": y,
            }
        )
    return out_words


def text_lines(words: list[dict]) -> list[dict]:
    lines: list[dict] = []
    for w in sorted(words, key=lambda t: (t["rel_y"], t["rel_x"])):
        cy = w["rel_y"] + w["h"] / 2
        placed = False
        for line in lines:
            if abs(cy - line["cy"]) <= max(10, w["h"] * 0.65):
                line["words"].append(w)
                line["cy"] = (line["cy"] + cy) / 2
                placed = True
                break
        if not placed:
            lines.append({"cy": cy, "words": [w]})
    packed = []
    for line in lines:
        ws = sorted(line["words"], key=lambda t: t["rel_x"])
        text = "".join(t["text"] for t in ws)
        rel_x = min(t["rel_x"] for t in ws)
        rel_y = min(t["rel_y"] for t in ws)
        right = max(t["rel_x"] + t["w"] for t in ws)
        bottom = max(t["rel_y"] + t["h"] for t in ws)
        packed.append(
            {
                "text": text[:80],
                "x": min(t["x"] for t in ws),
                "y": min(t["y"] for t in ws),
                "w": right - rel_x,
                "h": bottom - rel_y,
                "rel_x": rel_x,
                "rel_y": rel_y,
            }
        )
    return packed


def pick_text(words: list[dict], query: str) -> dict | None:
    q = (query or "").strip()
    if not q:
        return None
    for w in words:
        if w["text"] == q:
            return w
    for line in text_lines(words):
        blob = line["text"]
        if q not in blob:
            continue
        # 用整行点中间偏左，搜索条通常整行都可点
        return line
    for w in words:
        if q in w["text"]:
            return w
    return None


def click_box(win, box: dict) -> None:
    x = int(box["rel_x"] + max(4, box["w"] * 0.35))
    y = int(box["rel_y"] + box["h"] / 2)
    win.click_input(coords=(x, y))


def shallow_controls(win, limit: int = 40) -> list[dict]:
    acc: list = []
    walk(win, 0, 2, acc, limit)
    return [c for c in acc if (c.get("name") or c.get("automation_id") or c.get("control_type"))][:limit]


def cmd_see(args: argparse.Namespace) -> int:
    err = ensure_win()
    if err is not None:
        return err
    Desktop, _send_keys = load_uia()
    try:
        win = find_window(Desktop, args.title or "", int(args.handle or 0))
    except Exception as e:
        return fail(str(e))
    try:
        try:
            win.set_focus()
            time.sleep(0.25)
        except Exception:
            pass
        texts = window_texts(win)
        lines = text_lines(texts)
        controls = []
        try:
            controls = shallow_controls(win, int(args.limit or 40))
        except Exception:
            controls = []
        out(
            {
                "ok": True,
                "title": (win.window_text() or "").strip(),
                "texts": lines[:60] or texts[:60],
                "words": texts[:80],
                "controls": controls[:40],
                "uia_empty": not any(c.get("name") for c in controls),
                "message": f"认出 {len(lines) or len(texts)} 处文字，控件 {len(controls)} 个",
            }
        )
        return 0
    except Exception as e:
        return fail(str(e))


def cmd_click_text(args: argparse.Namespace) -> int:
    err = ensure_win()
    if err is not None:
        return err
    query = (args.text or "").strip()
    if not query:
        return fail("缺少要点的文字")
    Desktop, _send_keys = load_uia()
    try:
        win = find_window(Desktop, args.title or "", int(args.handle or 0))
    except Exception as e:
        return fail(str(e))
    try:
        win.set_focus()
        time.sleep(0.25)
        texts = window_texts(win)
        hit = pick_text(texts, query)
        if not hit:
            return fail(f"窗口里没找到「{query}」", texts=(text_lines(texts) or texts)[:30])
        click_box(win, hit)
        out({"ok": True, "message": f"已点「{hit['text']}」", "hit": hit})
        return 0
    except Exception as e:
        return fail(str(e))


def cmd_music_search(args: argparse.Namespace) -> int:
    """Electron 音乐客户端（汽水等）几乎没有控件树，靠焦点 + 点搜索区 + 打字。"""
    err = ensure_win()
    if err is not None:
        return err
    Desktop, send_keys = load_uia()
    title = (args.title or "汽水音乐").strip()
    query = (args.query or "").strip()
    if not query:
        return fail("缺少歌名 query")
    try:
        win = find_window(Desktop, title, int(args.handle or 0))
    except Exception as e:
        return fail(str(e), need_launch=True, app=title)

    try:
        win.set_focus()
        time.sleep(0.35)
        texts: list[dict] = []
        method = "guess"
        try:
            texts = window_texts(win)
        except Exception:
            texts = []
        hit = None
        for key in ("搜索", "搜歌曲", "搜索歌曲", "搜索音乐", "Search"):
            hit = pick_text(texts, key)
            if hit:
                break
        if hit:
            click_box(win, hit)
            method = "ocr"
        else:
            rect = win.rectangle()
            cx = int((rect.right - rect.left) * 0.42)
            cy = int(max(48, (rect.bottom - rect.top) * 0.08))
            try:
                win.click_input(coords=(cx, cy))
            except Exception:
                send_keys("^f")
                time.sleep(0.2)
                send_keys("^k")
        time.sleep(0.25)
        send_keys("^a{BACKSPACE}")
        time.sleep(0.1)
        pasted = False
        try:
            set_clipboard(query)
            send_keys("^v")
            pasted = True
        except Exception:
            pasted = False
        if not pasted:
            send_keys(query, with_spaces=True)
        time.sleep(0.45)
        send_keys("{ENTER}")
        time.sleep(0.9)
        send_keys("{DOWN}")
        time.sleep(0.15)
        send_keys("{ENTER}")
        out(
            {
                "ok": True,
                "message": f"主人，{title}已经打开，正在放《{query}》。",
                "app": title,
                "query": query,
                "method": ("ocr+" if method == "ocr" else "guess+") + ("clipboard" if pasted else "keys"),
                "texts": (text_lines(texts) or texts)[:24],
            }
        )
        return 0
    except Exception as e:
        return fail(str(e), app=title, query=query)

def cmd_windows(_args: argparse.Namespace) -> int:
    err = ensure_win()
    if err is not None:
        return err
    Desktop, _ = load_uia()
    items = []
    for w in Desktop(backend="uia").windows():
        try:
            title = (w.window_text() or "").strip()
            if not title:
                continue
            rect = w.rectangle()
            items.append(
                {
                    "title": title[:160],
                    "class": getattr(w.element_info, "class_name", "") or "",
                    "handle": int(getattr(w.element_info, "handle", 0) or 0),
                    "rect": {
                        "left": int(rect.left),
                        "top": int(rect.top),
                        "right": int(rect.right),
                        "bottom": int(rect.bottom),
                    },
                }
            )
        except Exception:
            continue
    out({"ok": True, "count": len(items), "windows": items[:80]})
    return 0


def walk(ctrl, depth: int, max_depth: int, acc: list, limit: int) -> None:
    if len(acc) >= limit or depth > max_depth:
        return
    try:
        info = ctrl.element_info
        name = (getattr(info, "name", None) or ctrl.window_text() or "").strip()
        ctype = str(getattr(info, "control_type", "") or "")
        auto_id = str(getattr(info, "automation_id", "") or "")
        cls = str(getattr(info, "class_name", "") or "")
        rect = ctrl.rectangle()
        acc.append(
            {
                "depth": depth,
                "name": name[:120],
                "control_type": ctype,
                "automation_id": auto_id[:80],
                "class": cls[:80],
                "rect": {
                    "left": int(rect.left),
                    "top": int(rect.top),
                    "right": int(rect.right),
                    "bottom": int(rect.bottom),
                },
            }
        )
    except Exception:
        return
    try:
        children = ctrl.children()
    except Exception:
        return
    for ch in children:
        if len(acc) >= limit:
            break
        walk(ch, depth + 1, max_depth, acc, limit)


def resolve_target(win, name: str, auto_id: str, control_type: str):
    kwargs = {}
    if name:
        kwargs["title"] = name
    if auto_id:
        kwargs["auto_id"] = auto_id
    if control_type:
        kwargs["control_type"] = control_type
    if not kwargs:
        raise RuntimeError("需要 name / auto_id / control_type 之一")
    # 先精确，再 title_re 包含
    try:
        return win.child_window(**kwargs)
    except Exception:
        pass
    if name and "title" in kwargs:
        kwargs.pop("title", None)
        kwargs["title_re"] = f".*{name}.*"
        return win.child_window(**kwargs)
    raise RuntimeError("找不到控件")


def cmd_tree(args: argparse.Namespace) -> int:
    err = ensure_win()
    if err is not None:
        return err
    Desktop, _ = load_uia()
    try:
        win = find_window(Desktop, args.title or "", int(args.handle or 0))
        win.set_focus()
        nodes: list = []
        walk(win, 0, int(args.depth or 3), nodes, int(args.limit or 120))
        out(
            {
                "ok": True,
                "window": (win.window_text() or "")[:160],
                "count": len(nodes),
                "controls": nodes,
            }
        )
        return 0
    except Exception as e:
        return fail(str(e))


def cmd_focus(args: argparse.Namespace) -> int:
    err = ensure_win()
    if err is not None:
        return err
    Desktop, _ = load_uia()
    try:
        win = find_window(Desktop, args.title or "", int(args.handle or 0))
        win.set_focus()
        out({"ok": True, "window": (win.window_text() or "")[:160]})
        return 0
    except Exception as e:
        return fail(str(e))


def cmd_click(args: argparse.Namespace) -> int:
    err = ensure_win()
    if err is not None:
        return err
    Desktop, _ = load_uia()
    try:
        win = find_window(Desktop, args.title or "", int(args.handle or 0))
        win.set_focus()
        tgt = resolve_target(
            win, args.name or "", args.auto_id or "", args.control_type or ""
        )
        tgt.wait("exists enabled visible", timeout=8)
        tgt.click_input()
        out({"ok": True, "message": "已点击", "name": args.name or args.auto_id})
        return 0
    except Exception as e:
        return fail(str(e))


def cmd_set_text(args: argparse.Namespace) -> int:
    err = ensure_win()
    if err is not None:
        return err
    Desktop, _ = load_uia()
    try:
        win = find_window(Desktop, args.title or "", int(args.handle or 0))
        win.set_focus()
        tgt = resolve_target(
            win,
            args.name or "",
            args.auto_id or "",
            args.control_type or "Edit",
        )
        tgt.wait("exists enabled visible", timeout=8)
        try:
            tgt.set_edit_text(args.text or "")
        except Exception:
            tgt.type_keys("^a{BACKSPACE}" + (args.text or ""), with_spaces=True)
        out({"ok": True, "message": "已填字"})
        return 0
    except Exception as e:
        return fail(str(e))


def cmd_keys(args: argparse.Namespace) -> int:
    err = ensure_win()
    if err is not None:
        return err
    Desktop, send_keys = load_uia()
    try:
        win = find_window(Desktop, args.title or "", int(args.handle or 0))
        win.set_focus()
        keys = args.keys or ""
        if not keys:
            return fail("缺少 keys")
        if args.name or args.auto_id or args.control_type:
            tgt = resolve_target(
                win, args.name or "", args.auto_id or "", args.control_type or ""
            )
            tgt.set_focus()
            tgt.type_keys(keys, with_spaces=True)
        else:
            send_keys(keys, with_spaces=True)
        out({"ok": True, "message": "已模拟按键", "keys": keys})
        return 0
    except Exception as e:
        return fail(str(e))


def main() -> int:
    p = argparse.ArgumentParser(description="Fengyun Nexus UIA CLI")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("windows")

    t = sub.add_parser("tree")
    t.add_argument("--title", default="")
    t.add_argument("--handle", type=int, default=0)
    t.add_argument("--depth", type=int, default=3)
    t.add_argument("--limit", type=int, default=120)

    f = sub.add_parser("focus")
    f.add_argument("--title", default="")
    f.add_argument("--handle", type=int, default=0)

    c = sub.add_parser("click")
    c.add_argument("--title", default="")
    c.add_argument("--handle", type=int, default=0)
    c.add_argument("--name", default="")
    c.add_argument("--auto_id", default="")
    c.add_argument("--control_type", default="")

    s = sub.add_parser("set_text")
    s.add_argument("--title", default="")
    s.add_argument("--handle", type=int, default=0)
    s.add_argument("--name", default="")
    s.add_argument("--auto_id", default="")
    s.add_argument("--control_type", default="Edit")
    s.add_argument("--text", default="")

    k = sub.add_parser("keys")
    k.add_argument("--title", default="")
    k.add_argument("--handle", type=int, default=0)
    k.add_argument("--name", default="")
    k.add_argument("--auto_id", default="")
    k.add_argument("--control_type", default="")
    k.add_argument("--keys", default="")

    m = sub.add_parser("music_search")
    m.add_argument("--title", default="汽水音乐")
    m.add_argument("--handle", type=int, default=0)
    m.add_argument("--query", default="")

    see = sub.add_parser("see")
    see.add_argument("--title", default="")
    see.add_argument("--handle", type=int, default=0)
    see.add_argument("--limit", type=int, default=40)

    ct = sub.add_parser("click_text")
    ct.add_argument("--title", default="")
    ct.add_argument("--handle", type=int, default=0)
    ct.add_argument("--text", default="")

    args = p.parse_args()
    try:
        if args.cmd == "windows":
            return cmd_windows(args)
        if args.cmd == "tree":
            return cmd_tree(args)
        if args.cmd == "focus":
            return cmd_focus(args)
        if args.cmd == "click":
            return cmd_click(args)
        if args.cmd == "set_text":
            return cmd_set_text(args)
        if args.cmd == "keys":
            return cmd_keys(args)
        if args.cmd == "music_search":
            return cmd_music_search(args)
        if args.cmd == "see":
            return cmd_see(args)
        if args.cmd == "click_text":
            return cmd_click_text(args)
        return fail(f"未知命令：{args.cmd}")
    except RuntimeError as e:
        return fail(str(e))
    except Exception as e:
        return fail(str(e))


if __name__ == "__main__":
    raise SystemExit(main())
