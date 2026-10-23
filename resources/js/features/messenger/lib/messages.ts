import {
    escapeRegExp,
    formatSeenAt,
    timestamp,
} from '@/features/messenger/lib/format';
import { mentionToken } from '@/features/messenger/lib/text';
import type {
    Conversation,
    LinkPreview,
    MessageDeliveryReceipt,
    MessageReactionSummary,
    MessengerMessage,
    ReplyToMessage,
    RsvpStatus,
} from '@/features/messenger/types';

export function sortMessagesByCreatedAt(messages: MessengerMessage[]) {
    return [...messages].sort(
        (first, second) =>
            timestamp(first.created_at) - timestamp(second.created_at),
    );
}

export function messagePreview(message: MessengerMessage) {
    if (message.unsent_at) {
        return message.sender
            ? `${message.sender.name} unsent a message`
            : 'Message unsent';
    }

    if (message.poll) {
        return `Poll: ${message.poll.question}`;
    }

    if (message.event) {
        return `Event: ${message.event.title}`;
    }

    if (message.type === 'voice') {
        return 'Voice message';
    }

    if (message.body) {
        return message.body;
    }

    if (message.attachments.length === 1) {
        return `Attachment: ${message.attachments[0].name}`;
    }

    if (message.attachments.length > 1) {
        return `${message.attachments.length} attachments`;
    }

    return 'No messages yet';
}

export function replyMessagePreview(replyTo: ReplyToMessage) {
    if (replyTo.unsent_at) {
        return 'Message unsent';
    }

    if (replyTo.body) {
        return replyTo.body;
    }

    if (replyTo.attachment_count === 1) {
        return 'Attachment';
    }

    if (replyTo.attachment_count > 1) {
        return `${replyTo.attachment_count} attachments`;
    }

    return 'Message';
}

export function messageLinkPreviews(message: MessengerMessage): LinkPreview[] {
    const previews = message.metadata?.link_previews;

    return Array.isArray(previews) ? (previews as LinkPreview[]) : [];
}

export function latestSeenMessageId(
    messages: MessengerMessage[],
    currentUserId: number,
) {
    for (const message of [...messages].reverse()) {
        if (
            message.sender?.id === currentUserId &&
            message.read_by.some((receipt) => receipt.id !== currentUserId)
        ) {
            return message.id;
        }
    }

    return null;
}

export function latestDeliveredMessageId(
    messages: MessengerMessage[],
    currentUserId: number,
) {
    for (const message of [...messages].reverse()) {
        if (
            message.sender?.id === currentUserId &&
            message.delivered_to.some((receipt) => receipt.id !== currentUserId)
        ) {
            return message.id;
        }
    }

    return null;
}

export function latestOwnMessageIdFor(
    messages: MessengerMessage[],
    currentUserId: number,
) {
    for (const message of [...messages].reverse()) {
        if (
            message.sender?.id === currentUserId &&
            message.unsent_at === null
        ) {
            return message.id;
        }
    }

    return null;
}

export function messageDeliveryStatus(
    message: MessengerMessage,
    currentUserId: number,
    hasHydrated: boolean,
    latestSeen: boolean,
    latestDelivered: boolean,
    latestOwnMessage: boolean,
) {
    if (
        !hasHydrated ||
        message.sender?.id !== currentUserId ||
        message.unsent_at !== null
    ) {
        return null;
    }

    if (latestSeen) {
        const latestReadReceipt = message.read_by
            .filter((receipt) => receipt.id !== currentUserId)
            .sort(
                (first, second) =>
                    new Date(second.read_at).getTime() -
                    new Date(first.read_at).getTime(),
            )[0];

        return latestReadReceipt
            ? formatSeenAt(latestReadReceipt.read_at)
            : null;
    }

    if (latestDelivered) {
        return 'Delivered';
    }

    return latestOwnMessage ? 'Sent' : null;
}

export function addDeliveryReceipt(
    message: MessengerMessage,
    receipt: MessageDeliveryReceipt,
) {
    if (message.delivered_to.some((item) => item.id === receipt.id)) {
        return message;
    }

    return {
        ...message,
        delivered_to: [...message.delivered_to, receipt],
    };
}

export function personalizeReactions(
    reactions: MessageReactionSummary[],
    currentUserId: number,
) {
    return reactions.map((reaction) => ({
        ...reaction,
        reacted_by_me: reaction.users.some((user) => user.id === currentUserId),
    }));
}

export function personalizeMessage(
    message: MessengerMessage,
    currentUserId: number,
) {
    return {
        ...message,
        reactions: personalizeReactions(message.reactions, currentUserId),
        poll: message.poll
            ? {
                  ...message.poll,
                  options: message.poll.options.map((option) => ({
                      ...option,
                      voted_by_me: option.voters.some(
                          (voter) => voter.id === currentUserId,
                      ),
                  })),
              }
            : null,
        event: message.event
            ? {
                  ...message.event,
                  my_response:
                      (Object.entries(message.event.responses).find(
                          ([, users]) =>
                              users.some((user) => user.id === currentUserId),
                      )?.[0] as RsvpStatus | undefined) ?? null,
              }
            : null,
    };
}

export function replyToFromMessage(message: MessengerMessage): ReplyToMessage {
    return {
        id: message.id,
        sender: message.sender
            ? {
                  id: message.sender.id,
                  name: message.sender.name,
              }
            : null,
        body: message.unsent_at ? '' : message.body,
        attachment_count: message.unsent_at ? 0 : message.attachments.length,
        unsent_at: message.unsent_at,
    };
}

export function latestPinnedMessage(messages: Array<MessengerMessage | null>) {
    return pinnedMessagesList(messages)[0] ?? null;
}

export function pinnedMessagesList(messages: Array<MessengerMessage | null>) {
    return Array.from(
        messages
            .filter(
                (message): message is MessengerMessage =>
                    message !== null &&
                    message.pinned_at !== null &&
                    message.unsent_at === null,
            )
            .reduce((pinnedMessages, message) => {
                pinnedMessages.set(message.id, message);

                return pinnedMessages;
            }, new Map<number, MessengerMessage>())
            .values(),
    ).sort(
        (first, second) =>
            new Date(second.pinned_at ?? 0).getTime() -
            new Date(first.pinned_at ?? 0).getTime(),
    );
}

export function mapMessages(
    messagesByConversation: Record<number, MessengerMessage[]>,
    mapper: (message: MessengerMessage) => MessengerMessage,
) {
    return Object.fromEntries(
        Object.entries(messagesByConversation).map(
            ([conversationId, messages]) => [
                conversationId,
                messages.map(mapper),
            ],
        ),
    );
}

export function shouldPlayNotificationSound(
    message: MessengerMessage,
    conversation: Conversation | undefined,
    currentUserId: number,
    currentUserName: string,
) {
    if (
        message.sender === null ||
        message.sender.id === currentUserId ||
        message.type === 'system' ||
        message.unsent_at !== null
    ) {
        return false;
    }

    if (
        conversation &&
        (conversation.muted_at !== null ||
            conversation.notification_preference === 'muted')
    ) {
        return false;
    }

    if (conversation?.notification_preference === 'mentions') {
        return messageMentionsUser(message, currentUserId, currentUserName);
    }

    return true;
}

export function messageMentionsUser(
    message: MessengerMessage,
    currentUserId: number,
    currentUserName: string,
) {
    if (
        message.mentions_me ||
        message.mentions_everyone ||
        message.mentions.some((mention) => mention.id === currentUserId)
    ) {
        return true;
    }

    const normalizedBody = message.body.toLowerCase();
    const normalizedName = currentUserName.toLowerCase();
    const normalizedToken = mentionToken(currentUserName).toLowerCase();
    const firstName = normalizedName.split(/\s+/)[0] ?? normalizedName;

    return (
        bodyContainsMention(normalizedBody, 'everyone') ||
        bodyContainsMention(normalizedBody, normalizedName) ||
        bodyContainsMention(normalizedBody, normalizedToken) ||
        bodyContainsMention(normalizedBody, firstName)
    );
}

export function bodyContainsMention(body: string, token: string) {
    if (!token) {
        return false;
    }

    const escapedToken = escapeRegExp(token);
    const mentionPattern = new RegExp(
        `(^|\\s)@${escapedToken}(?=$|\\s|[.,!?;:)\\]])`,
        'i',
    );

    return mentionPattern.test(body);
}

export type MessageReceiptGroups = {
    seen: { id: number; name: string; at: string }[];
    delivered: { id: number; name: string; at: string }[];
    pending: { id: number; name: string }[];
};

/**
 * Who has seen, received, or not yet received a message: everyone in the
 * conversation except its sender, newest first. Mirrored by
 * messageReceipts() in the mobile app's models.dart.
 */
export function messageReceipts(
    message: MessengerMessage,
    conversation: Conversation,
): MessageReceiptGroups {
    const senderId = message.sender?.id;
    // Nickname first, as in participantDisplayName() (not imported:
    // lib/conversations imports this module).
    const nameFor = (id: number, fallback: string) => {
        const participant = conversation.participants.find(
            (item) => item.id === id,
        );

        return participant?.nickname || participant?.name || fallback;
    };
    const newestFirst = (first: { at: string }, second: { at: string }) =>
        timestamp(second.at) - timestamp(first.at);

    const seen = message.read_by
        .filter((receipt) => receipt.id !== senderId)
        .map((receipt) => ({
            id: receipt.id,
            name: nameFor(receipt.id, receipt.name),
            at: receipt.read_at,
        }))
        .sort(newestFirst);
    const seenIds = new Set(seen.map((person) => person.id));
    const delivered = message.delivered_to
        .filter(
            (receipt) => receipt.id !== senderId && !seenIds.has(receipt.id),
        )
        .map((receipt) => ({
            id: receipt.id,
            name: nameFor(receipt.id, receipt.name),
            at: receipt.delivered_at,
        }))
        .sort(newestFirst);
    const reachedIds = new Set([
        ...seenIds,
        ...delivered.map((person) => person.id),
    ]);
    const pending = conversation.participants
        .filter(
            (participant) =>
                participant.id !== senderId && !reachedIds.has(participant.id),
        )
        .map((participant) => ({
            id: participant.id,
            name: participant.nickname || participant.name,
        }));

    return { seen, delivered, pending };
}
