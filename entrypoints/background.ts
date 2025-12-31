import { browser } from "wxt/browser";

interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  url?: string;
  requireInteraction?: boolean;
}

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

  self.addEventListener("push", (event: PushEvent) => {
    console.log("[Background] Push event received:", event);

    let payload: PushNotificationPayload = {
      title: "MySquad Notification",
      body: "You have a new notification",
    };

    if (event.data) {
      try {
        const data = event.data.json();
        console.log("[Background] Push payload:", data);

        payload = {
          title: data.title || payload.title,
          body: data.body || data.message || payload.body,
          icon: data.icon,
          badge: data.badge,
          tag: data.tag,
          data: data.data || { url: data.url },
          url: data.url || data.data?.url,
          requireInteraction: data.requireInteraction,
        };
      } catch (error) {
        console.error("[Background] Failed to parse push data:", error);
        try {
          payload.body = event.data.text();
        } catch (textError) {
          console.error("[Background] Failed to get push text:", textError);
        }
      }
    }

    const notificationId = `mysquad_push_${Date.now()}`;

    const storeAndShow = async () => {
      await browser.storage.local.set({
        [`notification_${notificationId}`]: {
          url: payload.url || payload.data?.url,
          actions: payload.data?.actions,
        },
      });

      await browser.notifications.create(notificationId, {
        type: "basic",
        iconUrl: payload.icon || browser.runtime.getURL("icon/icon-128.png"),
        title: payload.title,
        message: payload.body,
        priority: 2,
        requireInteraction: payload.requireInteraction ?? false,
      });

      console.log("[Background] Notification created:", notificationId);
    };

    event.waitUntil(storeAndShow());
  });

  browser.notifications.onClicked.addListener(async (notificationId) => {
    try {
      const result = await browser.storage.local.get(`notification_${notificationId}`);
      const notificationData = result[`notification_${notificationId}`];

      if (notificationData?.url) {
        await browser.tabs.create({ url: notificationData.url });
      }

      await browser.notifications.clear(notificationId);
      await browser.storage.local.remove(`notification_${notificationId}`);
    } catch (error) {
      console.error("[Background] Error handling notification click:", error);
    }
  });

  browser.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    try {
      const result = await browser.storage.local.get(`notification_${notificationId}`);
      const notificationData = result[`notification_${notificationId}`];

      if (notificationData?.actions && notificationData.actions[buttonIndex]) {
        const action = notificationData.actions[buttonIndex];

        if (action.action === "open" && notificationData.url) {
          await browser.tabs.create({ url: notificationData.url });
        }
      }

      await browser.notifications.clear(notificationId);
      await browser.storage.local.remove(`notification_${notificationId}`);
    } catch (error) {
      console.error("[Background] Error handling notification button click:", error);
    }
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SHOW_NOTIFICATION") {
      const payload = message.payload as PushNotificationPayload;
      const notificationId = `mysquad_${Date.now()}`;

      const notificationOptions: chrome.notifications.NotificationOptions = {
        type: "basic",
        iconUrl: payload.icon || browser.runtime.getURL("icon/icon-128.png"),
        title: payload.title,
        message: payload.body,
        priority: 2,
        requireInteraction: payload.requireInteraction ?? false,
      };

      if (payload.data?.actions && Array.isArray(payload.data.actions)) {
        notificationOptions.buttons = payload.data.actions.slice(0, 2).map((action: { title: string }) => ({
          title: action.title,
        }));
      }

      browser.storage.local
        .set({
          [`notification_${notificationId}`]: {
            url: payload.url || payload.data?.url,
            actions: payload.data?.actions,
          },
        })
        .then(() => {
          browser.notifications
            .create(notificationId, notificationOptions)
            .then(() => {
              sendResponse({ success: true, notificationId });
            })
            .catch((error) => {
              console.error("[Background] Error creating notification:", error);
              sendResponse({ success: false, error: String(error) });
            });
        });

      return true;
    }

    return false;
  });
});
