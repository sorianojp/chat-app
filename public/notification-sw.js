self.addEventListener('push', (event) => {
    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true,
            });

            // An open Messenger page handles its own real-time alert. This
            // keeps one incoming message from producing two notifications.
            if (
                windows.some((client) =>
                    new URL(client.url).pathname.includes('/messenger'),
                )
            ) {
                return;
            }

            let payload = {};

            try {
                payload = event.data?.json() ?? {};
            } catch {
                payload = { body: event.data?.text() ?? 'New message' };
            }

            await self.registration.showNotification(payload.title ?? 'Uhoo!', {
                body: payload.body ?? 'New message',
                icon: payload.icon ?? '/favicon.ico',
                badge: payload.badge ?? '/favicon.ico',
                tag: payload.tag ?? 'uhoo-message',
                data: { url: payload.url ?? '/' },
            });
        })(),
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = new URL(
        event.notification.data?.url ?? '/',
        self.location.origin,
    );

    if (url.origin !== self.location.origin) {
        return;
    }

    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true,
            });
            const existing = windows.find(
                (client) => new URL(client.url).pathname === url.pathname,
            );

            if (existing) {
                try {
                    const navigated = await existing.navigate(url.href);
                    await (navigated ?? existing).focus();

                    return;
                } catch {
                    // Open a new tab if the existing one cannot navigate.
                }
            }

            await self.clients.openWindow(url.href);
        })(),
    );
});
