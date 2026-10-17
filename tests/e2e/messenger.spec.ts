import {
    composer,
    expect,
    messageBubble,
    openAs,
    sendMessage,
    test,
    thread,
} from './fixtures';

test('sending a message shows it and keeps it after reload', async ({
    alice,
}) => {
    await sendMessage(alice, 'Hello from Alice');

    await expect(thread(alice).getByText('Hello from Alice')).toBeVisible();
    await expect(composer(alice)).toHaveValue('');

    await alice.reload();
    await expect(thread(alice).getByText('Hello from Alice')).toBeVisible();
});

test('messages and typing arrive in real time for the other participant', async ({
    alice,
    browser,
    scenario,
}) => {
    const bob = await openAs(browser, scenario.bob.id, scenario.url);

    await composer(alice).pressSequentially('Typing something');
    await expect(
        thread(bob).getByText('Alice Teacher is typing...'),
    ).toBeVisible();

    await alice.getByRole('button', { name: 'Send message' }).click();
    await expect(thread(bob).getByText('Typing something')).toBeVisible();
    await expect(
        thread(bob).getByText('Alice Teacher is typing...'),
    ).toBeHidden();

    await bob.context().close();
});

test('reacting to a message', async ({ alice }) => {
    await sendMessage(alice, 'React to me');
    const bubble = messageBubble(alice, 'React to me');

    await bubble.hover();
    await bubble.getByRole('button', { name: 'Add reaction' }).click();
    await bubble.getByRole('button', { name: 'React with 👍' }).click();

    await expect(
        bubble.getByRole('button', { name: 'Reacted with 👍' }),
    ).toHaveAttribute('aria-pressed', 'true');
});

test('editing a message', async ({ alice }) => {
    await sendMessage(alice, 'Original text');
    const bubble = messageBubble(alice, 'Original text');

    await bubble.hover();
    await bubble.getByRole('button', { name: 'Edit' }).click();
    await expect(composer(alice)).toHaveValue('Original text');

    await composer(alice).fill('Corrected text');
    await alice.getByRole('button', { name: 'Send message' }).click();

    const edited = messageBubble(alice, 'Corrected text');
    await expect(edited).toBeVisible();
    await expect(edited.getByText('Edited')).toBeVisible();
    await expect(thread(alice).getByText('Original text')).toBeHidden();
});

test('unsending a message', async ({ alice }) => {
    await sendMessage(alice, 'Oops, wrong chat');
    const bubble = messageBubble(alice, 'Oops, wrong chat');

    alice.once('dialog', (dialog) => dialog.accept());
    await bubble.hover();
    await bubble.getByRole('button', { name: 'Unsend' }).click();

    await expect(
        thread(alice).getByText('You unsent a message.'),
    ).toBeVisible();
    await expect(thread(alice).getByText('Oops, wrong chat')).toBeHidden();
});

test('sending a file attachment', async ({ alice }) => {
    await alice.locator('input[type="file"]').setInputFiles({
        name: 'permission-slip.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\n%e2e test file\n'),
    });
    await alice.getByRole('button', { name: 'Send message' }).click();

    await expect(thread(alice).getByText('permission-slip.pdf')).toBeVisible();

    await alice.reload();
    await expect(thread(alice).getByText('permission-slip.pdf')).toBeVisible();

    // The chat details panel lists it under shared files.
    await expect(
        alice.getByRole('button', { name: /^Files\s*1$/ }),
    ).toBeVisible();
});

test('searching messages in a conversation', async ({ alice }) => {
    await sendMessage(alice, 'Bring your art supplies');
    await sendMessage(alice, 'Library closes early today');

    await alice.getByRole('button', { name: 'Search messages' }).click();
    await alice.getByPlaceholder('Search messages').fill('library');

    await expect(
        thread(alice).getByText('Library closes early today'),
    ).toBeVisible();
    await expect(
        thread(alice).getByText('Bring your art supplies'),
    ).toBeHidden();

    await alice.getByRole('button', { name: 'Close search' }).click();
    await expect(
        thread(alice).getByText('Bring your art supplies'),
    ).toBeVisible();
});

test('replying to a message', async ({ alice }) => {
    await sendMessage(alice, 'Is the meeting at 3pm?');
    const bubble = messageBubble(alice, 'Is the meeting at 3pm?');

    await bubble.hover();
    await bubble.getByRole('button', { name: 'Reply' }).click();
    await expect(alice.getByText('Replying to yourself')).toBeVisible();

    await sendMessage(alice, 'Yes, in Room 4');
    await expect(alice.getByText('Replying to yourself')).toBeHidden();
    await expect(
        messageBubble(alice, 'Yes, in Room 4').getByText(
            'Is the meeting at 3pm?',
        ),
    ).toBeVisible();
});

test.describe('long conversations', () => {
    test.use({ seedMessages: 90 });

    test('scrolling up loads older messages without losing your place', async ({
        alice,
    }) => {
        const timeline = thread(alice);
        // The page opens with the newest 80 of 90 messages.
        await expect(
            timeline.getByText('History message 90', { exact: true }),
        ).toBeVisible();
        await expect(
            timeline.getByText('History message 11', { exact: true }),
        ).toBeAttached();
        await expect(
            timeline.getByText('History message 10', { exact: true }),
        ).toHaveCount(0);

        await timeline.evaluate((element) => {
            element.scrollTop = 0;
        });

        await expect(
            timeline.getByText('History message 1', { exact: true }),
        ).toBeAttached();
        await expect(
            timeline.getByRole('button', { name: 'Load older messages' }),
        ).toHaveCount(0);

        // The message that was at the top before loading is still in view.
        await expect(
            timeline.getByText('History message 11', { exact: true }),
        ).toBeInViewport();
    });
});

test('tapping a message on a phone reveals its actions', async ({ alice }) => {
    await alice.setViewportSize({ width: 390, height: 844 });
    await sendMessage(alice, 'Tap me on a phone');
    const bubble = messageBubble(alice, 'Tap me on a phone');
    const reply = bubble.getByRole('button', { name: 'Reply' });
    // The toolbar (the buttons' parent) is what fades in and out.
    const toolbar = reply.locator('xpath=..');

    await expect(toolbar).toHaveCSS('opacity', '0');
    await bubble.getByText('Tap me on a phone').click();
    await expect(toolbar).toHaveCSS('opacity', '1');
    await reply.click();
    await expect(alice.getByText('Replying to yourself')).toBeVisible();
});

test('the browser alerts box can be hidden and brought back', async ({
    alice,
}) => {
    await alice.getByRole('button', { name: 'Hide browser alerts' }).click();
    await expect(alice.getByText('Browser alerts')).toBeHidden();

    await alice.reload();
    await expect(alice.getByText('Browser alerts')).toBeHidden();

    await alice
        .getByRole('button', { name: 'Show browser alerts settings' })
        .click();
    await expect(alice.getByText('Browser alerts')).toBeVisible();
});

test.describe('long conversation search', () => {
    test.use({ seedMessages: 50 });

    test('search loads older results on request', async ({ alice }) => {
        await alice.getByRole('button', { name: 'Search messages' }).click();
        await alice.getByPlaceholder('Search messages').fill('History');

        const timeline = thread(alice);
        await expect(
            timeline.getByText('History message 50', { exact: true }),
        ).toBeVisible();
        await expect(
            timeline.getByText('History message 1', { exact: true }),
        ).toHaveCount(0);

        await timeline
            .getByRole('button', { name: 'Load older results' })
            .click();
        await expect(
            timeline.getByText('History message 1', { exact: true }),
        ).toBeAttached();
        await expect(
            timeline.getByRole('button', { name: 'Load older results' }),
        ).toHaveCount(0);
    });
});

test.describe('old pinned messages', () => {
    // 200 messages: reaching #1 takes several pages beyond any scroll-up load.
    test.use({ seedMessages: 200, pinOldest: true });

    test('opening an old pinned message loads the history around it', async ({
        alice,
    }) => {
        const timeline = thread(alice);
        await expect(
            timeline.getByText('History message 1', { exact: true }),
        ).toHaveCount(0);

        // The entry in the chat details panel is a button; the banner text is not.
        await alice
            .getByRole('button', { name: /Pinned by Alice Teacher/ })
            .click();

        await expect(
            timeline.getByText('History message 1', { exact: true }),
        ).toBeInViewport();
        // No gap: the messages between it and the newest page loaded too.
        await expect(
            timeline.getByText('History message 50', { exact: true }),
        ).toBeAttached();
    });
});
