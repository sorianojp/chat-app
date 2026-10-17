import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { MessengerMessage } from '@/features/messenger/types';

type ScrollAnchor = {
    conversationId: number;
    messageId: number;
    offset: number;
    generation: number;
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
    // A ref, not state: scroll handlers can hold stale closures, and two loads
    // at once would fight over the scroll position.
    const busyRef = useRef(false);
    // Bumped by a jump (loadOlderUntil) so older "keep your place" restores are dropped.
    const generationRef = useRef(0);

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

        if (!conversationId || !hasOlder || busyRef.current || !oldest) {
            return;
        }

        busyRef.current = true;

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
                      generation: generationRef.current,
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
            busyRef.current = false;
            setLoadingConversationId(null);
        }
    }, [
        apiBaseUrl,
        conversationId,
        hasOlder,
        messageRefs,
        messages,
        onLoaded,
        setHasOlder,
        viewportRef,
    ]);

    /**
     * Loads contiguous history back to `messageId` (e.g. to jump to an old
     * pinned message) without leaving gaps. Gives up after `maxPages` pages
     * and returns whether the message is now loaded.
     */
    const loadOlderUntil = useCallback(
        async (messageId: number, maxPages = 10) => {
            const oldest = messages[0];

            // The caller is about to jump to `messageId`: cancel any pending
            // "keep your place" restore from an in-flight scroll-up load.
            generationRef.current += 1;
            anchorRef.current = null;

            if (!conversationId || !oldest) {
                return false;
            }

            if (oldest.id <= messageId) {
                return true;
            }

            const targetConversationId = conversationId;
            const loaded: MessengerMessage[] = [];
            let cursor = oldest.id;
            let more = hasOlder;
            busyRef.current = true;
            setLoadingConversationId(targetConversationId);

            try {
                for (let page = 0; page < maxPages && more; page++) {
                    const response = await fetch(
                        `${apiBaseUrl}/conversations/${targetConversationId}/messages?before_id=${cursor}`,
                        {
                            credentials: 'same-origin',
                            headers: { Accept: 'application/json' },
                        },
                    );

                    if (!response.ok) {
                        break;
                    }

                    const payload = (await response.json()) as {
                        data: MessengerMessage[];
                        next_page_url: string | null;
                    };

                    loaded.push(...payload.data);
                    more = payload.next_page_url !== null;

                    if (payload.data.length === 0) {
                        break;
                    }

                    cursor = payload.data[payload.data.length - 1].id;

                    if (cursor <= messageId) {
                        break;
                    }
                }
            } finally {
                busyRef.current = false;
                setLoadingConversationId(null);
            }

            if (loaded.length > 0) {
                onLoaded(targetConversationId, loaded);
            }

            setHasOlder(targetConversationId, more);

            return cursor <= messageId;
        },
        [apiBaseUrl, conversationId, hasOlder, messages, onLoaded, setHasOlder],
    );

    // Once the older messages are rendered above, put the previously-first
    // message back where it was so the view does not jump.
    useLayoutEffect(() => {
        const anchor = anchorRef.current;

        if (!anchor || anchor.generation !== generationRef.current) {
            anchorRef.current = null;

            return;
        }

        if (
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

    return { hasOlder, loadingOlder, loadOlder, loadOlderUntil, setHasOlder };
}
