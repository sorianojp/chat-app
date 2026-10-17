import { ArrowDown, MessageCircle, Search } from 'lucide-react';
import type { ComponentProps, RefObject } from 'react';
import { EmptyState } from '@/features/messenger/components/common';
import {
    MessageBubble,
    TypingIndicator,
} from '@/features/messenger/components/message-bubble';
import { PendingMessage } from '@/features/messenger/components/pending-message';
import type { PendingOutgoingMessage } from '@/features/messenger/components/pending-message';
import { messageDeliveryStatus } from '@/features/messenger/lib/messages';
import type {
    Conversation,
    MessengerMessage,
    TypingUser,
} from '@/features/messenger/types';

export type MessageActions = Pick<
    ComponentProps<typeof MessageBubble>,
    | 'onEdit'
    | 'onForward'
    | 'onPin'
    | 'onReact'
    | 'onReply'
    | 'onRsvp'
    | 'onUnsend'
    | 'onVote'
>;

/** Scrollable message list: messages, unread divider, pending sends, typing and jump-to-latest. */
export function MessageTimeline({
    conversation,
    currentUserId,
    messages,
    pendingMessages,
    typingUsers,
    searchOpen,
    searchTerm,
    searching,
    highlightedMessageId,
    firstUnreadMessageId,
    unreadCount,
    showDeliveryStatus,
    seenMessageId,
    deliveredMessageId,
    latestOwnMessageId,
    viewportRef,
    messageRefs,
    unreadMarkerRef,
    onScroll,
    showJumpToLatest,
    onJumpToLatest,
    messageActions,
    onRetryPending,
    onDiscardPending,
}: {
    conversation: Conversation;
    currentUserId: number;
    messages: MessengerMessage[];
    pendingMessages: PendingOutgoingMessage[];
    typingUsers: TypingUser[];
    searchOpen: boolean;
    searchTerm: string;
    searching: boolean;
    highlightedMessageId: number | null;
    firstUnreadMessageId: number | null;
    unreadCount: number | undefined;
    showDeliveryStatus: boolean;
    seenMessageId: number | null;
    deliveredMessageId: number | null;
    latestOwnMessageId: number | null;
    viewportRef: RefObject<HTMLDivElement | null>;
    messageRefs: RefObject<Record<number, HTMLDivElement | null>>;
    unreadMarkerRef: RefObject<HTMLDivElement | null>;
    onScroll: () => void;
    showJumpToLatest: boolean;
    onJumpToLatest: () => void;
    messageActions: MessageActions;
    onRetryPending: (message: PendingOutgoingMessage) => void;
    onDiscardPending: (clientId: string) => void;
}) {
    return (
        <div className="relative min-h-0 flex-1">
            <div
                className="h-full space-y-4 overflow-x-hidden overflow-y-auto bg-background px-4 py-5 md:px-6"
                onScroll={onScroll}
                data-testid="message-thread"
                ref={viewportRef}
            >
                {messages.length > 0 ||
                (!searchTerm && pendingMessages.length > 0) ? (
                    messages.map((message) => (
                        <div
                            className={`rounded-2xl transition ${
                                highlightedMessageId === message.id
                                    ? 'bg-brand/15 ring-2 ring-brand/30'
                                    : ''
                            }`}
                            key={message.id}
                            ref={(element) => {
                                messageRefs.current[message.id] = element;
                            }}
                        >
                            {message.id === firstUnreadMessageId &&
                                !searchTerm && (
                                    <div
                                        className="mb-4 flex items-center gap-3 text-xs font-semibold text-brand"
                                        ref={unreadMarkerRef}
                                    >
                                        <span className="h-px flex-1 bg-brand/30" />
                                        <span>
                                            {unreadCount} unread{' '}
                                            {unreadCount === 1
                                                ? 'message'
                                                : 'messages'}
                                        </span>
                                        <span className="h-px flex-1 bg-brand/30" />
                                    </div>
                                )}
                            <MessageBubble
                                {...messageActions}
                                canPin={
                                    conversation.permissions.can_pin_messages
                                }
                                currentUserId={currentUserId}
                                conversation={conversation}
                                deliveryStatus={messageDeliveryStatus(
                                    message,
                                    currentUserId,
                                    showDeliveryStatus,
                                    message.id === seenMessageId,
                                    message.id === deliveredMessageId,
                                    message.id === latestOwnMessageId,
                                )}
                                message={message}
                            />
                        </div>
                    ))
                ) : searching ? (
                    <EmptyState
                        icon={<Search className="size-6" />}
                        title="Searching messages"
                        body="Looking through this conversation."
                    />
                ) : searchOpen && searchTerm ? (
                    <EmptyState
                        icon={<Search className="size-6" />}
                        title="No messages found"
                        body="Try another word or file name."
                    />
                ) : (
                    <EmptyState
                        icon={<MessageCircle className="size-6" />}
                        title="No messages yet"
                        body="Send the first message in this conversation."
                    />
                )}
                {!searchTerm &&
                    pendingMessages.map((message) => (
                        <PendingMessage
                            key={message.clientId}
                            message={message}
                            onDiscard={onDiscardPending}
                            onRetry={onRetryPending}
                        />
                    ))}
                {typingUsers.length > 0 && !searchTerm && (
                    <TypingIndicator users={typingUsers} />
                )}
            </div>
            {showJumpToLatest && !searchTerm && (
                <button
                    aria-label="Jump to latest message"
                    className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-lg transition hover:bg-muted"
                    onClick={onJumpToLatest}
                    type="button"
                >
                    <ArrowDown className="size-4" />
                    Jump to latest
                </button>
            )}
        </div>
    );
}
