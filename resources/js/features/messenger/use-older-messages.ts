import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { MessengerMessage } from '@/features/messenger/types';

type ScrollAnchor = {
    conversationId: number;
    messageId: number;
    offset: number;
};

/**
 * Loads older history for the open conversation, 40 messages at a time, and
 * keeps the message the user was reading in the same place on screen.
 */
export function useOlderMessages({
    apiBaseUrl,
    conversationId,
    messages,
    viewportRef,
    messageRefs,
    initialConversationId,
    initialHasOlder,
    onLoaded,
}: {
    apiBaseUrl: string;
    conversationId: number | null;
    messages: MessengerMessage[];
    viewportRef: RefObject<HTMLDivElement | null>;
    messageRefs: RefObject<Record<number, HTMLDivElement | null>>;
    initialConversationId: number | null;
    initialHasOlder: boolean;
    onLoaded: (conversationId: number, messages: MessengerMessage[]) => void;
}) {
    const [hasOlderByConversation, setHasOlderByConversation] = useState<
        Record<number, boolean>
    >(() =>
        initialConversationId
            ? { [initialConversationId]: initialHasOlder }
            : {},
    );
    const [loadingConversationId, setLoadingConversationId] = useState<
        number | null
    >(null);
    const anchorRef = useRef<ScrollAnchor | null>(null);

    const setHasOlder = useCallback(
        (targetConversationId: number, hasOlder: boolean) => {
            setHasOlderByConversation((current) => ({
                ...current,
                [targetConversationId]: hasOlder,
            }));
        },
        [],
    );

    const hasOlder = conversationId
        ? (hasOlderByConversation[conversationId] ?? false)
        : false;
    const loadingOlder =
        conversationId !== null && loadingConversationId === conversationId;

    const loadOlder = useCallback(async () => {
        const oldest = messages[0];

        if (!conversationId || !hasOlder || loadingConversationId || !oldest) {
            return;
        }

        const viewport = viewportRef.current;
        const oldestElement = messageRefs.current[oldest.id];
        anchorRef.current =
            viewport && oldestElement
                ? {
                      conversationId,
                      messageId: oldest.id,
                      offset:
                          oldestElement.getBoundingClientRect().top -
                          viewport.getBoundingClientRect().top,
                  }
                : null;
        setLoadingConversationId(conversationId);

        try {
            const response = await fetch(
                `${apiBaseUrl}/conversations/${conversationId}/messages?before_id=${oldest.id}`,
                {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' },
                },
            );

            if (!response.ok) {
                anchorRef.current = null;

                return;
            }

            const payload = (await response.json()) as {
                data: MessengerMessage[];
                next_page_url: string | null;
            };

            if (payload.data.length === 0) {
                anchorRef.current = null;
            }

            onLoaded(conversationId, payload.data);
            setHasOlder(conversationId, payload.next_page_url !== null);
        } finally {
            setLoadingConversationId(null);
        }
    }, [
        apiBaseUrl,
        conversationId,
        hasOlder,
        loadingConversationId,
        messageRefs,
        messages,
        onLoaded,
        setHasOlder,
        viewportRef,
    ]);

    // Once the older messages are rendered above, put the previously-first
    // message back where it was so the view does not jump.
    useLayoutEffect(() => {
        const anchor = anchorRef.current;

        if (
            !anchor ||
            anchor.conversationId !== conversationId ||
            messages[0]?.id === anchor.messageId
        ) {
            return;
        }

        const viewport = viewportRef.current;
        const anchorElement = messageRefs.current[anchor.messageId];
        anchorRef.current = null;

        if (!viewport || !anchorElement) {
            return;
        }

        viewport.scrollTop +=
            anchorElement.getBoundingClientRect().top -
            viewport.getBoundingClientRect().top -
            anchor.offset;
    }, [conversationId, messageRefs, messages, viewportRef]);

    return { hasOlder, loadingOlder, loadOlder, setHasOlder };
}
