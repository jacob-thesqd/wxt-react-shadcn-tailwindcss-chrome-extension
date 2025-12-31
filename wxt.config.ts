import {defineConfig} from 'wxt';
import react from '@vitejs/plugin-react';
import {config} from 'dotenv';

// See https://wxt.dev/api/config.html
config();

export default defineConfig((env) => {
    const targetBrowser = env?.browser ?? "chrome";
    const isChrome = targetBrowser === "chrome";

    return {
        filterEntrypoints: isChrome ? ["sidepanel", "background"] : ["content", "background"],
        manifest: {
            permissions: ["activeTab", "downloads", "nativeMessaging", "scripting", "sidePanel", "storage", "tabs", "webRequest", "notifications"],
            host_permissions: [
                "https://app.clickup.com/*",
                "https://api.clickup.com/*",
                "https://churchmediasquad.com/*",
            ],
            action: {},
            name: "__MSG_extName__",
            description: "__MSG_extDescription__",
            default_locale: "en",
        },
        vite: () => ({
            plugins: [react()],
            define: {
                'process.env.CLICKUP_CLIENT_ID': JSON.stringify(process.env.CLICKUP_CLIENT_ID),
                'process.env.CLICKUP_SECRET': JSON.stringify(process.env.CLICKUP_SECRET),
                'process.env.CLICKUP_KEY': JSON.stringify(process.env.CLICKUP_KEY),
                'process.env.REDIRECT_URI': JSON.stringify(process.env.REDIRECT_URI),
                'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL),
                'process.env.SUPABASE_READ_URL': JSON.stringify(process.env.SUPABASE_READ_URL),
                'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY),
                'process.env.WM_AA_KEY': JSON.stringify(process.env.WM_AA_KEY),
                'process.env.WM_TE_KEY': JSON.stringify(process.env.WM_TE_KEY),
                'process.env.VAPID_PUBLIC_KEY': JSON.stringify(process.env.VAPID_PUBLIC_KEY),
            },
            publicDir: 'public',
        }),
    };
});
