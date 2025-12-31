/**
 * React hook for managing push notification subscriptions
 */

import {useState, useEffect, useCallback} from 'react';
import {browser} from 'wxt/browser';
import {
    isPushSupported,
    getNotificationPermission,
    subscribeToPushNotifications,
    unsubscribeFromPushNotifications,
    isSubscribedToPush,
    showLocalNotification,
    PushNotificationPayload,
} from '@/services/push-notifications';

interface UsePushNotificationsReturn {
    isSupported: boolean;
    permission: NotificationPermission;
    isSubscribed: boolean;
    isLoading: boolean;
    error: string | null;
    subscribe: () => Promise<{success: boolean; error?: string}>;
    unsubscribe: () => Promise<{success: boolean; error?: string}>;
    showNotification: (payload: PushNotificationPayload) => Promise<{success: boolean; error?: string}>;
    refreshStatus: () => Promise<void>;
}

interface UsePushNotificationsOptions {
    email?: string;
    clickupUserId?: number;
    autoSubscribe?: boolean;
}

export function usePushNotifications(options: UsePushNotificationsOptions = {}): UsePushNotificationsReturn {
    const {email, clickupUserId, autoSubscribe = false} = options;

    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshStatus = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const supported = isPushSupported();
            setIsSupported(supported);

            if (!supported) {
                setPermission('denied');
                setIsSubscribed(false);
                return;
            }

            const currentPermission = getNotificationPermission();
            setPermission(currentPermission);

            const subscribed = await isSubscribedToPush();
            setIsSubscribed(subscribed);
        } catch (err) {
            console.error('[usePushNotifications] Error refreshing status:', err);
            setError(String(err));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const subscribe = useCallback(async () => {
        if (!email) {
            return {success: false, error: 'Email is required to subscribe'};
        }

        try {
            setIsLoading(true);
            setError(null);

            const result = await subscribeToPushNotifications(email, clickupUserId);

            if (result.success) {
                setIsSubscribed(true);
                setPermission('granted');
            } else {
                setError(result.error || 'Failed to subscribe');
            }

            return result;
        } catch (err) {
            const errorMsg = String(err);
            setError(errorMsg);
            return {success: false, error: errorMsg};
        } finally {
            setIsLoading(false);
        }
    }, [email, clickupUserId]);

    const unsubscribe = useCallback(async () => {
        if (!email) {
            return {success: false, error: 'Email is required to unsubscribe'};
        }

        try {
            setIsLoading(true);
            setError(null);

            const result = await unsubscribeFromPushNotifications(email);

            if (result.success) {
                setIsSubscribed(false);
            } else {
                setError(result.error || 'Failed to unsubscribe');
            }

            return result;
        } catch (err) {
            const errorMsg = String(err);
            setError(errorMsg);
            return {success: false, error: errorMsg};
        } finally {
            setIsLoading(false);
        }
    }, [email]);

    const showNotification = useCallback(async (payload: PushNotificationPayload) => {
        try {
            const response = await browser.runtime.sendMessage({
                type: 'SHOW_NOTIFICATION',
                payload,
            });

            if (response?.success) {
                return {success: true};
            }

            return await showLocalNotification(payload);
        } catch (err) {
            console.error('[usePushNotifications] Error showing notification:', err);
            return await showLocalNotification(payload);
        }
    }, []);

    useEffect(() => {
        refreshStatus();
    }, [refreshStatus]);

    useEffect(() => {
        if (autoSubscribe && isSupported && !isSubscribed && permission === 'default' && email && !isLoading) {
            subscribe();
        }
    }, [autoSubscribe, isSupported, isSubscribed, permission, email, isLoading, subscribe]);

    return {
        isSupported,
        permission,
        isSubscribed,
        isLoading,
        error,
        subscribe,
        unsubscribe,
        showNotification,
        refreshStatus,
    };
}

export default usePushNotifications;
