import type { Page } from '@playwright/test';
import { expect, openAs, sendMessage, test, thread } from './fixtures';

type Shown = { title: string; body?: string };

/**
 * Records notifications instead of showing them, and makes the tab count as
 * focused so we test the "user is looking at the app" case deterministically.
 */
function recordNotifications(failPush: boolean) {
    return () => {
        const shown: Shown[] = [];
        (window as unknown as { __shown: Shown[] }).__shown = shown;
        const record = (title: string, options?: NotificationOptions) =>
            shown.push({ title, body: options?.body });

        Document.prototype.hasFocus = () => true;

        // Headless Chromium always reports notification permission as denied,
        // so stand in for the Notification API with a granted one.
        class FakeNotification {
            static permission: NotificationPermission = 'granted';
            static requestPermission = async () => 'granted' as const;
            onclick: (() => void) | null = null;

            constructor(title: string, options?: NotificationOptions) {
                record(title, options);
            }

            close() {}
        }
        Object.defineProperty(window, 'Notification', {
            configurable: true,
            value: FakeNotification,
        });
        ServiceWorkerRegistration.prototype.showNotification = async (
            title: string,
            options?: NotificationOptions,
        ) => {
            record(title, options);
        };

        if (failPush) {
            PushManager.prototype.subscribe = () =>
                Promise.reject(
                    new DOMException(
                        'Registration failed - push service error',
                        'AbortError',
                    ),
                );
        }
    };
}

const shownBodies = (page: Page) =>
    page.evaluate(() =>
        (window as unknown as { __shown: Shown[] }).__shown.map(
            (item) => item.body,
        ),
    );

test.describe('browser alerts', () => {
    test.use({ secondChat: true });

    test('alerts still turn on when the browser blocks background push', async ({
        browser,
        scenario,
    }) => {
        const alice = await openAs(
            browser,
            scenario.alice.id,
            scenario.url,
            {},
            recordNotifications(true),
        );

        await alice
            .getByRole('button', { name: 'Enable browser alerts' })
            .click();

        await expect(
            alice.getByRole('button', { name: 'Disable browser alerts' }),
        ).toBeVisible();
        await expect(
            alice.getByText('On while Messenger is open.'),
        ).toBeVisible();
        await expect(
            alice.getByText(/Alerts work while Uhoo! is open/),
        ).toBeVisible();

        await alice.context().close();
    });

    test('a focused tab notifies for other chats but not the open one', async ({
        browser,
        scenario,
    }) => {
        const alice = await openAs(
            browser,
            scenario.alice.id,
            scenario.url,
            {},
            recordNotifications(false),
        );
        await alice
            .getByRole('button', { name: 'Enable browser alerts' })
            .click();
        await expect(
            alice.getByRole('button', { name: 'Disable browser alerts' }),
        ).toBeVisible();

        const bob = await openAs(browser, scenario.bob.id, scenario.url);
        const dana = await openAs(
            browser,
            scenario.dana!.id,
            `/${scenario.team.slug}/messenger?conversation=${scenario.second_conversation!.id}`,
        );

        // Alice has the chat with Bob open: no notification for it.
        await sendMessage(bob, 'Hi from the open chat');
        await expect(
            thread(alice).getByText('Hi from the open chat'),
        ).toBeVisible();

        // Dana writes in another chat: Alice gets a notification.
        await sendMessage(dana, 'Hi from another chat');
        await expect
            .poll(() => shownBodies(alice))
            .toContain('Hi from another chat');
        expect(await shownBodies(alice)).not.toContain('Hi from the open chat');

        await Promise.all([
            alice.context().close(),
            bob.context().close(),
            dana.context().close(),
        ]);
    });
});
