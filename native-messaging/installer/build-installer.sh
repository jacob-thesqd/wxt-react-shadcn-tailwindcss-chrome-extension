#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$ROOT_DIR/dist"
APP_NAME="MySquad Native Messaging Installer"
APP_PATH="$OUT_DIR/$APP_NAME.app"
DMG_PATH="$OUT_DIR/$APP_NAME.dmg"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

/usr/bin/osacompile -o "$APP_PATH" "$ROOT_DIR/installer.applescript"

cp "$ROOT_DIR/install-native-host.py" "$APP_PATH/Contents/Resources/install-native-host.py"
cp "$ROOT_DIR/../host/mysquad-native-host.py" "$APP_PATH/Contents/Resources/mysquad-native-host.py"

chmod +x "$APP_PATH/Contents/Resources/install-native-host.py" "$APP_PATH/Contents/Resources/mysquad-native-host.py"

if command -v /usr/bin/codesign >/dev/null 2>&1; then
    SIGNING_ID="${MYSQUAD_SIGNING_ID:-}"
    if [[ -n "$SIGNING_ID" ]]; then
        /usr/bin/codesign --force --deep --options runtime --sign "$SIGNING_ID" "$APP_PATH"
    else
        /usr/bin/codesign --force --deep --sign - "$APP_PATH"
    fi
fi

/usr/bin/hdiutil create -volname "$APP_NAME" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH"

if [[ "${MYSQUAD_NOTARIZE:-}" == "1" ]]; then
    APPLE_ID="${MYSQUAD_APPLE_ID:-}"
    TEAM_ID="${MYSQUAD_TEAM_ID:-}"
    APP_PASSWORD="${MYSQUAD_APP_PASSWORD:-}"

    if [[ -z "$APPLE_ID" || -z "$TEAM_ID" || -z "$APP_PASSWORD" ]]; then
        echo "Notarization skipped: set MYSQUAD_APPLE_ID, MYSQUAD_TEAM_ID, and MYSQUAD_APP_PASSWORD."
    else
        xcrun notarytool submit "$DMG_PATH" --apple-id "$APPLE_ID" --team-id "$TEAM_ID" --password "$APP_PASSWORD" --wait
        xcrun stapler staple "$DMG_PATH"
        echo "Notarized and stapled $DMG_PATH"
    fi
fi

echo "Built $DMG_PATH"
