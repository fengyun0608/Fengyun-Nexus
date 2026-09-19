"""Minimal UIA / automation worker stub for Nexus.

完整操控请用同目录 uia_cli.py（需 pywinauto）。
"""


def status() -> dict:
    return {
        "ok": True,
        "worker": "python-tools",
        "uia": "ready",
        "cli": "uia_cli.py",
        "hint": "python uia_cli.py windows",
    }


if __name__ == "__main__":
    import json

    print(json.dumps(status(), ensure_ascii=False))
