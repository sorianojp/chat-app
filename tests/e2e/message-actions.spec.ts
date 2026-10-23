import {
    expect,
    messageBubble,
    openAs,
    sendMessage,
    test,
    thread,
} from './fixtures';

test('pinning and unpinning a message', async ({ alice }) => {
    await sendMessage(alice, 'Field trip is on Friday');
    const bubble = messageBubble(alice, 'Field trip is on Friday');

    await bubble.hover();
    await bubble.getByRole('button', { name: 'Pin message' }).click();
    await expect(
        bubble.getByRole('button', { name: 'Unpin message' }),
    ).toBeAttached();

    await alice.reload();
    const reloaded = messageBubble(alice, 'Field trip is on Friday');
    await reloaded.hover();
    await reloaded.getByRole('button', { name: 'Unpin message' }).click();
    await expect(
        reloaded.getByRole('button', { name: 'Pin message' }),
    ).toBeAttached();
});

test.describe('forwarding', () => {
    test.use({ secondChat: true });

    test('forwarding a message to another chat', async ({ alice }) => {
        await sendMessage(alice, 'Bring snacks tomorrow');
        const bubble = messageBubble(alice, 'Bring snacks tomorrow');

        await bubble.hover();
        await bubble.getByRole('button', { name: 'Forward' }).click();

        const dialog = alice
            .locator('form')
            .filter({ has: alice.getByPlaceholder('Search chats') });
        await dialog.getByRole('button', { name: /Dana Parent/ }).click();
        await dialog
            .getByRole('button', { name: 'Forward', exact: true })
            .click();
        await expect(dialog).toBeHidden();

        await alice.getByText('Dana Parent').first().click();
        await expect(
            thread(alice).getByText('Bring snacks tomorrow'),
        ).toBeVisible();
    });
});

test('creating and voting in a poll', async ({ alice }) => {
    await alice.getByRole('button', { name: 'Create poll' }).click();
    await alice
        .getByPlaceholder('What should we choose?')
        .fill('Which day for the meeting?');
    await alice.getByPlaceholder('Option 1').fill('Monday');
    await alice.getByPlaceholder('Option 2').fill('Wednesday');
    await alice
        .getByRole('button', { name: 'Create poll', exact: true })
        .last()
        .click();

    await expect(
        thread(alice).getByText('Which day for the meeting?'),
    ).toBeVisible();

    const monday = thread(alice).getByRole('button', { name: /Monday/ });
    await monday.click();
    await expect(monday).toHaveAttribute('aria-pressed', 'true');
    await expect(thread(alice).getByText('1 person voted')).toBeVisible();

    await alice.reload();
    await expect(
        thread(alice).getByRole('button', { name: /Monday/ }),
    ).toHaveAttribute('aria-pressed', 'true');
});

test('creating an event and responding to it', async ({ alice }) => {
    await alice.getByRole('button', { name: 'Create event' }).click();
    await alice.getByPlaceholder('Event title').fill('Parent-teacher meeting');
    await alice
        .locator('input[type="datetime-local"]')
        .fill('2030-05-01T10:00');
    await alice.getByPlaceholder('Location (optional)').fill('Room 12');
    await alice
        .getByRole('button', { name: 'Create event', exact: true })
        .last()
        .click();

    await expect(
        thread(alice).getByText('Parent-teacher meeting'),
    ).toBeVisible();

    await thread(alice)
        .getByRole('button', { name: /^Going/ })
        .click();
    await expect(
        thread(alice).getByRole('button', { name: 'Going · 1' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await alice.reload();
    await expect(
        thread(alice).getByRole('button', { name: 'Going · 1' }),
    ).toHaveAttribute('aria-pressed', 'true');
});

test('message info lists who has seen your message', async ({
    alice,
    browser,
    scenario,
}) => {
    await sendMessage(alice, 'Did everyone get this?');
    const bubble = messageBubble(alice, 'Did everyone get this?');

    await bubble.hover();
    await bubble.getByRole('button', { name: 'Message info' }).click();
    const info = alice.getByRole('dialog', { name: 'Message info' });
    await expect(info.getByText('Not delivered yet · 1')).toBeVisible();
    await info.getByRole('button', { name: 'Close' }).click();

    // Bob opens the chat, which marks it read.
    const bob = await openAs(browser, scenario.bob.id, scenario.url);
    await expect(thread(bob).getByText('Did everyone get this?')).toBeVisible();

    await bubble.hover();
    await bubble.getByRole('button', { name: 'Message info' }).click();
    await expect(info.getByText('Seen by · 1')).toBeVisible();
    await expect(info.getByText('Bob Parent')).toBeVisible();

    await bob.context().close();
});

test('saving a message and finding it in Saved', async ({ alice }) => {
    await sendMessage(alice, 'Bring lab gowns on Monday');
    const bubble = messageBubble(alice, 'Bring lab gowns on Monday');

    await bubble.hover();
    await bubble.getByRole('button', { name: 'Save message' }).click();
    await expect(
        bubble.getByRole('button', { name: 'Remove from saved' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await alice.reload();
    await alice.getByRole('button', { name: 'Saved messages' }).click();
    const saved = alice.getByRole('dialog', { name: 'Saved messages' });
    await saved.getByText('Bring lab gowns on Monday').click();
    await expect(saved).toBeHidden();
    await expect(
        messageBubble(alice, 'Bring lab gowns on Monday'),
    ).toBeVisible();
});
