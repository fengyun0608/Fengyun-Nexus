#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fengyun Nexus 桌面 UIA 工人：列窗口、扫控件树、点击、填字、模拟按键、听歌搜播。

依赖：pip install pywinauto
仅 Windows。输出一律 JSON 到 stdout（UTF-8）。
"""
from __future__ import annotations

import argparse
import json
import sys
import time


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
        rect = win.rectangle()
        # 顶部搜索条大致位置
        cx = int(rect.left + (rect.right - rect.left) * 0.42)
        cy = int(rect.top + max(48, (rect.bottom - rect.top) * 0.08))
        try:
            win.click_input(coords=(cx - rect.left, cy - rect.top))
        except Exception:
            # 坐标失败就 Ctrl+F / Ctrl+K
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
                "method": "clipboard" if pasted else "keys",
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
        return fail(f"未知命令：{args.cmd}")
    except RuntimeError as e:
        return fail(str(e))
    except Exception as e:
        return fail(str(e))


if __name__ == "__main__":
    raise SystemExit(main())
