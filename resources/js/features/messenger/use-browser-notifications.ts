import { useCallback, useEffect, useRef, useState } from 'react';

export type BrowserNotificationPermission =
    NotificationPermission | 'unsupported';

type MessageNotification = {
    messageId: number;
    conversationId: number;
    title: string;
    body: string;
    /** The message's chat is the one currently open on screen. */
    conversationOnScreen: boolean;
};

/** Explains why background (push) alerts could not be registered. */
function pushBlockedMessage(): string {
    const isBrave = 'brave' in navigator;

    return isBrave
        ? 'Alerts work while Uhoo! is open. For alerts when it\'s closed, turn on "Use Google services for push messaging" in Brave\'s privacy settings, then enable again.'
        : "Alerts work while Uhoo! is open. This browser blocked alerts for when it's closed (check that push services aren't blocked by your network).";
}

function currentPermission(): BrowserNotificationPermission {
    if (
        typeof window === 'undefined' ||
        !window.isSecureContext ||
        !('Notification' in window)
    ) {
        return 'unsupported';
    }

    return Notification.permission;
}

function loadEnabled(storageKey: string): boolean {
    try {
        return window.localStorage.getItem(storageKey) === 'on';
    } catch {
        return false;
    }
}

function saveEnabled(storageKey: string, enabled: boolean): void {
    try {
        if (enabled) {
            window.localStorage.setItem(storageKey, 'on');
        } else {
            window.localStorage.removeItem(storageKey);
        }
    } catch {
        // Browser storage can be unavailable in private mode.
    }
}

function wasRecentlyNotified(storageKey: string, messageId: number) {
    const key = `${storageKey}:recent`;

    try {
        const saved: unknown = JSON.parse(
            window.localStorage.getItem(key) ?? '[]',
        );
        const recent = Array.isArray(saved) ? saved : [];

        return recent.some(
            (entry) =>
                Array.isArray(entry) &&
                entry[0] === messageId &&
                typeof entry[1] === 'number' &&
                Date.now() - entry[1] < 60_000,
        );
    } catch {
        return false;
    }
}

function markNotified(storageKey: string, messageId: number) {
    const key = `${storageKey}:recent`;

    try {
        const saved: unknown = JSON.parse(
            window.localStorage.getItem(key) ?? '[]',
        );
        const recent = Array.isArray(saved) ? saved : [];
        const now = Date.now();
        const next = recent
            .filter(
                (entry) =>
                    Array.isArray(entry) &&
                    typeof entry[1] === 'number' &&
                    now - entry[1] < 60_000,
            )
            .slice(-19);

        window.localStorage.setItem(
            key,
            JSON.stringify([...next, [messageId, now]]),
        );
    } catch {
        // The notification tag still replaces duplicates if storage is blocked.
    }
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/');
    const decoded = window.atob(base64);
    const bytes = new Uint8Array(decoded.length);

    for (let index = 0; index < decoded.length; index += 1) {
        bytes[index] = decoded.charCodeAt(index);
    }

    return bytes;
}

function applicationServerKeysMatch(
    subscription: PushSubscription,
    expected: Uint8Array<ArrayBuffer>,
): boolean {
    const current = subscription.options.applicationServerKey;

    if (!current) {
        return false;
    }

    const bytes = new Uint8Array(current);

    return (
        bytes.length === expected.length &&
        bytes.every((value, index) => value === expected[index])
    );
}

function xsrfToken(): string {
    const token = document.cookie
        .split('; ')
        .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
        ?.split('=')
        .slice(1)
        .join('=');

    return token ? decodeURIComponent(token) : '';
}

export function useBrowserNotifications(
    userId: number,
    workspaceId: number,
    workspaceSlug: string,
    webPushPublicKey: string | null,
) {
    const storageKey = `uhoo:browser-notifications:v1:${userId}`;
    const notificationKey = `${storageKey}:${workspaceId}`;
    const [permission, setPermission] = useState(currentPermission);
    const [enabled, setEnabled] = useState(() =>
        typeof window === 'undefined' ? false : loadEnabled(storageKey),
    );
    const [error, setError] = useState<string | null>(null);
    // Background (push) alerts can fail while in-tab alerts still work.
    const [pushActive, setPushActive] = useState(
        () => enabled && webPushPublicKey !== null,
    );
    const [warning, setWarning] = useState<string | null>(null);
    const enabledRef = useRef(enabled);
    const registrationRef =
        useRef<Promise<ServiceWorkerRegistration | null> | null>(null);

    const getRegistration = useCallback(() => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return Promise.resolve(null);
        }

        registrationRef.current ??= navigator.serviceWorker
            .register('/notification-sw.js')
            .then(() => navigator.serviceWorker.ready)
            .catch(() => {
                registrationRef.current = null;

                return null;
            });

        return registrationRef.current;
    }, []);

    const storeSubscription = useCallback(
        async (subscription: PushSubscription) => {
            const json = subscription.toJSON();
            const response = await fetch('/api/web-push/subscription', {
                method: 'PUT',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': xsrfToken(),
                },
                body: JSON.stringify({
                    endpoint: subscription.endpoint,
                    keys: json.keys,
                    content_encoding:
                        PushManager.supportedContentEncodings?.[0] ??
                        'aes128gcm',
                }),
            });

            if (!response.ok) {
                throw new Error('Could not register background alerts.');
            }
        },
        [],
    );

    const enablePush = useCallback(
        async (registration: ServiceWorkerRegistration) => {
            if (!webPushPublicKey) {
                return;
            }

            let subscription = await registration.pushManager.getSubscription();
            const applicationServerKey =
                urlBase64ToUint8Array(webPushPublicKey);

            if (
                subscription &&
                !applicationServerKeysMatch(subscription, applicationServerKey)
            ) {
                await subscription.unsubscribe();
                subscription = null;
            }

            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey,
                });
            }

            await storeSubscription(subscription);
        },
        [storeSubscription, webPushPublicKey],
    );

    const disablePush = useCallback(async () => {
        const registration = await getRegistration();
        const subscription = await registration?.pushManager.getSubscription();

        if (!subscription) {
            return;
        }

        await fetch('/api/web-push/subscription', {
            method: 'DELETE',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': xsrfToken(),
            },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => null);
        await subscription.unsubscribe().catch(() => false);
    }, [getRegistration]);

    useEffect(() => {
        const syncPermission = () => setPermission(currentPermission());

        window.addEventListener('focus', syncPermission);

        if (enabledRef.current && currentPermission() === 'granted') {
            void getRegistration().then(async (registration) => {
                if (!registration || !webPushPublicKey) {
                    return;
                }

                const subscription =
                    await registration.pushManager.getSubscription();

                setPushActive(subscription !== null);

                if (subscription) {
                    await storeSubscription(subscription).catch(() => null);
                }
            });
        }

        return () => window.removeEventListener('focus', syncPermission);
    }, [getRegistration, storeSubscription, webPushPublicKey]);

    const toggle = useCallback(async () => {
        setError(null);
        setWarning(null);

        if (enabledRef.current) {
            enabledRef.current = false;
            setEnabled(false);
            setPushActive(false);
            saveEnabled(storageKey, false);
            await disablePush();

            return;
        }

        let nextPermission = currentPermission();

        if (nextPermission === 'unsupported' || nextPermission === 'denied') {
            setPermission(nextPermission);

            return;
        }

        try {
            if (nextPermission === 'default') {
                nextPermission = await Notification.requestPermission();
            }

            setPermission(nextPermission);

            if (nextPermission === 'granted') {
                // In-tab alerts only need permission; turn them on first.
                enabledRef.current = true;
                setEnabled(true);
                saveEnabled(storageKey, true);

                if (webPushPublicKey) {
                    const registration = await getRegistration();

                    try {
                        if (!registration) {
                            throw new Error('Push is not supported.');
                        }

                        await enablePush(registration);
                        setPushActive(true);
                    } catch {
                        setPushActive(false);
                        setWarning(pushBlockedMessage());
                    }
                }
            }
        } catch (toggleError) {
            setError(
                toggleError instanceof Error
                    ? toggleError.message
                    : 'Could not enable browser alerts. Please try again.',
            );
            setPermission(currentPermission());
        }
    }, [
        disablePush,
        enablePush,
        getRegistration,
        storageKey,
        webPushPublicKey,
    ]);

    const notify = useCallback(
        async ({
            messageId,
            conversationId,
            title,
            body,
            conversationOnScreen,
        }: MessageNotification) => {
            // Skip only what the user is already looking at: the open chat in a
            // focused, visible tab. Other chats still notify (like Slack).
            const alreadyVisible = () =>
                conversationOnScreen && !document.hidden && document.hasFocus();

            if (
                !enabledRef.current ||
                currentPermission() !== 'granted' ||
                alreadyVisible()
            ) {
                return false;
            }

            if (wasRecentlyNotified(notificationKey, messageId)) {
                return true;
            }

            const url = `/${encodeURIComponent(workspaceSlug)}/messenger?conversation=${conversationId}`;
            const options: NotificationOptions = {
                body: body.slice(0, 160),
                icon: '/favicon.ico',
                tag: `${notificationKey}:message:${messageId}`,
                data: { url },
            };

            try {
                const registration = await getRegistration();

                if (
                    !enabledRef.current ||
                    currentPermission() !== 'granted' ||
                    alreadyVisible()
                ) {
                    return false;
                }

                if (wasRecentlyNotified(notificationKey, messageId)) {
                    return true;
                }

                if (registration) {
                    await registration.showNotification(title, options);
                    markNotified(notificationKey, messageId);

                    return true;
                }

                const notification = new Notification(title, options);

                notification.onclick = () => {
                    notification.close();
                    window.focus();
                    window.location.assign(url);
                };
                markNotified(notificationKey, messageId);

                return true;
            } catch {
                return false;
            }
        },
        [getRegistration, notificationKey, workspaceSlug],
    );

    return {
        permission,
        enabled,
        error,
        backgroundEnabled: enabled && pushActive,
        warning,
        toggle,
        notify,
    };
}
