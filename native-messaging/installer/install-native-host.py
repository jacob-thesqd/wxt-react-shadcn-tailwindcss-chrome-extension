#!/usr/bin/env python3
import json
import os
import shutil
import stat
import sys
from pathlib import Path
from typing import Optional

HOST_NAME = "com.mysquad.native"
APP_SUPPORT = Path.home() / "Library" / "Application Support"
HOST_INSTALL_DIR = APP_SUPPORT / "MySquad Native Messaging"
HOST_INSTALL_PATH = HOST_INSTALL_DIR / "mysquad-native-host.py"
CHROME_NATIVE_HOSTS_DIR = APP_SUPPORT / "Google" / "Chrome" / "NativeMessagingHosts"


def resolve_extension_name(manifest_path: Path) -> Optional[str]:
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return None

    name = data.get("name")
    if not isinstance(name, str):
        return None

    if name.startswith("__MSG_") and name.endswith("__"):
        key = name[6:-2]
        locale_path = manifest_path.parent / "_locales" / "en" / "messages.json"
        try:
            messages = json.loads(locale_path.read_text(encoding="utf-8"))
            message = messages.get(key, {}).get("message")
            if isinstance(message, str):
                return message
        except Exception:
            return None

    return name


def read_extension_id_file() -> Optional[str]:
    candidates = [
        Path.home() / "Downloads" / "mysquad-extension-id.txt",
        Path.home() / "Downloads" / "MySquad Extension ID.txt",
    ]

    for path in candidates:
        if not path.is_file():
            continue
        try:
            value = path.read_text(encoding="utf-8").strip()
            if value:
                return value
        except Exception:
            continue

    return None


def find_extension_id() -> Optional[str]:
    env_id = os.environ.get("MYSQUAD_EXTENSION_ID")
    if env_id:
        return env_id.strip()

    file_id = read_extension_id_file()
    if file_id:
        return file_id

    chrome_root = APP_SUPPORT / "Google" / "Chrome"
    if not chrome_root.exists():
        return None

    candidates = []
    for profile in chrome_root.iterdir():
        extensions_root = profile / "Extensions"
        if not extensions_root.is_dir():
            continue
        for extension_id_dir in extensions_root.iterdir():
            if not extension_id_dir.is_dir():
                continue
            for version_dir in extension_id_dir.iterdir():
                manifest_path = version_dir / "manifest.json"
                if not manifest_path.is_file():
                    continue
                name = resolve_extension_name(manifest_path)
                if not name:
                    continue
                if "mysquad" in name.lower():
                    candidates.append(extension_id_dir.name)
                    break

    if candidates:
        return sorted(set(candidates))[0]

    return None


def find_host_source() -> Optional[Path]:
    script_dir = Path(__file__).resolve().parent
    direct_path = script_dir / "mysquad-native-host.py"
    if direct_path.is_file():
        return direct_path

    fallback_path = script_dir.parent / "host" / "mysquad-native-host.py"
    if fallback_path.is_file():
        return fallback_path

    return None


def install_host(extension_id: str) -> None:
    host_source = find_host_source()
    if not host_source:
        raise FileNotFoundError("mysquad-native-host.py not found next to installer.")

    HOST_INSTALL_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(host_source, HOST_INSTALL_PATH)

    current_mode = HOST_INSTALL_PATH.stat().st_mode
    HOST_INSTALL_PATH.chmod(current_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

    CHROME_NATIVE_HOSTS_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "name": HOST_NAME,
        "description": "MySquad Finder helper",
        "path": str(HOST_INSTALL_PATH),
        "type": "stdio",
        "allowed_origins": [f"chrome-extension://{extension_id}/"],
    }

    manifest_path = CHROME_NATIVE_HOSTS_DIR / f"{HOST_NAME}.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main() -> int:
    extension_id = find_extension_id()
    if not extension_id:
        print("Could not find the MySquad Chrome extension. Install the extension first, or set MYSQUAD_EXTENSION_ID.")
        return 1

    try:
        install_host(extension_id)
    except Exception as error:
        print(f"Install failed: {error}")
        return 1

    print("MySquad Finder helper installed successfully.")
    print(f"Extension ID: {extension_id}")
    print(f"Host path: {HOST_INSTALL_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
