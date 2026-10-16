import {
    Archive,
    ArchiveRestore,
    Bell,
    BellOff,
    Pin,
    PinOff,
    Search,
    Trash2,
} from 'lucide-react';
import { Avatar } from '@/features/messenger/components/common';
import {
    conversationHasOnlineParticipants,
    conversationStatusLabel,
} from '@/features/messenger/lib/conversations';
import { typingLabel } from '@/features/messenger/lib/format';
import { messagePreview } from '@/features/messenger/lib/messages';
import type {
    Conversation,
    MessengerMessage,
    TypingUser,
} from '@/features/messenger/types';

export function ConversationHeader({
    archived,
    conversation,
    currentUserId,
    onArchive,
    onDeleteArchived,
    onOpenMessageSearch,
    onRestore,
    onToggleMute,
    onTogglePin,
    onlineUserIds,
    typingUsers,
}: {
    archived: boolean;
    conversation: Conversation;
    currentUserId: number;
    onArchive: (conversation: Conversation) => void;
    onDeleteArchived: (conversation: Conversation) => void;
    onOpenMessageSearch: () => void;
    onRestore: (conversation: Conversation) => void;
    onToggleMute: (conversation: Conversation) => void;
    onTogglePin: (conversation: Conversation) => void;
    onlineUserIds: Set<number>;
    typingUsers: TypingUser[];
}) {
    const status = conversationStatusLabel(
        conversation,
        currentUserId,
        onlineUserIds,
    );
    const online = conversationHasOnlineParticipants(
        conversation,
        currentUserId,
        onlineUserIds,
    );

    return (
        <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-4 md:px-6">
            <Avatar
                label={conversation.display_name}
                online={online}
                photoUrl={conversation.photo_url}
                type={conversation.type}
            />
            <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold text-foreground">
                    {conversation.display_name}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {typingUsers.length > 0 ? (
                        <span className="font-medium text-brand">
                            {typingLabel(typingUsers)}
                        </span>
                    ) : (
                        <>
                            <span
                                className={`size-2 rounded-full ${
                                    online ? 'bg-online' : 'bg-muted'
                                }`}
                            />
                            <span>{status}</span>
                        </>
                    )}
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <button
                    aria-label="Search messages"
                    className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    onClick={onOpenMessageSearch}
                    type="button"
                >
                    <Search className="size-4" />
                </button>
                {archived ? (
                    <>
                        <button
                            aria-label="Restore chat"
                            className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-brand"
                            onClick={() => onRestore(conversation)}
                            type="button"
                        >
                            <ArchiveRestore className="size-4" />
                        </button>
                        <button
                            aria-label="Delete permanently"
                            className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                            onClick={() => onDeleteArchived(conversation)}
                            type="button"
                        >
                            <Trash2 className="size-4" />
                        </button>
                    </>
                ) : (
                    <button
                        aria-label="Archive chat"
                        className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        onClick={() => onArchive(conversation)}
                        type="button"
                    >
                        <Archive className="size-4" />
                    </button>
                )}
                <button
                    aria-label={
                        conversation.pinned_at ? 'Unpin chat' : 'Pin chat'
                    }
                    className={`grid size-9 place-items-center rounded-full transition ${
                        conversation.pinned_at
                            ? 'bg-brand/10 text-brand'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                    onClick={() => onTogglePin(conversation)}
                    type="button"
                >
                    {conversation.pinned_at ? (
                        <PinOff className="size-4" />
                    ) : (
                        <Pin className="size-4" />
                    )}
                </button>
                <button
                    aria-label={
                        conversation.muted_at ? 'Unmute chat' : 'Mute chat'
                    }
                    className={`grid size-9 place-items-center rounded-full transition ${
                        conversation.muted_at
                            ? 'bg-muted text-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                    onClick={() => onToggleMute(conversation)}
                    type="button"
                >
                    {conversation.muted_at ? (
                        <BellOff className="size-4" />
                    ) : (
                        <Bell className="size-4" />
                    )}
                </button>
            </div>
        </header>
    );
}

export function PinnedMessageBanner({
    canUnpin,
    message,
    onUnpin,
}: {
    canUnpin: boolean;
    message: MessengerMessage;
    onUnpin: (message: MessengerMessage) => void;
}) {
    return (
        <div className="border-b border-border bg-card px-4 py-3 md:px-6">
            <div className="flex items-center gap-3 rounded-xl border border-brand/20 bg-brand/10 px-3 py-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-card text-brand shadow-sm">
                    <Pin className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-brand">
                        Pinned message
                    </p>
                    <p className="truncate text-sm text-foreground">
                        {messagePreview(message)}
                    </p>
                    {message.pinned_by && (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            Pinned by {message.pinned_by.name}
                        </p>
                    )}
                </div>
                {canUnpin && (
                    <button
                        aria-label="Unpin message"
                        className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-card hover:text-brand"
                        onClick={() => onUnpin(message)}
                        type="button"
                    >
                        <PinOff className="size-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
