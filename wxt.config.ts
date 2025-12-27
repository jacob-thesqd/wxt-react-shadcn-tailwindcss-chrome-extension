import {defineConfig} from 'wxt';
import react from '@vitejs/plugin-react';

// See https://wxt.dev/api/config.html
export default defineConfig((env) => {
    const targetBrowser = env?.browser ?? "chrome";
    const isChrome = targetBrowser === "chrome";

    return {
        filterEntrypoints: isChrome ? ["sidepanel"] : ["content"],
        manifest: {
            permissions: ["activeTab", "scripting", "sidePanel", "storage", "tabs"],
            action: {},
            name: "__MSG_extName__",
            description: "__MSG_extDescription__",
            default_locale: "en",
        },
        vite: () => ({
            plugins: [react()],
        }),
    };
});
