import {
    Bell,
    Camera,
    Check,
    FileText,
    ImageIcon,
    Info,
    Link as LinkIcon,
    LogOut,
    Mic,
    Paperclip,
    PencilLine,
    Pin,
    PinOff,
    Search,
    UserMinus,
    UserPlus,
    UsersRound,
    Video,
    X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Avatar, PanelTitle } from '@/features/messenger/components/common';
import { conversationHasOnlineParticipants } from '@/features/messenger/lib/conversations';
import {
    formatFileSize,
    formatTime,
    initials,
    offlineStatusLabel,
} from '@/features/messenger/lib/format';
import { messagePreview } from '@/features/messenger/lib/messages';
import type {
    Contact,
    Conversation,
    MessengerMessage,
    NotificationPreference,
    SharedAttachment,
    SharedContent,
    SharedLink,
} from '@/features/messenger/types';

export function ChatDetails({
    contacts,
    conversation,
    currentUserId,
    loadingPinnedMessages,
    loadingSharedContent,
    onlineUserIds,
    onAddMembers,
    onLeave,
    onNotificationChange,
    onOpenPinnedMessage,
    onRemoveMember,
    onRename,
    onRemovePhoto,
    onUpdateNickname,
    onUpdatePhoto,
    onUnpinPinnedMessage,
    pinnedMessages,
    sharedContent,
}: {
    contacts: Contact[];
    conversation: Conversation;
    currentUserId: number;
    loadingPinnedMessages: boolean;
    loadingSharedContent: boolean;
    onlineUserIds: Set<number>;
    onAddMembers: (
        conversation: Conversation,
        userIds: number[],
    ) => Promise<boolean>;
    onLeave: (conversation: Conversation) => Promise<boolean>;
    onNotificationChange: (
        conversation: Conversation,
        preference: NotificationPreference,
    ) => Promise<boolean>;
    onOpenPinnedMessage: (message: MessengerMessage) => void;
    onRemoveMember: (
        conversation: Conversation,
        userId: number,
    ) => Promise<boolean>;
    onRename: (conversation: Conversation, title: string) => Promise<boolean>;
    onRemovePhoto: (conversation: Conversation) => Promise<boolean>;
    onUpdateNickname: (
        conversation: Conversation,
        userId: number,
        nickname: string | null,
    ) => Promise<boolean>;
    onUpdatePhoto: (
        conversation: Conversation,
        photo: File,
    ) => Promise<boolean>;
    onUnpinPinnedMessage: (message: MessengerMessage) => void;
    pinnedMessages: MessengerMessage[];
    sharedContent: SharedContent;
}) {
    const [activeTab, setActiveTab] = useState<'media' | 'links' | 'files'>(
        'media',
    );
    const [title, setTitle] = useState(conversation.title ?? '');
    const [addingMembers, setAddingMembers] = useState(false);
    const [savingTitle, setSavingTitle] = useState(false);
    const [savingPreference, setSavingPreference] = useState(false);
    const photoInputRef = useRef<HTMLInputElement | null>(null);
    const addableContacts = contacts.filter(
        (contact) =>
            !conversation.participants.some(
                (participant) => participant.id === contact.id,
            ),
    );
    const tabs = [
        {
            id: 'media',
            label: 'Media',
            count: sharedContent.media.length,
        },
        {
            id: 'links',
            label: 'Links',
            count: sharedContent.links.length,
        },
        {
            id: 'files',
            label: 'Files',
            count: sharedContent.files.length,
        },
    ] as const;

    const saveTitle = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (
            !title.trim() ||
            title.trim() === conversation.title ||
            savingTitle
        ) {
            return;
        }

        setSavingTitle(true);

        try {
            await onRename(conversation, title.trim());
        } finally {
            setSavingTitle(false);
        }
    };

    const updatePreference = async (preference: NotificationPreference) => {
        setSavingPreference(true);

        try {
            await onNotificationChange(conversation, preference);
        } finally {
            setSavingPreference(false);
        }
    };

    return (
        <>
            <div className="flex flex-col items-center text-center">
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
                <h2 className="mt-3 max-w-full truncate text-base font-semibold text-foreground">
                    {conversation.display_name}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                    {conversation.type === 'direct'
                        ? 'Direct message'
                        : 'Group chat'}
                </p>
                {conversation.type === 'group' &&
                    conversation.permissions.can_customize_group && (
                        <div className="mt-3 flex items-center gap-2">
                            <input
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                className="sr-only"
                                onChange={(event) => {
                                    const photo = event.target.files?.[0];

                                    if (photo) {
                                        void onUpdatePhoto(conversation, photo);
                                    }

                                    event.target.value = '';
                                }}
                                ref={photoInputRef}
                                type="file"
                            />
                            <button
                                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:text-brand"
                                onClick={() => photoInputRef.current?.click()}
                                type="button"
                            >
                                <Camera className="size-3.5" />
                                {conversation.photo_url
                                    ? 'Change photo'
                                    : 'Add photo'}
                            </button>
                            {conversation.photo_url && (
                                <button
                                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                    onClick={() =>
                                        void onRemovePhoto(conversation)
                                    }
                                    type="button"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    )}

                <div className="mt-6 w-full text-left">
                    <PanelTitle
                        icon={<Bell className="size-4" />}
                        title="Notifications"
                    />
                    <div className="mt-3 grid grid-cols-3 rounded-xl bg-muted p-1">
                        {(['all', 'mentions', 'muted'] as const).map(
                            (preference) => (
                                <button
                                    className={`rounded-lg px-2 py-2 text-xs font-semibold capitalize transition ${
                                        conversation.notification_preference ===
                                        preference
                                            ? 'bg-card text-brand shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    disabled={savingPreference}
                                    key={preference}
                                    onClick={() => updatePreference(preference)}
                                    type="button"
                                >
                                    {preference}
                                </button>
                            ),
                        )}
                    </div>
                </div>

                <div className="mt-6 w-full text-left">
                    <PanelTitle
                        icon={<Pin className="size-4" />}
                        title="Pinned Messages"
                    />
                    <PinnedMessagesList
                        canUnpin={conversation.permissions.can_pin_messages}
                        loading={loadingPinnedMessages}
                        messages={pinnedMessages}
                        onOpen={onOpenPinnedMessage}
                        onUnpin={onUnpinPinnedMessage}
                    />
                </div>

                <div className="mt-6 w-full text-left">
                    <PanelTitle
                        icon={<Paperclip className="size-4" />}
                        title="Media, Links and Files"
                    />
                    <div className="mt-3 grid grid-cols-3 rounded-xl bg-muted p-1">
                        {tabs.map((tab) => (
                            <button
                                className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                                    activeTab === tab.id
                                        ? 'bg-card text-brand shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                type="button"
                            >
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className="ml-1 text-[10px] text-muted-foreground">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="mt-3 min-h-40">
                        {loadingSharedContent ? (
                            <SharedContentEmpty
                                icon={<Info className="size-5" />}
                                title="Loading"
                            />
                        ) : activeTab === 'media' ? (
                            <SharedMediaGrid media={sharedContent.media} />
                        ) : activeTab === 'links' ? (
                            <SharedLinksList links={sharedContent.links} />
                        ) : (
                            <SharedFilesList files={sharedContent.files} />
                        )}
                    </div>
                </div>

                {conversation.type === 'group' && (
                    <div className="mt-6 w-full text-left">
                        <PanelTitle
                            icon={<Info className="size-4" />}
                            title="Group"
                        />
                        {conversation.permissions.can_rename && (
                            <form
                                className="mt-3 flex gap-2"
                                onSubmit={saveTitle}
                            >
                                <input
                                    className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand"
                                    onChange={(event) =>
                                        setTitle(event.target.value)
                                    }
                                    placeholder="Group name"
                                    value={title}
                                />
                                <button
                                    className="rounded-lg bg-brand-solid px-3 py-2 text-xs font-semibold text-brand-foreground disabled:bg-muted disabled:text-muted-foreground"
                                    disabled={
                                        savingTitle ||
                                        !title.trim() ||
                                        title.trim() === conversation.title
                                    }
                                    type="submit"
                                >
                                    Save
                                </button>
                            </form>
                        )}

                        {conversation.permissions.can_add_members &&
                            addableContacts.length > 0 && (
                                <button
                                    className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                                    onClick={() => setAddingMembers(true)}
                                    type="button"
                                >
                                    <UserPlus className="size-4" />
                                    Add members
                                </button>
                            )}

                        <button
                            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40"
                            onClick={() => onLeave(conversation)}
                            type="button"
                        >
                            <LogOut className="size-4" />
                            Leave group
                        </button>
                    </div>
                )}

                <div className="mt-6 w-full text-left">
                    <PanelTitle
                        icon={<UsersRound className="size-4" />}
                        title="People"
                    />
                    <div className="mt-3 space-y-2">
                        {conversation.participants.map((participant) => (
                            <div
                                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40"
                                key={participant.id}
                            >
                                <span className="relative grid size-9 place-items-center rounded-full bg-muted text-xs font-bold text-foreground">
                                    {initials(participant.name)}
                                    {onlineUserIds.has(participant.id) && (
                                        <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-card bg-online" />
                                    )}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-foreground">
                                        {participant.nickname ||
                                            participant.name}
                                        {participant.id === currentUserId
                                            ? ' (You)'
                                            : ''}
                                    </p>
                                    {participant.nickname && (
                                        <p className="truncate text-[11px] text-muted-foreground">
                                            {participant.name}
                                        </p>
                                    )}
                                    <p
                                        className={`truncate text-xs ${
                                            onlineUserIds.has(participant.id)
                                                ? 'font-medium text-online'
                                                : 'text-muted-foreground capitalize'
                                        }`}
                                    >
                                        {onlineUserIds.has(participant.id)
                                            ? 'Active now'
                                            : offlineStatusLabel(
                                                  participant.last_seen_at,
                                              )}
                                    </p>
                                </div>
                                <div className="ml-auto flex shrink-0 items-center gap-1">
                                    {conversation.permissions
                                        .can_customize_group && (
                                        <button
                                            aria-label={`Edit ${participant.name}'s nickname`}
                                            className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-brand"
                                            onClick={() => {
                                                const nickname = window.prompt(
                                                    `Nickname for ${participant.name}`,
                                                    participant.nickname ?? '',
                                                );

                                                if (nickname !== null) {
                                                    void onUpdateNickname(
                                                        conversation,
                                                        participant.id,
                                                        nickname.trim() || null,
                                                    );
                                                }
                                            }}
                                            type="button"
                                        >
                                            <PencilLine className="size-4" />
                                        </button>
                                    )}
                                    {conversation.permissions
                                        .can_remove_members &&
                                        participant.id !== currentUserId && (
                                            <button
                                                aria-label={`Remove ${participant.name}`}
                                                className="ml-auto grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                                                onClick={() =>
                                                    onRemoveMember(
                                                        conversation,
                                                        participant.id,
                                                    )
                                                }
                                                type="button"
                                            >
                                                <UserMinus className="size-4" />
                                            </button>
                                        )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {addingMembers && (
                <AddMembersDialog
                    contacts={addableContacts}
                    conversation={conversation}
                    onAddMembers={onAddMembers}
                    onClose={() => setAddingMembers(false)}
                />
            )}
        </>
    );
}

export function AddMembersDialog({
    contacts,
    conversation,
    onAddMembers,
    onClose,
}: {
    contacts: Contact[];
    conversation: Conversation;
    onAddMembers: (
        conversation: Conversation,
        userIds: number[],
    ) => Promise<boolean>;
    onClose: () => void;
}) {
    const [query, setQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const filteredContacts = contacts.filter((contact) => {
        const haystack = `${contact.name} ${contact.email} ${contact.school_role}`;

        return haystack.toLowerCase().includes(query.toLowerCase());
    });
    const canSubmit = selectedIds.length > 0 && !submitting;

    const toggleContact = (contactId: number) => {
        setError(null);
        setSelectedIds((ids) =>
            ids.includes(contactId)
                ? ids.filter((id) => id !== contactId)
                : [...ids, contactId],
        );
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canSubmit) {
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const added = await onAddMembers(conversation, selectedIds);

            if (added) {
                onClose();

                return;
            }

            setError('Could not add those members.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 py-6 backdrop-blur-sm">
            <form
                className="flex max-h-[min(620px,calc(100vh-3rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
                onSubmit={submit}
            >
                <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                    <h2 className="text-base font-semibold text-foreground">
                        Add members
                    </h2>
                    <button
                        aria-label="Close"
                        className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                <div className="shrink-0 border-b border-border p-4">
                    <label className="flex h-11 items-center gap-2 rounded-xl bg-muted px-3 text-muted-foreground">
                        <Search className="size-4" />
                        <input
                            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search people"
                            type="search"
                            value={query}
                        />
                    </label>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {filteredContacts.length > 0 ? (
                        filteredContacts.map((contact) => {
                            const selected = selectedIds.includes(contact.id);

                            return (
                                <button
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-muted/40"
                                    key={contact.id}
                                    onClick={() => toggleContact(contact.id)}
                                    type="button"
                                >
                                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold text-foreground ring-1 ring-border">
                                        {initials(contact.name)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-foreground">
                                            {contact.name}
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground capitalize">
                                            {contact.school_role}
                                        </span>
                                    </span>
                                    <span
                                        className={`grid size-6 shrink-0 place-items-center rounded-full border ${
                                            selected
                                                ? 'border-brand bg-brand-solid text-brand-foreground'
                                                : 'border-border text-transparent'
                                        }`}
                                    >
                                        <Check className="size-4" />
                                    </span>
                                </button>
                            );
                        })
                    ) : (
                        <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                            <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                                <UsersRound className="size-6" />
                            </span>
                            <h3 className="mt-3 text-sm font-semibold text-foreground">
                                No people found
                            </h3>
                        </div>
                    )}
                </div>

                <div className="shrink-0 border-t border-border p-4">
                    {error && (
                        <p className="mb-3 text-sm font-medium text-rose-600 dark:text-rose-400">
                            {error}
                        </p>
                    )}
                    <button
                        className="h-11 w-full rounded-xl bg-brand-solid px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-solid/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                        disabled={!canSubmit}
                        type="submit"
                    >
                        {submitting ? 'Adding...' : 'Add members'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export function SharedMediaGrid({ media }: { media: SharedAttachment[] }) {
    if (media.length === 0) {
        return (
            <SharedContentEmpty
                icon={<ImageIcon className="size-5" />}
                title="No media yet"
            />
        );
    }

    return (
        <div className="grid grid-cols-3 gap-2">
            {media.map((item) => {
                const mimeType = item.mime_type ?? '';
                const isImage = mimeType.startsWith('image/');
                const isVideo = mimeType.startsWith('video/');

                return (
                    <a
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                        href={item.preview_url ?? item.url}
                        key={item.id}
                        rel="noreferrer"
                        target="_blank"
                        title={item.name}
                    >
                        {isImage && item.preview_url ? (
                            <img
                                alt={item.name}
                                className="size-full object-cover transition group-hover:scale-105"
                                loading="lazy"
                                src={item.preview_url}
                            />
                        ) : (
                            <span className="grid size-full place-items-center text-brand">
                                {isVideo ? (
                                    <Video className="size-6" />
                                ) : (
                                    <Mic className="size-6" />
                                )}
                            </span>
                        )}
                    </a>
                );
            })}
        </div>
    );
}

export function SharedLinksList({ links }: { links: SharedLink[] }) {
    if (links.length === 0) {
        return (
            <SharedContentEmpty
                icon={<LinkIcon className="size-5" />}
                title="No links yet"
            />
        );
    }

    return (
        <div className="space-y-2">
            {links.map((link) => (
                <a
                    className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 transition hover:border-brand hover:bg-brand/10"
                    href={link.url}
                    key={`${link.message_id}-${link.url}`}
                    rel="noreferrer"
                    target="_blank"
                >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                        <LinkIcon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                            {link.host}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                            {link.url}
                        </span>
                    </span>
                </a>
            ))}
        </div>
    );
}

export function SharedFilesList({ files }: { files: SharedAttachment[] }) {
    if (files.length === 0) {
        return (
            <SharedContentEmpty
                icon={<FileText className="size-5" />}
                title="No files yet"
            />
        );
    }

    return (
        <div className="space-y-2">
            {files.map((file) => (
                <a
                    className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 transition hover:border-brand hover:bg-brand/10"
                    href={file.url}
                    key={file.id}
                    rel="noreferrer"
                    target="_blank"
                >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-brand">
                        <FileText className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                            {file.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                        </span>
                    </span>
                </a>
            ))}
        </div>
    );
}

export function PinnedMessagesList({
    canUnpin,
    loading,
    messages,
    onOpen,
    onUnpin,
}: {
    canUnpin: boolean;
    loading: boolean;
    messages: MessengerMessage[];
    onOpen: (message: MessengerMessage) => void;
    onUnpin: (message: MessengerMessage) => void;
}) {
    if (loading) {
        return (
            <div className="mt-3">
                <SharedContentEmpty
                    icon={<Info className="size-5" />}
                    title="Loading pinned messages"
                />
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="mt-3">
                <SharedContentEmpty
                    icon={<Pin className="size-5" />}
                    title="No pinned messages yet"
                />
            </div>
        );
    }

    return (
        <div className="mt-3 space-y-2">
            {messages.map((message) => (
                <div
                    className="group flex min-w-0 items-start gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition hover:border-brand hover:bg-brand/10"
                    key={message.id}
                >
                    <button
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        onClick={() => onOpen(message)}
                        type="button"
                    >
                        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                            <Pin className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-muted-foreground">
                                {message.sender?.name ?? 'System'} ·{' '}
                                {formatTime(message.pinned_at)}
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-sm leading-5 font-medium text-foreground">
                                {messagePreview(message)}
                            </span>
                            {message.pinned_by && (
                                <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                                    Pinned by {message.pinned_by.name}
                                </span>
                            )}
                        </span>
                    </button>
                    {canUnpin && (
                        <button
                            aria-label="Unpin message"
                            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground opacity-100 transition hover:bg-card hover:text-brand md:opacity-0 md:group-hover:opacity-100"
                            onClick={() => onUnpin(message)}
                            type="button"
                        >
                            <PinOff className="size-4" />
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}

export function SharedContentEmpty({
    icon,
    title,
}: {
    icon: React.ReactNode;
    title: string;
}) {
    return (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 px-3 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-card text-muted-foreground">
                {icon}
            </span>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
                {title}
            </p>
        </div>
    );
}
