# MySquad Native Messaging Helper

This helper enables the Chrome extension to open Dropbox folders in Finder via native messaging on macOS.

## One-click installer (DMG)

- Build the installer DMG: `native-messaging/installer/build-installer.sh`
- Output: `native-messaging/installer/dist/MySquad Native Messaging Installer.dmg`
- The DMG is copied into `public/native-messaging/` so the extension can download it.
- The build script ad-hoc signs the app by default. For distribution without Gatekeeper warnings, use a Developer ID Application cert and notarize the DMG.

### Notarization (recommended for users)

Set the following env vars before running the build:

```
MYSQUAD_SIGNING_ID="Developer ID Application: Your Company (TEAMID)"
MYSQUAD_NOTARIZE=1
MYSQUAD_APPLE_ID="you@company.com"
MYSQUAD_TEAM_ID="TEAMID"
MYSQUAD_APP_PASSWORD="app-specific-password"
```

The script will submit, wait, and staple the DMG so macOS won't show the "damaged" warning.

## What the installer does

- Copies the host to `~/Library/Application Support/MySquad Native Messaging/mysquad-native-host.py`
- Writes the Chrome native messaging manifest to `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.mysquad.native.json`

## Extension ID detection

The installer attempts to find the installed MySquad extension by scanning Chrome profiles. The extension also downloads a `mysquad-extension-id.txt` file into `~/Downloads` to help the installer pick the correct ID. If it still fails, set:

```
MYSQUAD_EXTENSION_ID=<your-extension-id>
```

Then rerun the installer app.

## Dropbox root detection

The native host auto-detects Dropbox roots by checking:

- `~/.dropbox/info.json`
- `~/Library/Application Support/Dropbox/info.json`
- `~/Library/CloudStorage/Dropbox*`
- `~/Dropbox`

The extension sends only the Dropbox path from the task RPC response; the host resolves it to a local path.
