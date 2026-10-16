import { useState } from 'react';
import { apiErrorMessage, apiFetch } from '@/features/messenger/lib/api';
import type {
    MessageReactionSummary,
    MessengerMessage,
    NewEventPayload,
    NewPollPayload,
    RsvpStatus,
} from '@/features/messenger/types';

/**
 * Message-level actions (react, pin, unsend, forward, polls, events). Each one
 * calls the API and applies the server's response to local message state.
 * Composer state (reply/edit drafts) stays with the caller via `onUnsent`.
 */
export function useMessageActions({
    apiBaseUrl,
    activeConversationId,
    currentUserId,
    appendMessage,
    replaceMessage,
    updateMessageReactions,
    onUnsent,
    onForwarded,
}: {
    apiBaseUrl: string;
    activeConversationId: number | null;
    currentUserId: number;
    appendMessage: (message: MessengerMessage) => void;
    replaceMessage: (message: MessengerMessage) => void;
    updateMessageReactions: (
        messageId: number,
        reactions: MessageReactionSummary[],
    ) => void;
    onUnsent: (message: MessengerMessage) => void;
    onForwarded: () => void;
}) {
    const [forwarding, setForwarding] = useState(false);

    const messageUrl = (message: MessengerMessage, path = '') =>
        `${apiBaseUrl}/conversations/${message.conversation_id}/messages/${message.id}${path}`;

    /** Replaces the message with the server's updated copy. */
    const applyMessage = async (response: Response) => {
        if (!response.ok) {
            return false;
        }

        const payload = (await response.json()) as { data: MessengerMessage };
        replaceMessage(payload.data);

        return true;
    };

    /** Posts a new poll/event to the active conversation. */
    const createInActiveConversation = async (
        path: string,
        payload: NewPollPayload | NewEventPayload,
    ) => {
        if (!activeConversationId) {
            return false;
        }

        const response = await apiFetch(
            `${apiBaseUrl}/conversations/${activeConversationId}${path}`,
            { method: 'POST', json: payload },
        );

        if (!response.ok) {
            window.alert(await apiErrorMessage(response));

            return false;
        }

        const result = (await response.json()) as { data: MessengerMessage };
        appendMessage(result.data);

        return true;
    };

    const createPoll = (payload: NewPollPayload) =>
        createInActiveConversation('/polls', payload);

    const createEvent = (payload: NewEventPayload) =>
        createInActiveConversation('/events', payload);

    const votePoll = async (message: MessengerMessage, optionId: string) => {
        if (!message.poll) {
            return;
        }

        const selectedIds = message.poll.options
            .filter((option) => option.voted_by_me)
            .map((option) => option.id);
        const optionIds = message.poll.allow_multiple
            ? selectedIds.includes(optionId)
                ? selectedIds.filter((id) => id !== optionId)
                : [...selectedIds, optionId]
            : selectedIds.includes(optionId)
              ? []
              : [optionId];

        await applyMessage(
            await apiFetch(messageUrl(message, '/poll-vote'), {
                method: 'PATCH',
                json: { option_ids: optionIds },
            }),
        );
    };

    const respondToEvent = async (
        message: MessengerMessage,
        status: RsvpStatus,
    ) => {
        await applyMessage(
            await apiFetch(messageUrl(message, '/rsvp'), {
                method: 'PATCH',
                json: {
                    status:
                        message.event?.my_response === status ? null : status,
                },
            }),
        );
    };

    const toggleReaction = async (message: MessengerMessage, emoji: string) => {
        if (message.unsent_at) {
            return;
        }

        const existingReaction = message.reactions.find(
            (reaction) => reaction.reacted_by_me,
        );
        const removingSameReaction = existingReaction?.emoji === emoji;
        const response = await apiFetch(messageUrl(message, '/reaction'), {
            method: removingSameReaction ? 'DELETE' : 'PATCH',
            json: removingSameReaction ? undefined : { emoji },
        });

        if (!response.ok) {
            return;
        }

        const payload = (await response.json()) as {
            data: {
                reactions: MessageReactionSummary[];
            };
        };

        updateMessageReactions(message.id, payload.data.reactions);
    };

    const unsendMessage = async (message: MessengerMessage) => {
        if (
            message.unsent_at ||
            message.sender?.id !== currentUserId ||
            !window.confirm('Unsend this message for everyone?')
        ) {
            return;
        }

        if (
            await applyMessage(
                await apiFetch(messageUrl(message), { method: 'DELETE' }),
            )
        ) {
            onUnsent(message);
        }
    };

    const toggleMessagePin = async (message: MessengerMessage) => {
        if (message.unsent_at || message.type === 'system') {
            return;
        }

        await applyMessage(
            await apiFetch(messageUrl(message, '/pin'), {
                method: 'PATCH',
                json: { pinned: message.pinned_at === null },
            }),
        );
    };

    const forwardMessage = async (
        message: MessengerMessage,
        conversationIds: number[],
    ) => {
        if (conversationIds.length === 0 || forwarding) {
            return false;
        }

        setForwarding(true);

        try {
            const response = await apiFetch(messageUrl(message, '/forward'), {
                method: 'POST',
                json: { conversation_ids: conversationIds },
            });

            if (!response.ok) {
                return false;
            }

            const payload = (await response.json()) as {
                data: MessengerMessage[];
            };

            payload.data.forEach((forwardedMessage) => {
                appendMessage(forwardedMessage);
            });
            onForwarded();

            return true;
        } finally {
            setForwarding(false);
        }
    };

    return {
        forwarding,
        createPoll,
        createEvent,
        votePoll,
        respondToEvent,
        toggleReaction,
        unsendMessage,
        toggleMessagePin,
        forwardMessage,
    };
}
