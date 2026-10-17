import { composer, expect, openDetails, test, thread } from './fixtures';

test('pinning and muting a chat persist after reload', async ({ alice }) => {
    await alice.getByRole('button', { name: 'Pin chat' }).click();
    await expect(
        alice.getByRole('button', { name: 'Unpin chat' }),
    ).toBeVisible();

    await alice.getByRole('button', { name: 'Mute chat' }).click();
    await expect(
        alice.getByRole('button', { name: 'Unmute chat' }),
    ).toBeVisible();

    await alice.reload();
    await expect(
        alice.getByRole('button', { name: 'Unpin chat' }),
    ).toBeVisible();
    await expect(
        alice.getByRole('button', { name: 'Unmute chat' }),
    ).toBeVisible();
});

test('archiving and restoring a chat', async ({ alice }) => {
    await alice.getByRole('button', { name: 'Archive chat' }).click();
    await expect(composer(alice)).toBeHidden();

    await alice.getByRole('link', { name: 'Archive', exact: true }).click();
    await alice.getByText('Bob Parent').first().click();
    await alice.getByRole('button', { name: 'Restore chat' }).click();

    await alice.getByRole('link', { name: 'Back to inbox' }).click();
    await alice.getByText('Bob Parent').first().click();
    await expect(composer(alice)).toBeVisible();
});

test.describe('group chats', () => {
    test.use({ scenarioType: 'group' });

    test('renaming the group and removing a member', async ({ alice }) => {
        await openDetails(alice);
        await alice.getByPlaceholder('Group name').fill('Field Trip');
        await alice.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(thread(alice).getByText(/Field Trip/)).toBeVisible();

        await alice
            .getByRole('button', { name: 'Remove Carol Parent' })
            .click();
        await expect(thread(alice).getByText(/Carol Parent/)).toBeVisible();
        await expect(
            alice.getByRole('button', { name: 'Remove Carol Parent' }),
        ).toBeHidden();

        await alice.reload();
        await expect(alice.getByPlaceholder('Group name')).toHaveValue(
            'Field Trip',
        );
    });

    test('leaving the group', async ({ alice }) => {
        alice.once('dialog', (dialog) => dialog.accept());
        await openDetails(alice);
        await alice.getByRole('button', { name: 'Leave group' }).click();

        await expect(composer(alice)).toBeHidden();
        await expect(alice.getByText('Planning')).toBeHidden();
    });
});

test('the chat details panel is hidden by default and remembers being opened', async ({
    alice,
}) => {
    const toggle = alice.getByRole('button', { name: 'Chat details' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(alice.getByText('Media, Links and Files')).toBeHidden();

    await toggle.click();
    await expect(alice.getByText('Media, Links and Files')).toBeVisible();

    await alice.reload();
    await expect(alice.getByText('Media, Links and Files')).toBeVisible();

    await alice.getByRole('button', { name: 'Close chat details' }).click();
    await expect(alice.getByText('Media, Links and Files')).toBeHidden();
});
