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
