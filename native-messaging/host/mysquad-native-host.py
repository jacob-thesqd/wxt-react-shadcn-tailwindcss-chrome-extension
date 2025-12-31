#!/usr/bin/env python3
import json
import os
import struct
import subprocess
import sys
from typing import Any, Dict, List, Optional

HOST_NAME = "com.mysquad.native"


def read_message() -> Optional[Dict[str, Any]]:
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) == 0:
        return None
    if len(raw_length) < 4:
        return None
    message_length = struct.unpack("<I", raw_length)[0]
    if message_length == 0:
        return None
    message_bytes = sys.stdin.buffer.read(message_length)
    if not message_bytes:
        return None
    try:
        return json.loads(message_bytes.decode("utf-8"))
    except json.JSONDecodeError:
        return {"action": "invalid", "error": "invalid_json"}


def write_message(message: Dict[str, Any]) -> None:
    encoded = json.dumps(message).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def read_dropbox_info_paths() -> List[str]:
    return [
        os.path.expanduser("~/.dropbox/info.json"),
        os.path.expanduser("~/Library/Application Support/Dropbox/info.json"),
    ]


def detect_dropbox_roots() -> List[str]:
    roots: List[str] = []

    for info_path in read_dropbox_info_paths():
        if not os.path.isfile(info_path):
            continue
        try:
            with open(info_path, "r", encoding="utf-8") as handle:
                info = json.load(handle)
            for key in ("personal", "business", "team"):
                value = info.get(key, {})
                if isinstance(value, dict):
                    path = value.get("path")
                    if path and os.path.isdir(path):
                        roots.append(path)
        except Exception:
            continue

    cloud_root = os.path.expanduser("~/Library/CloudStorage")
    if os.path.isdir(cloud_root):
        try:
            for entry in os.listdir(cloud_root):
                if not entry.startswith("Dropbox"):
                    continue
                candidate = os.path.join(cloud_root, entry)
                if os.path.isdir(candidate):
                    roots.append(candidate)
        except Exception:
            pass

    legacy_root = os.path.expanduser("~/Dropbox")
    if os.path.isdir(legacy_root):
        roots.append(legacy_root)

    deduped: List[str] = []
    for root in roots:
        if root not in deduped:
            deduped.append(root)
    return deduped


def resolve_dropbox_path(path_display: Optional[str], roots: List[str]) -> Dict[str, Optional[str]]:
    if not path_display:
        return {"resolved": None, "root": None, "found": None}

    if os.path.isabs(path_display) and os.path.exists(path_display):
        return {"resolved": path_display, "root": os.path.dirname(path_display), "found": True}

    relative_path = path_display.lstrip("/")
    for root in roots:
        candidate = os.path.join(root, relative_path)
        if os.path.exists(candidate):
            return {"resolved": candidate, "root": root, "found": True}

    return {"resolved": None, "root": roots[0] if roots else None, "found": False}


def open_in_finder(path: str) -> Optional[str]:
    try:
        subprocess.run(["/usr/bin/open", path], check=True)
        return None
    except subprocess.CalledProcessError as error:
        return str(error)


def handle_message(message: Dict[str, Any]) -> Dict[str, Any]:
    action = message.get("action")
    if action == "ping":
        return {"ok": True, "action": action}

    if action == "detect_roots":
        roots = detect_dropbox_roots()
        return {"ok": True, "action": action, "roots": roots, "default_root": roots[0] if roots else None}

    if action == "open_path":
        dropbox_path = message.get("dropbox_path")
        roots = detect_dropbox_roots()
        resolved = resolve_dropbox_path(dropbox_path, roots)

        if resolved["resolved"]:
            error = open_in_finder(resolved["resolved"])
            if error:
                return {
                    "ok": False,
                    "action": action,
                    "error": error,
                    "roots": roots,
                    "resolved_path": resolved["resolved"],
                    "root": resolved["root"],
                    "path_found": resolved["found"],
                }
            return {
                "ok": True,
                "action": action,
                "roots": roots,
                "resolved_path": resolved["resolved"],
                "root": resolved["root"],
                "path_found": resolved["found"],
            }

        if resolved["root"]:
            error = open_in_finder(resolved["root"])
            return {
                "ok": False,
                "action": action,
                "error": "Dropbox folder not found locally.",
                "roots": roots,
                "resolved_path": resolved["root"],
                "root": resolved["root"],
                "path_found": False,
                "open_error": error,
            }

        return {"ok": False, "action": action, "error": "No Dropbox roots detected.", "roots": roots}

    return {"ok": False, "action": action, "error": "Unsupported action."}


def main() -> None:
    while True:
        message = read_message()
        if message is None:
            break
        response = handle_message(message)
        write_message(response)


if __name__ == "__main__":
    main()
