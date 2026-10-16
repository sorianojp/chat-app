import { offlineStatusLabel, timestamp } from '@/features/messenger/lib/format';
import {
    latestPinnedMessage,
    messagePreview,
} from '@/features/messenger/lib/messages';
import type {
    Conversation,
    MessengerMessage,
} from '@/features/messenger/types';

export function conversationHasOnlineParticipants(
    conversation: Conversation,
    currentUserId: number,
    onlineUserIds: Set<number>,
) {
    return conversation.participants.some(
        (participant) =>
            participant.id !== currentUserId &&
            onlineUserIds.has(participant.id),
    );
}

export function conversationStatusLabel(
    conversation: Conversation,
    currentUserId: number,
    onlineUserIds: Set<number>,
) {
    const onlineParticipants = conversation.participants.filter(
        (participant) =>
            participant.id !== currentUserId &&
            onlineUserIds.has(participant.id),
    );

    if (conversation.type === 'direct') {
        if (onlineParticipants.length > 0) {
            return 'Active now';
        }

        const otherParticipant = conversation.participants.find(
            (participant) => participant.id !== currentUserId,
        );

        return offlineStatusLabel(otherParticipant?.last_seen_at ?? null);
    }

    if (onlineParticipants.length === 0) {
        return `${conversation.participants.length} members`;
    }

    return `${onlineParticipants.length} active now`;
}

export function sortConversations(conversations: Conversation[]) {
    return [...conversations].sort((first, second) => {
        const firstPinned = first.pinned_at ? 1 : 0;
        const secondPinned = second.pinned_at ? 1 : 0;

        if (firstPinned !== secondPinned) {
            return secondPinned - firstPinned;
        }

        return (
            timestamp(second.last_message_at ?? second.pinned_at) -
            timestamp(first.last_message_at ?? first.pinned_at)
        );
    });
}

export function conversationPreview(message: MessengerMessage | null) {
    if (!message) {
        return 'No messages yet';
    }

    return messagePreview(message);
}

export function participantDisplayName(
    conversation: Conversation,
    userId: number,
    fallback: string,
) {
    const participant = conversation.participants.find(
        (item) => item.id === userId,
    );

    return participant?.nickname || participant?.name || fallback;
}

export function applyConversationSystemMessage(
    conversation: Conversation,
    message: MessengerMessage,
) {
    if (message.type !== 'system' || !message.metadata) {
        return conversation;
    }

    const event = message.metadata.event;

    if (
        event === 'conversation_renamed' &&
        typeof message.metadata.new_title === 'string'
    ) {
        return {
            ...conversation,
            title: message.metadata.new_title,
            display_name: message.metadata.new_title,
        };
    }

    if (event === 'group_photo_updated') {
        return {
            ...conversation,
            photo_url:
                typeof message.metadata.photo_url === 'string'
                    ? message.metadata.photo_url
                    : conversation.photo_url,
        };
    }

    if (event === 'group_photo_removed') {
        return { ...conversation, photo_url: null };
    }

    if (
        event === 'participant_nickname_updated' &&
        typeof message.metadata.participant_id === 'number'
    ) {
        return {
            ...conversation,
            participants: conversation.participants.map((participant) =>
                participant.id === message.metadata?.participant_id
                    ? {
                          ...participant,
                          nickname:
                              typeof message.metadata?.nickname === 'string'
                                  ? message.metadata.nickname
                                  : null,
                      }
                    : participant,
            ),
        };
    }

    return conversation;
}

export function updateConversationMessageSnapshot(
    conversation: Conversation,
    message: MessengerMessage,
) {
    const updatedConversation = {
        ...conversation,
        latest_message:
            conversation.latest_message?.id === message.id
                ? message
                : conversation.latest_message,
    };

    if (conversation.pinned_message?.id === message.id) {
        return {
            ...updatedConversation,
            pinned_message: message.pinned_at ? message : null,
        };
    }

    if (message.pinned_at) {
        return {
            ...updatedConversation,
            pinned_message: latestPinnedMessage([
                conversation.pinned_message,
                message,
            ]),
        };
    }

    return updatedConversation;
}

export function typingTimeoutKey(conversationId: number, userId: number) {
    return `${conversationId}:${userId}`;
}

export function uniqueUserIds(userIds: number[]) {
    return Array.from(new Set(userIds));
}
