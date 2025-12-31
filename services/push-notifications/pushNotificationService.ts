/**
 * Push Notification Service for Chrome Extension
 * Handles subscription management and notification display
 */

import {supabase} from '@/services/api/supabase';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';

export interface PushSubscriptionData {
    email: string;
    clickup_user_id?: number;
    endpoint: string;
    p256dh: string;
    auth: string;
    expiration_time?: number | null;
    user_agent?: string;
    extension_id?: string;
    extension_version?: string;
}

export interface PushNotificationPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
    actions?: Array<{
        action: string;
        title: string;
        icon?: string;
    }>;
    requireInteraction?: boolean;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function isPushSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
        console.warn('[PushService] Notifications not supported');
        return 'denied';
    }

    const permission = await Notification.requestPermission();
    console.log('[PushService] Notification permission:', permission);
    return permission;
}

export function getNotificationPermission(): NotificationPermission {
    if (!('Notification' in window)) {
        return 'denied';
    }
    return Notification.permission;
}

export async function subscribeToPushNotifications(
    email: string,
    clickupUserId?: number,
): Promise<{success: boolean; error?: string}> {
    try {
        if (!isPushSupported()) {
            return {success: false, error: 'Push notifications not supported'};
        }

        const permission = await requestNotificationPermission();
        if (permission !== 'granted') {
            return {success: false, error: 'Notification permission denied'};
        }

        const registration = await navigator.serviceWorker.ready;

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            if (!VAPID_PUBLIC_KEY) {
                console.error('[PushService] VAPID_PUBLIC_KEY not configured. Add VAPID_PUBLIC_KEY to your .env file and rebuild the extension.');
                return {success: false, error: 'VAPID_PUBLIC_KEY not configured. Check console for details.'};
            }

            console.log('[PushService] Creating push subscription with VAPID key...');
            try {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                });
                console.log('[PushService] Push subscription created successfully');
            } catch (subscribeError) {
                console.error('[PushService] Failed to create push subscription:', subscribeError);
                return {success: false, error: `Failed to subscribe: ${subscribeError}`};
            }
        }

        const subscriptionJson = subscription.toJSON();
        const p256dh = subscriptionJson.keys?.p256dh;
        const auth = subscriptionJson.keys?.auth;

        if (!p256dh || !auth) {
            return {success: false, error: 'Invalid subscription keys'};
        }

        const {data: existingByEmail} = await supabase
            .from('ext_push_subscriptions')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        const subscriptionData = {
            email,
            clickup_user_id: clickupUserId,
            endpoint: subscription.endpoint,
            p256dh,
            auth,
            expiration_time: subscription.expirationTime,
            user_agent: navigator.userAgent,
            extension_id: chrome?.runtime?.id,
            extension_version: chrome?.runtime?.getManifest?.()?.version,
            notification_opt_in: true,
            is_active: true,
        };

        let error;
        if (existingByEmail) {
            const result = await supabase
                .from('ext_push_subscriptions')
                .update(subscriptionData)
                .eq('email', email);
            error = result.error;
        } else {
            const result = await supabase
                .from('ext_push_subscriptions')
                .insert(subscriptionData);
            error = result.error;
        }

        if (error) {
            console.error('[PushService] Error saving subscription:', error);
            return {success: false, error: 'Failed to save subscription'};
        }

        console.log('[PushService] Successfully subscribed to push notifications');
        return {success: true};
    } catch (error) {
        console.error('[PushService] Error subscribing:', error);
        return {success: false, error: String(error)};
    }
}

export async function unsubscribeFromPushNotifications(
    email: string,
): Promise<{success: boolean; error?: string}> {
    try {
        const registration = await navigator.serviceWorker.ready;

        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await subscription.unsubscribe();

            const {error} = await supabase
                .from('ext_push_subscriptions')
                .delete()
                .eq('endpoint', subscription.endpoint);

            if (error) {
                console.error('[PushService] Error removing subscription from DB:', error);
            }
        }

        await supabase
            .from('ext_push_subscriptions')
            .update({is_active: false})
            .eq('email', email);

        console.log('[PushService] Successfully unsubscribed from push notifications');
        return {success: true};
    } catch (error) {
        console.error('[PushService] Error unsubscribing:', error);
        return {success: false, error: String(error)};
    }
}

export async function isSubscribedToPush(): Promise<boolean> {
    try {
        if (!isPushSupported()) {
            return false;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        return subscription !== null;
    } catch (error) {
        console.error('[PushService] Error checking subscription:', error);
        return false;
    }
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
    try {
        if (!isPushSupported()) {
            return null;
        }

        const registration = await navigator.serviceWorker.ready;
        return await registration.pushManager.getSubscription();
    } catch (error) {
        console.error('[PushService] Error getting subscription:', error);
        return null;
    }
}

export async function showLocalNotification(
    payload: PushNotificationPayload,
): Promise<{success: boolean; error?: string}> {
    try {
        const permission = getNotificationPermission();
        if (permission !== 'granted') {
            return {success: false, error: 'Notification permission not granted'};
        }

        const registration = await navigator.serviceWorker.ready;

        await registration.showNotification(payload.title, {
            body: payload.body,
            icon: payload.icon || '/icon/icon-128.png',
            badge: payload.badge || '/icon/icon-48.png',
            tag: payload.tag,
            data: payload.data,
            actions: payload.actions,
            requireInteraction: payload.requireInteraction,
        });

        return {success: true};
    } catch (error) {
        console.error('[PushService] Error showing notification:', error);
        return {success: false, error: String(error)};
    }
}

export async function saveNotificationOptIn(
    email: string,
    optIn: boolean,
): Promise<{success: boolean; error?: string}> {
    try {
        const {data: existing, error: selectError} = await supabase
            .from('ext_push_subscriptions')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (selectError) {
            console.error('[PushService] Error checking existing record:', selectError);
            return {success: false, error: 'Failed to check existing preference'};
        }

        if (existing) {
            const {error: updateError} = await supabase
                .from('ext_push_subscriptions')
                .update({notification_opt_in: optIn})
                .eq('email', email);

            if (updateError) {
                console.error('[PushService] Error updating opt-in preference:', updateError);
                return {success: false, error: 'Failed to save preference'};
            }
        } else {
            const {error: insertError} = await supabase
                .from('ext_push_subscriptions')
                .insert({
                    email,
                    notification_opt_in: optIn,
                    is_active: false,
                });

            if (insertError) {
                console.error('[PushService] Error creating opt-in record:', insertError);
                return {success: false, error: 'Failed to save preference'};
            }
        }

        console.log('[PushService] Successfully saved notification opt-in preference:', optIn);
        return {success: true};
    } catch (error) {
        console.error('[PushService] Error saving opt-in preference:', error);
        return {success: false, error: String(error)};
    }
}

export async function getNotificationOptIn(
    email: string,
): Promise<{optIn: boolean | null; error?: string}> {
    try {
        const {data, error} = await supabase
            .from('ext_push_subscriptions')
            .select('notification_opt_in')
            .eq('email', email)
            .maybeSingle();

        if (error) {
            console.error('[PushService] Error getting opt-in preference:', error);
            return {optIn: null, error: 'Failed to get preference'};
        }

        return {optIn: data?.notification_opt_in ?? null};
    } catch (error) {
        console.error('[PushService] Error getting opt-in preference:', error);
        return {optIn: null, error: String(error)};
    }
}

export default {
    isPushSupported,
    requestNotificationPermission,
    getNotificationPermission,
    subscribeToPushNotifications,
    unsubscribeFromPushNotifications,
    isSubscribedToPush,
    getCurrentSubscription,
    showLocalNotification,
    saveNotificationOptIn,
    getNotificationOptIn,
};
