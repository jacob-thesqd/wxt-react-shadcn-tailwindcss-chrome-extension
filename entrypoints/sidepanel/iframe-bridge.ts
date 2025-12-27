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

export function startIframeBridge(iframe: HTMLIFrameElement) {
    const handleMessage = async (event: MessageEvent<IframeReadyMessage>) => {
        if (!event.data || event.data.source !== "mysquad-iframe" || event.data.type !== "ready") {
            return;
        }

        const url = await getActiveTabUrl();
        if (url) {
            postCurrentUrl(iframe, url);
        }
    };

    window.addEventListener("message", handleMessage);

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
        browser.tabs.onActivated.removeListener(handleTabActivated);
        browser.tabs.onUpdated.removeListener(handleTabUpdated);
    };
}
