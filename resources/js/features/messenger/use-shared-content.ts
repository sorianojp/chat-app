import { useCallback, useEffect, useState } from 'react';
import { EMPTY_SHARED_CONTENT } from '@/features/messenger/lib/constants';
import type { SharedContent } from '@/features/messenger/types';

/**
 * Media, files and links shared in the active conversation (the chat details
 * panel). Refetched when the conversation changes or its message count changes.
 */
export function useSharedContent({
    apiBaseUrl,
    activeConversationId,
    messageCount,
    initialConversationId,
}: {
    apiBaseUrl: string;
    activeConversationId: number | null;
    messageCount: number;
    initialConversationId: number | null;
}) {
    const [sharedContentByConversation, setSharedContentByConversation] =
        useState<Record<number, SharedContent>>({});
    const [loadingSharedConversationId, setLoadingSharedConversationId] =
        useState<number | null>(initialConversationId);

    const fetchSharedContent = useCallback(
        async (conversationId: number) => {
            try {
                const response = await fetch(
                    `${apiBaseUrl}/conversations/${conversationId}/shared`,
                    {
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                        },
                    },
                );

                if (!response.ok) {
                    return;
                }

                const payload = (await response.json()) as {
                    data: SharedContent;
                };

                setSharedContentByConversation((content) => ({
                    ...content,
                    [conversationId]: payload.data,
                }));
            } finally {
                setLoadingSharedConversationId((loadingConversationId) =>
                    loadingConversationId === conversationId
                        ? null
                        : loadingConversationId,
                );
            }
        },
        [apiBaseUrl],
    );

    useEffect(() => {
        if (!activeConversationId) {
            return;
        }

        void fetchSharedContent(activeConversationId);
    }, [activeConversationId, messageCount, fetchSharedContent]);

    return {
        sharedContent: activeConversationId
            ? (sharedContentByConversation[activeConversationId] ??
              EMPTY_SHARED_CONTENT)
            : EMPTY_SHARED_CONTENT,
        loadingSharedContent:
            activeConversationId !== null &&
            loadingSharedConversationId === activeConversationId,
        /** Show the loading state immediately when switching conversations. */
        markSharedContentLoading: setLoadingSharedConversationId,
    };
}
