import { echo } from '@laravel/echo-react';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    TYPING_IDLE_MS,
    TYPING_WHISPER_INTERVAL_MS,
} from '@/features/messenger/lib/constants';
import { typingTimeoutKey } from '@/features/messenger/lib/conversations';
import type {
    TypingChannel,
    TypingPayload,
    TypingUser,
} from '@/features/messenger/types';

/**
 * Tracks who is typing in the active conversation (via presence-channel
 * whispers) and broadcasts the current user's own typing state.
 */
export function useTypingIndicators({
    activeConversationId,
    activeConversationIdRef,
    currentUser,
}: {
    activeConversationId: number | null;
    activeConversationIdRef: RefObject<number | null>;
    currentUser: { id: number; name: string };
}) {
    const [typingUsersByConversation, setTypingUsersByConversation] = useState<
        Record<number, Record<number, TypingUser>>
    >({});
    const lastTypingWhisperAtRef = useRef(0);
    const ownTypingStopTimeoutRef = useRef<number | null>(null);
    const activeTypingChannelRef = useRef<TypingChannel | null>(null);
    const typingTimeoutsRef = useRef<Record<string, number>>({});

    const removeTypingUser = useCallback(
        (conversationId: number, userId: number) => {
            const key = typingTimeoutKey(conversationId, userId);
            const timeout = typingTimeoutsRef.current[key];

            if (timeout) {
                window.clearTimeout(timeout);
                delete typingTimeoutsRef.current[key];
            }

            setTypingUsersByConversation((typingUsers) => {
                const conversationTypingUsers =
                    typingUsers[conversationId] ?? {};

                if (!conversationTypingUsers[userId]) {
                    return typingUsers;
                }

                const nextConversationTypingUsers = {
                    ...conversationTypingUsers,
                };
                delete nextConversationTypingUsers[userId];

                return {
                    ...typingUsers,
                    [conversationId]: nextConversationTypingUsers,
                };
            });
        },
        [],
    );

    const whisperTyping = useCallback(
        (conversationId: number, typing: boolean) => {
            if (conversationId !== activeConversationIdRef.current) {
                return;
            }

            activeTypingChannelRef.current?.whisper('typing', {
                id: currentUser.id,
                name: currentUser.name,
                typing,
            });
        },
        [activeConversationIdRef, currentUser.id, currentUser.name],
    );

    const stopOwnTyping = useCallback(
        (conversationId: number | null = activeConversationIdRef.current) => {
            if (ownTypingStopTimeoutRef.current) {
                window.clearTimeout(ownTypingStopTimeoutRef.current);
                ownTypingStopTimeoutRef.current = null;
            }

            lastTypingWhisperAtRef.current = 0;

            if (conversationId) {
                whisperTyping(conversationId, false);
            }
        },
        [activeConversationIdRef, whisperTyping],
    );

    /**
     * Call on every composer change: whispers "typing" (throttled) and
     * schedules the idle "stopped typing" whisper.
     */
    const handleOwnTyping = useCallback(
        (conversationId: number, value: string) => {
            if (!value.trim()) {
                stopOwnTyping(conversationId);

                return;
            }

            const now = Date.now();

            if (
                now - lastTypingWhisperAtRef.current >=
                TYPING_WHISPER_INTERVAL_MS
            ) {
                whisperTyping(conversationId, true);
                lastTypingWhisperAtRef.current = now;
            }

            if (ownTypingStopTimeoutRef.current) {
                window.clearTimeout(ownTypingStopTimeoutRef.current);
            }

            ownTypingStopTimeoutRef.current = window.setTimeout(() => {
                stopOwnTyping(conversationId);
            }, TYPING_IDLE_MS);
        },
        [stopOwnTyping, whisperTyping],
    );

    useEffect(() => {
        if (!activeConversationId) {
            return;
        }

        const conversationId = activeConversationId;
        const typingTimeouts = typingTimeoutsRef.current;
        const channel = echo<'reverb'>().join(
            `conversations.${conversationId}`,
        ) as TypingChannel;
        const handleTyping = (payload: TypingPayload) => {
            if (!payload.id || payload.id === currentUser.id) {
                return;
            }

            if (!payload.typing) {
                removeTypingUser(conversationId, payload.id);

                return;
            }

            const key = typingTimeoutKey(conversationId, payload.id);
            const existingTimeout = typingTimeouts[key];

            if (existingTimeout) {
                window.clearTimeout(existingTimeout);
            }

            setTypingUsersByConversation((typingUsers) => ({
                ...typingUsers,
                [conversationId]: {
                    ...(typingUsers[conversationId] ?? {}),
                    [payload.id]: {
                        id: payload.id,
                        name: payload.name,
                    },
                },
            }));

            typingTimeouts[key] = window.setTimeout(() => {
                removeTypingUser(conversationId, payload.id);
            }, TYPING_IDLE_MS);
        };

        activeTypingChannelRef.current = channel;
        channel.listenForWhisper('typing', handleTyping);

        return () => {
            if (activeTypingChannelRef.current === channel) {
                activeTypingChannelRef.current = null;
            }

            channel.stopListeningForWhisper('typing', handleTyping);
            echo<'reverb'>().leaveChannel(
                `presence-conversations.${conversationId}`,
            );
            setTypingUsersByConversation((typingUsers) => {
                const nextTypingUsers = { ...typingUsers };
                delete nextTypingUsers[conversationId];

                return nextTypingUsers;
            });

            Object.keys(typingTimeouts)
                .filter((key) => key.startsWith(`${conversationId}:`))
                .forEach((key) => {
                    window.clearTimeout(typingTimeouts[key]);
                    delete typingTimeouts[key];
                });
        };
    }, [activeConversationId, currentUser.id, removeTypingUser]);

    useEffect(() => {
        const typingTimeouts = typingTimeoutsRef.current;

        return () => {
            stopOwnTyping();
            Object.values(typingTimeouts).forEach((timeout) => {
                window.clearTimeout(timeout);
            });
        };
    }, [stopOwnTyping]);

    return {
        typingUsersByConversation,
        stopOwnTyping,
        handleOwnTyping,
    };
}
