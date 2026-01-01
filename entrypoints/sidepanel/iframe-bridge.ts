import {browser} from "wxt/browser";

type IframeReadyMessage = {
    source: "mysquad-iframe";
    type: "ready";
};

type ExtensionUrlMessage = {
    source: "mysquad-extension";
    type: "current-url";
    url: string;
};

type ExtensionAuthMessage = {
    source: "mysquad-extension";
    type: "clickup-auth";
    code: string;
    state: string;
};

type IframeNativeRequestMessage = {
    source: "mysquad-iframe";
    type: "native-request";
    requestId: string;
    action: "open-dropbox-path" | "native-status" | "open-installer";
    dropboxPath?: string;
};

type ExtensionNativeResponseMessage = {
    source: "mysquad-extension";
    type: "native-response";
    requestId: string;
    ok: boolean;
    error?: string;
    payload?: Record<string, unknown>;
};

const NATIVE_HOST_NAME = "com.mysquad.native";

async function getActiveTabUrl(): Promise<string | undefined> {
    const tabs = await browser.tabs.query({active: true, currentWindow: true});
    return tabs[0]?.url;
}

function postCurrentUrl(iframe: HTMLIFrameElement, url: string) {
    iframe.contentWindow?.postMessage(
        {source: "mysquad-extension", type: "current-url", url} satisfies ExtensionUrlMessage,
        "*",
    );
}

function postAuthCallback(iframe: HTMLIFrameElement, code: string, state: string) {
    iframe.contentWindow?.postMessage(
        {source: "mysquad-extension", type: "clickup-auth", code, state} satisfies ExtensionAuthMessage,
        "*",
    );
}

function postNativeResponse(iframe: HTMLIFrameElement, response: ExtensionNativeResponseMessage) {
    iframe.contentWindow?.postMessage(response, "*");
}

const scheduleObjectUrlRevoke = (objectUrl: string) => {
    window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
    }, 30000);
};

const getExtensionId = () => {
    if (browser.runtime?.id) {
        return browser.runtime.id;
    }
    const url = browser.runtime?.getURL?.("") || "";
    const match = url.match(/^chrome-extension:\/\/([^/]+)\//);
    return match?.[1];
};

const downloadExtensionIdFile = async (extensionId: string) => {
    if (!browser.downloads?.download) {
        return null;
    }
    const dataUrl = `data:text/plain,${encodeURIComponent(extensionId)}`;
    return browser.downloads.download({
        url: dataUrl,
        filename: "mysquad-extension-id.txt",
        saveAs: false,
    });
};

const downloadInstaller = async (assetUrl: string) => {
    if (!browser.downloads?.download) {
        throw new Error("Downloads API unavailable.");
    }

    try {
        const response = await fetch(assetUrl, {cache: "no-store"});
        if (!response.ok) {
            throw new Error("Installer asset unavailable.");
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const downloadId = await browser.downloads.download({
            url: objectUrl,
            filename: "MySquad Native Messaging Installer.dmg",
            saveAs: false,
        });
        scheduleObjectUrlRevoke(objectUrl);
        return {downloadId, source: "blob"};
    } catch (error) {
        const downloadId = await browser.downloads.download({
            url: assetUrl,
            filename: "MySquad Native Messaging Installer.dmg",
            saveAs: false,
        });
        return {downloadId, source: "asset"};
    }
};

async function handleNativeRequest(iframe: HTMLIFrameElement, message: IframeNativeRequestMessage) {
    if (message.action === "open-installer") {
        if (!browser.downloads?.download) {
            postNativeResponse(iframe, {
                source: "mysquad-extension",
                type: "native-response",
                requestId: message.requestId,
                ok: false,
                error: "Downloads API unavailable.",
            });
            return;
        }

        const url = browser.runtime.getURL("native-messaging/MySquad Native Messaging Installer.dmg");
        try {
            const extensionId = getExtensionId();
            if (extensionId) {
                await downloadExtensionIdFile(extensionId);
            }
            const {downloadId, source} = await downloadInstaller(url);
            postNativeResponse(iframe, {
                source: "mysquad-extension",
                type: "native-response",
                requestId: message.requestId,
                ok: true,
                payload: {downloadId, source},
            });
            return;
        } catch (error) {
            if (browser.tabs?.create) {
                try {
                    await browser.tabs.create({url});
                    postNativeResponse(iframe, {
                        source: "mysquad-extension",
                        type: "native-response",
                        requestId: message.requestId,
                        ok: true,
                        payload: {fallback: "tab"},
                    });
                    return;
                } catch (tabError) {
                    postNativeResponse(iframe, {
                        source: "mysquad-extension",
                        type: "native-response",
                        requestId: message.requestId,
                        ok: false,
                        error: String(tabError),
                    });
                    return;
                }
            }

            postNativeResponse(iframe, {
                source: "mysquad-extension",
                type: "native-response",
                requestId: message.requestId,
                ok: false,
                error: String(error),
            });
            return;
        }
    }

    if (!browser.runtime?.sendNativeMessage) {
        postNativeResponse(iframe, {
            source: "mysquad-extension",
            type: "native-response",
            requestId: message.requestId,
            ok: false,
            error: "Native messaging API unavailable.",
        });
        return;
    }

    try {
        const payload =
            message.action === "native-status"
                ? {action: "detect_roots"}
                : {action: "open_path", dropbox_path: message.dropboxPath};
        const response = (await browser.runtime.sendNativeMessage(NATIVE_HOST_NAME, payload)) as Record<string, unknown>;

        postNativeResponse(iframe, {
            source: "mysquad-extension",
            type: "native-response",
            requestId: message.requestId,
            ok: true,
            payload: response,
        });
    } catch (error) {
        postNativeResponse(iframe, {
            source: "mysquad-extension",
            type: "native-response",
            requestId: message.requestId,
            ok: false,
            error: String(error),
        });
    }
}

export function startIframeBridge(iframe: HTMLIFrameElement, {onReady}: {onReady?: () => void} = {}) {
    const handleMessage = async (event: MessageEvent<IframeReadyMessage | IframeNativeRequestMessage>) => {
        if (!event.data || event.data.source !== "mysquad-iframe" || event.data.type !== "ready") {
            if (event.data && event.data.source === "mysquad-iframe" && event.data.type === "native-request") {
                await handleNativeRequest(iframe, event.data);
            }
            return;
        }

        onReady?.();

        const url = await getActiveTabUrl();
        if (url) {
            postCurrentUrl(iframe, url);
        }
    };

    window.addEventListener("message", handleMessage);

    const handleAuthStorage = async () => {
        const result = await browser.storage.local.get(["clickup_auth_code", "clickup_oauth_state"]);
        const code = result.clickup_auth_code;
        const state = result.clickup_oauth_state;

        if (code && state) {
            postAuthCallback(iframe, code, state);
            await browser.storage.local.remove(["clickup_auth_code", "clickup_oauth_state"]);
        }
    };

    handleAuthStorage();

    const handleStorageChange = () => {
        handleAuthStorage().catch((error) => {
            console.error("Error forwarding auth callback:", error);
        });
    };

    browser.storage.local.onChanged.addListener(handleStorageChange);

    const handleTabActivated = async () => {
        const url = await getActiveTabUrl();
        if (url) {
            postCurrentUrl(iframe, url);
        }
    };

    const handleTabUpdated = (tabId: number, changeInfo: {url?: string}, tab: {active?: boolean}) => {
        if (!tab?.active || !changeInfo.url) {
            return;
        }

        postCurrentUrl(iframe, changeInfo.url);
    };

    browser.tabs.onActivated.addListener(handleTabActivated);
    browser.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
        window.removeEventListener("message", handleMessage);
        browser.storage.local.onChanged.removeListener(handleStorageChange);
        browser.tabs.onActivated.removeListener(handleTabActivated);
        browser.tabs.onUpdated.removeListener(handleTabUpdated);
    };
}
