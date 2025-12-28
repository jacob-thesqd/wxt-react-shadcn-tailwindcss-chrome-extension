import { browser } from "wxt/browser";

export default defineBackground(() => {
  try {
    if (browser.webRequest?.onBeforeRequest?.addListener) {
      browser.webRequest.onBeforeRequest.addListener(
        (details) => {
          if (details.url.includes("churchmediasquad.com") && details.url.includes("code=")) {
            const url = new URL(details.url);
            const code = url.searchParams.get("code");
            const state = url.searchParams.get("state");

            if (code && state) {
              browser.storage.local
                .set({
                  clickup_auth_code: code,
                  clickup_oauth_state: state,
                })
                .then(() => browser.tabs.query({ url: details.url }))
                .then((tabs) => {
                  if (tabs.length > 0) {
                    return browser.tabs.remove(tabs[0].id!);
                  }
                })
                .catch((error) => {
                  console.error("Error in OAuth callback handling:", error);
                });
            }
          }
          return undefined;
        },
        { urls: ["*://churchmediasquad.com/*"] },
      );
    } else {
      console.warn("webRequest API unavailable; OAuth redirect capture disabled in this environment.");
    }
  } catch (error) {
    console.warn("webRequest API unavailable; OAuth redirect capture disabled in this environment.", error);
  }
});
