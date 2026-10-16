import { test as base, expect } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

export type Scenario = {
    alice: { id: number; name: string };
    bob: { id: number; name: string };
    team: { slug: string };
    conversation: { id: number };
    url: string;
};

/**
 * Opens a fresh browser context signed in as the given user, on the scenario's conversation.
 */
export async function openAs(
    browser: Browser,
    userId: number,
    url: string,
): Promise<Page> {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(
        `/_e2e/login/${userId}?redirect=${encodeURIComponent(url)}`,
    );
    await expect(composer(page)).toBeVisible();

    return page;
}

export function composer(page: Page) {
    return page.getByPlaceholder('Type a message...');
}

export async function sendMessage(page: Page, body: string) {
    await composer(page).fill(body);
    await page.getByRole('button', { name: 'Send message' }).click();
}

/** The open conversation's message timeline (excludes the sidebar previews). */
export function thread(page: Page) {
    return page.getByTestId('message-thread');
}

/** The bubble (hover group) containing the given message text. */
export function messageBubble(page: Page, body: string) {
    return thread(page).locator('div.group').filter({ hasText: body }).last();
}

export const test = base.extend<{
    scenarioType: 'direct' | 'group';
    secondChat: boolean;
    scenario: Scenario;
    alice: Page;
}>({
    scenarioType: ['direct', { option: true }],
    secondChat: [false, { option: true }],
    scenario: async ({ request, scenarioType, secondChat }, use) => {
        const response = await request.post('/_e2e/scenario', {
            data: { type: scenarioType, second_chat: secondChat },
        });
        expect(response.ok()).toBeTruthy();
        await use((await response.json()) as Scenario);
    },
    alice: async ({ browser, scenario }, use) => {
        const page = await openAs(browser, scenario.alice.id, scenario.url);
        await use(page);
        await page.context().close();
    },
});

export { expect };
