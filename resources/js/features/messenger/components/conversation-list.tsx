import {
    Archive,
    Bell,
    BellOff,
    MessageCircle,
    Pin,
    Search,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { Avatar, EmptyState } from '@/features/messenger/components/common';
import {
    conversationHasOnlineParticipants,
    conversationPreview,
    conversationStatusLabel,
} from '@/features/messenger/lib/conversations';
import { typingLabel } from '@/features/messenger/lib/format';
import type { Conversation, TypingUser } from '@/features/messenger/types';
import type { useBrowserNotifications } from '@/features/messenger/use-browser-notifications';

type BrowserNotifications = ReturnType<typeof useBrowserNotifications>;

type InboxFilter = 'all' | 'unread' | 'groups';

const INBOX_FILTERS: { value: InboxFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'unread', label: 'Unread' },
    { value: 'groups', label: 'Groups' },
];

/** Left column: chat search, browser alert toggle and the conversation list. */
export function ConversationList({
    archived,
    search,
    onSearchChange,
    showBrowserAlerts,
    browserNotifications,
    webPushPublicKey,
    conversations,
    activeConversationId,
    hasActiveConversation,
    typingUsersByConversation,
    draftsByConversation,
    currentUserId,
    onlineUserIds,
    onSelectConversation,
}: {
    archived: boolean;
    search: string;
    onSearchChange: (value: string) => void;
    showBrowserAlerts: boolean;
    browserNotifications: BrowserNotifications;
    webPushPublicKey: string | null;
    conversations: Conversation[];
    activeConversationId: number | null;
    hasActiveConversation: boolean;
    typingUsersByConversation: Record<number, Record<number, TypingUser>>;
    draftsByConversation: Record<number, string>;
    currentUserId: number;
    onlineUserIds: Set<number>;
    onSelectConversation: (conversationId: number) => void;
}) {
    const [filter, setFilter] = useState<InboxFilter>('all');
    const activeFilter = archived ? 'all' : filter;
    const visibleConversations = conversations.filter(
        (conversation) =>
            (activeFilter !== 'unread' || conversation.unread_count > 0) &&
            (activeFilter !== 'groups' || conversation.type !== 'direct'),
    );
    const [alertsDismissed, setAlertsDismissedState] =
        useState(readAlertsDismissed);
    const setAlertsDismissed = (dismissed: boolean) => {
        setAlertsDismissedState(dismissed);
        writeAlertsDismissed(dismissed);
    };

    return (
        <aside
            className={`min-h-0 flex-col border-r border-border bg-card lg:flex ${hasActiveConversation ? 'hidden' : 'flex'}`}
        >
            <div className="border-b border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground">
                        {archived ? 'Archives' : 'Chats'}
                    </h2>
                    {showBrowserAlerts && alertsDismissed && (
                        <button
                            aria-label="Show browser alerts settings"
                            className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            onClick={() => setAlertsDismissed(false)}
                            title="Browser alerts"
                            type="button"
                        >
                            <Bell className="size-4" />
                        </button>
                    )}
                </div>
                <label className="flex h-11 items-center gap-2 rounded-xl bg-secondary/70 px-3 text-muted-foreground transition focus-within:bg-card focus-within:ring-4 focus-within:ring-ring/20">
                    <Search className="size-4" />
                    <input
                        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Search conversations"
                        type="search"
                        value={search}
                    />
                </label>
                {!archived && (
                    // Same filters as the mobile app's inbox.
                    <div
                        aria-label="Filter conversations"
                        className="mt-3 flex gap-2"
                        role="group"
                    >
                        {INBOX_FILTERS.map(({ value, label }) => (
                            <button
                                aria-pressed={filter === value}
                                className={`rounded-full px-3 py-1.5 text-xs transition ${
                                    filter === value
                                        ? 'bg-brand/15 font-bold text-brand'
                                        : 'bg-muted font-semibold text-foreground hover:bg-muted/70'
                                }`}
                                key={value}
                                onClick={() => setFilter(value)}
                                type="button"
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
                {showBrowserAlerts && !alertsDismissed && (
                    <BrowserAlertsCard
                        notifications={browserNotifications}
                        onDismiss={() => setAlertsDismissed(true)}
                        webPushAvailable={Boolean(webPushPublicKey)}
                    />
                )}
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {visibleConversations.length > 0 ? (
                    visibleConversations.map((conversation) => (
                        <ConversationListItem
                            active={conversation.id === activeConversationId}
                            conversation={conversation}
                            currentUserId={currentUserId}
                            draft={draftsByConversation[conversation.id]}
                            key={conversation.id}
                            onlineUserIds={onlineUserIds}
                            onSelect={onSelectConversation}
                            typingUsers={Object.values(
                                typingUsersByConversation[conversation.id] ??
                                    {},
                            )}
                        />
                    ))
                ) : (
                    <EmptyState
                        icon={
                            archived ? (
                                <Archive className="size-6" />
                            ) : (
                                <MessageCircle className="size-6" />
                            )
                        }
                        title={
                            archived
                                ? 'No archived chats'
                                : activeFilter === 'unread'
                                  ? 'You’re all caught up'
                                  : activeFilter === 'groups'
                                    ? 'No group chats'
                                    : 'No conversations'
                        }
                        body={
                            archived
                                ? 'Archived chats will appear here.'
                                : activeFilter === 'unread'
                                  ? 'Unread conversations will appear here.'
                                  : 'Start a direct message or create a group chat.'
                        }
                    />
                )}
            </div>
        </aside>
    );
}

const ALERTS_DISMISSED_KEY = 'uhoo:browser-alerts-dismissed';

function readAlertsDismissed() {
    try {
        return (
            typeof window !== 'undefined' &&
            window.localStorage.getItem(ALERTS_DISMISSED_KEY) === '1'
        );
    } catch {
        return false;
    }
}

function writeAlertsDismissed(dismissed: boolean) {
    try {
        if (dismissed) {
            window.localStorage.setItem(ALERTS_DISMISSED_KEY, '1');
        } else {
            window.localStorage.removeItem(ALERTS_DISMISSED_KEY);
        }
    } catch {
        // Private browsing or blocked storage: the choice just won't persist.
    }
}

function BrowserAlertsCard({
    notifications,
    webPushAvailable,
    onDismiss,
}: {
    notifications: BrowserNotifications;
    webPushAvailable: boolean;
    onDismiss: () => void;
}) {
    return (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
            <Bell className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground">
                    Browser alerts
                </p>
                <p className="text-[11px] leading-4 text-muted-foreground">
                    {notifications.permission === 'unsupported'
                        ? 'Unavailable in this browser or connection.'
                        : notifications.permission === 'denied'
                          ? 'Blocked in browser settings.'
                          : notifications.enabled
                            ? notifications.backgroundEnabled
                                ? 'On—even when the app is closed.'
                                : 'On while Messenger is open.'
                            : webPushAvailable
                              ? 'Get alerts even when the app is closed.'
                              : 'Get alerts when this tab is not in focus.'}
                </p>
                {notifications.error && (
                    <p
                        className="mt-1 text-[11px] text-destructive"
                        role="alert"
                    >
                        {notifications.error}
                    </p>
                )}
                {notifications.warning && (
                    <p
                        className="mt-1 text-[11px] text-muted-foreground"
                        role="status"
                    >
                        {notifications.warning}
                    </p>
                )}
            </div>
            <button
                aria-label={`${notifications.enabled ? 'Disable' : 'Enable'} browser alerts`}
                aria-pressed={
                    notifications.enabled &&
                    notifications.permission === 'granted'
                }
                className="shrink-0 rounded-lg bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground ring-1 ring-border transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                    notifications.permission === 'unsupported' ||
                    notifications.permission === 'denied'
                }
                onClick={() => void notifications.toggle()}
                type="button"
            >
                {notifications.enabled && notifications.permission === 'granted'
                    ? 'On'
                    : 'Enable'}
            </button>
            <button
                aria-label="Hide browser alerts"
                className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={onDismiss}
                type="button"
            >
                <X className="size-3.5" />
            </button>
        </div>
    );
}

function ConversationListItem({
    conversation,
    active,
    typingUsers,
    draft,
    currentUserId,
    onlineUserIds,
    onSelect,
}: {
    conversation: Conversation;
    active: boolean;
    typingUsers: TypingUser[];
    draft: string | undefined;
    currentUserId: number;
    onlineUserIds: Set<number>;
    onSelect: (conversationId: number) => void;
}) {
    return (
        <button
            className={`flex w-full gap-3 rounded-xl px-3 py-3 text-left transition ${
                active
                    ? 'bg-brand/10 ring-1 ring-brand/20'
                    : 'bg-card hover:bg-muted'
            }`}
            onClick={() => onSelect(conversation.id)}
            type="button"
        >
            <Avatar
                label={conversation.display_name}
                online={conversationHasOnlineParticipants(
                    conversation,
                    currentUserId,
                    onlineUserIds,
                )}
                photoUrl={conversation.photo_url}
                type={conversation.type}
            />
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-foreground">
                        {conversation.display_name}
                    </p>
                    <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                        {conversation.pinned_at && (
                            <Pin className="size-3.5 text-brand" />
                        )}
                        {conversation.muted_at && (
                            <BellOff className="size-3.5" />
                        )}
                    </span>
                    {conversation.unread_count > 0 && (
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-solid text-[10px] font-bold text-brand-foreground">
                            {conversation.unread_count}
                        </span>
                    )}
                    {conversation.unread_mentions_count > 0 && (
                        <span className="grid size-5 shrink-0 place-items-center rounded-full border border-foreground/15 bg-muted text-[11px] font-bold text-foreground">
                            @
                        </span>
                    )}
                </div>
                <p
                    className={`mt-1 truncate text-xs ${
                        typingUsers.length > 0
                            ? 'font-medium text-brand'
                            : 'text-muted-foreground'
                    }`}
                >
                    {typingUsers.length > 0
                        ? typingLabel(typingUsers)
                        : draft
                          ? `Draft: ${draft.trim()}`
                          : conversationPreview(conversation.latest_message)}
                </p>
                <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                    {conversationStatusLabel(
                        conversation,
                        currentUserId,
                        onlineUserIds,
                    )}
                </p>
            </div>
        </button>
    );
}
