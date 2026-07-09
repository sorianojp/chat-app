import { Head, usePage } from '@inertiajs/react';
import { echo } from '@laravel/echo-react';
import {
    CheckCheck,
    Check,
    FileText,
    Info,
    MessageCircle,
    Paperclip,
    PencilLine,
    Search,
    Send,
    UsersRound,
    X,
} from 'lucide-react';
import {
    FormEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { User } from '@/types';

type Participant = {
    id: number;
    name: string;
    email: string;
    school_role: string;
};

type Contact = Participant;

type Conversation = {
    id: number;
    type: 'direct' | 'group' | 'announcement';
    title: string | null;
    display_name: string;
    school_class: {
        id: number;
        name: string;
    } | null;
    participants: Participant[];
    latest_message: MessengerMessage | null;
    messages_count: number;
    unread_count: number;
    last_message_at: string | null;
};

type MessengerMessage = {
    id: number;
    conversation_id: number;
    sender: {
        id: number;
        name: string;
        school_role: string;
    } | null;
    type: string;
    body: string;
    metadata: Record<string, unknown> | null;
    attachments: MessageAttachment[];
    created_at: string | null;
};

type MessageAttachment = {
    id: number;
    name: string;
    mime_type: string | null;
    size: number;
    url: string;
};

type Props = {
    apiBaseUrl: string;
    workspace: {
        id: number;
        name: string;
        slug: string;
    };
    contacts: Contact[];
    conversations: Conversation[];
    initialMessages: MessengerMessage[];
};

type MessageCreatedPayload = {
    message: MessengerMessage;
};

type NewConversationPayload = {
    type: 'direct' | 'group';
    title: string | null;
    participant_ids: number[];
};

export default function Messenger({
    apiBaseUrl,
    contacts,
    conversations: initialConversations,
    initialMessages,
    workspace,
}: Props) {
    const { auth } = usePage<{ auth: { user: User } }>().props;
    const initialConversationId =
        getConversationIdFromUrl(initialConversations);
    const [conversations, setConversations] = useState(initialConversations);
    const [activeConversationId, setActiveConversationId] = useState<
        number | null
    >(initialConversationId);
    const [messagesByConversation, setMessagesByConversation] = useState<
        Record<number, MessengerMessage[]>
    >(() =>
        activeConversationId
            ? {
                  [activeConversationId]: initialMessages,
              }
            : {},
    );
    const [messageBody, setMessageBody] = useState('');
    const [search, setSearch] = useState('');
    const [sending, setSending] = useState(false);
    const [composerOpen, setComposerOpen] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const activeConversationIdRef = useRef(activeConversationId);
    const currentUserIdRef = useRef(auth.user.id);
    const seenMessageIdsRef = useRef(
        new Set(initialMessages.map((message) => message.id)),
    );
    const loadedConversationIdsRef = useRef(
        new Set(
            initialConversationId && initialMessages.length > 0
                ? [initialConversationId]
                : [],
        ),
    );

    const activeConversation = useMemo(
        () =>
            conversations.find(
                (conversation) => conversation.id === activeConversationId,
            ) ?? null,
        [activeConversationId, conversations],
    );
    const activeMessages = activeConversationId
        ? (messagesByConversation[activeConversationId] ?? [])
        : [];
    const filteredConversations = conversations.filter((conversation) =>
        conversation.display_name.toLowerCase().includes(search.toLowerCase()),
    );
    const conversationIdsKey = useMemo(
        () =>
            conversations
                .map((conversation) => conversation.id)
                .sort((first, second) => first - second)
                .join(','),
        [conversations],
    );

    const appendMessage = useCallback((message: MessengerMessage) => {
        const isActive =
            message.conversation_id === activeConversationIdRef.current;
        const isMine = message.sender?.id === currentUserIdRef.current;
        const wasAlreadyLoaded = seenMessageIdsRef.current.has(message.id);

        if (!wasAlreadyLoaded) {
            seenMessageIdsRef.current.add(message.id);
        }

        setMessagesByConversation((messages) => {
            const existingMessages = messages[message.conversation_id] ?? [];

            if (wasAlreadyLoaded) {
                return messages;
            }

            return {
                ...messages,
                [message.conversation_id]: [...existingMessages, message],
            };
        });

        setConversations((items) =>
            items.map((conversation) =>
                conversation.id === message.conversation_id
                    ? {
                          ...conversation,
                          latest_message: message,
                          last_message_at: message.created_at,
                          unread_count:
                              isActive || isMine || wasAlreadyLoaded
                                  ? 0
                                  : conversation.unread_count + 1,
                      }
                    : conversation,
            ),
        );
    }, []);

    const selectConversation = (conversationId: number) => {
        setActiveConversationId(conversationId);
        window.history.replaceState(
            {},
            '',
            `${window.location.pathname}?conversation=${conversationId}`,
        );
    };

    const createConversation = async (payload: NewConversationPayload) => {
        const response = await fetch(`${apiBaseUrl}/conversations`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            return false;
        }

        const created = (await response.json()) as { data: Conversation };
        const conversation = created.data;

        setConversations((items) => [
            conversation,
            ...items.filter((item) => item.id !== conversation.id),
        ]);
        setMessagesByConversation((messages) => ({
            ...messages,
            [conversation.id]: [],
        }));
        loadedConversationIdsRef.current.add(conversation.id);
        selectConversation(conversation.id);

        return true;
    };

    useEffect(() => {
        activeConversationIdRef.current = activeConversationId;
    }, [activeConversationId]);

    useEffect(() => {
        const conversationIds = conversationIdsKey
            .split(',')
            .filter(Boolean)
            .map((conversationId) => Number(conversationId));

        if (conversationIds.length === 0) {
            return;
        }

        conversationIds.forEach((conversationId) => {
            echo()
                .private(`conversations.${conversationId}`)
                .listen(
                    '.message.created',
                    (payload: MessageCreatedPayload) => {
                        appendMessage(payload.message);
                    },
                );
        });

        return () => {
            conversationIds.forEach((conversationId) => {
                echo().leave(`conversations.${conversationId}`);
            });
        };
    }, [appendMessage, conversationIdsKey]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeConversationId, activeMessages.length]);

    useEffect(() => {
        if (!activeConversationId) {
            return;
        }

        void markConversationRead(activeConversationId);
    }, [activeConversationId, activeMessages.length]);

    useEffect(() => {
        if (
            !activeConversationId ||
            loadedConversationIdsRef.current.has(activeConversationId)
        ) {
            return;
        }

        void fetchMessages(activeConversationId);
    }, [activeConversationId, apiBaseUrl]);

    const fetchMessages = async (conversationId: number) => {
        const response = await fetch(
            `${apiBaseUrl}/conversations/${conversationId}/messages`,
            {
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                },
            },
        );

        if (!response.ok) {
            return;
        }

        const payload = (await response.json()) as { data: MessengerMessage[] };
        payload.data.forEach((message) => {
            seenMessageIdsRef.current.add(message.id);
        });
        loadedConversationIdsRef.current.add(conversationId);

        setMessagesByConversation((messages) => ({
            ...messages,
            [conversationId]: [...payload.data].reverse(),
        }));
    };

    const markConversationRead = async (conversationId: number) => {
        setConversations((items) =>
            items.map((conversation) =>
                conversation.id === conversationId
                    ? {
                          ...conversation,
                          unread_count: 0,
                      }
                    : conversation,
            ),
        );

        await fetch(`${apiBaseUrl}/conversations/${conversationId}/read`, {
            method: 'PATCH',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
            },
        });
    };

    const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (
            !activeConversationId ||
            (!messageBody.trim() && selectedFiles.length === 0) ||
            sending
        ) {
            return;
        }

        setSending(true);

        try {
            const formData = new FormData();

            if (messageBody.trim()) {
                formData.append('body', messageBody.trim());
            }

            selectedFiles.forEach((file) => {
                formData.append('attachments[]', file);
            });

            const response = await fetch(
                `${apiBaseUrl}/conversations/${activeConversationId}/messages`,
                {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                    },
                    body: formData,
                },
            );

            if (!response.ok) {
                return;
            }

            const payload = (await response.json()) as {
                data: MessengerMessage;
            };

            appendMessage(payload.data);
            setMessageBody('');
            setSelectedFiles([]);

            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            <Head title="Messenger" />
            <div className="flex h-[calc(100vh-6.5rem)] min-h-[680px] flex-col overflow-hidden bg-white">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            {workspace.name}
                        </p>
                        <h1 className="truncate text-2xl font-bold text-slate-950">
                            Chats
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            aria-label="New message"
                            className="grid size-10 place-items-center rounded-full bg-[#0054b8] text-white shadow-sm transition hover:bg-[#004996]"
                            onClick={() => setComposerOpen(true)}
                            type="button"
                        >
                            <PencilLine className="size-5" />
                        </button>
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_320px]">
                    <aside className="hidden min-h-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
                        <div className="border-b border-slate-100 p-4">
                            <div className="mb-3 flex items-center">
                                <h2 className="text-lg font-bold text-slate-950">
                                    Chats
                                </h2>
                            </div>
                            <label className="flex h-10 items-center gap-2 rounded-lg bg-slate-100 px-3 text-slate-400">
                                <Search className="size-4" />
                                <input
                                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search conversations"
                                    type="search"
                                    value={search}
                                />
                            </label>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {filteredConversations.length > 0 ? (
                                filteredConversations.map((conversation) => (
                                    <button
                                        className={`flex w-full gap-3 border-b border-slate-100 px-4 py-4 text-left transition ${
                                            conversation.id ===
                                            activeConversationId
                                                ? 'bg-sky-50'
                                                : 'bg-white hover:bg-slate-50'
                                        }`}
                                        key={conversation.id}
                                        onClick={() =>
                                            selectConversation(conversation.id)
                                        }
                                        type="button"
                                    >
                                        <Avatar
                                            label={conversation.display_name}
                                            type={conversation.type}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-3">
                                                <p className="truncate text-sm font-semibold text-slate-950">
                                                    {conversation.display_name}
                                                </p>
                                                {conversation.unread_count >
                                                    0 && (
                                                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#0054b8] text-[10px] font-bold text-white">
                                                        {
                                                            conversation.unread_count
                                                        }
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 truncate text-xs text-slate-500">
                                                {conversationPreview(
                                                    conversation.latest_message,
                                                )}
                                            </p>
                                            <p className="mt-2 text-[11px] font-medium text-slate-400">
                                                {formatTime(
                                                    conversation.last_message_at,
                                                )}
                                            </p>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <EmptyState
                                    icon={<MessageCircle className="size-6" />}
                                    title="No conversations"
                                    body="Start a direct message or create a group chat."
                                />
                            )}
                        </div>
                    </aside>

                    <section className="flex min-h-0 flex-col bg-[#f0f2f5]">
                        {activeConversation ? (
                            <>
                                <ConversationHeader
                                    conversation={activeConversation}
                                />
                                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 md:px-6">
                                    {activeMessages.length > 0 ? (
                                        activeMessages.map((message) => (
                                            <MessageBubble
                                                currentUserId={auth.user.id}
                                                key={message.id}
                                                message={message}
                                            />
                                        ))
                                    ) : (
                                        <EmptyState
                                            icon={
                                                <MessageCircle className="size-6" />
                                            }
                                            title="No messages yet"
                                            body="Send the first message in this conversation."
                                        />
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                                <form
                                    className="shrink-0 border-t border-slate-200 bg-white p-4"
                                    onSubmit={sendMessage}
                                >
                                    {selectedFiles.length > 0 && (
                                        <div className="mb-3 flex flex-wrap gap-2">
                                            {selectedFiles.map(
                                                (file, index) => (
                                                    <span
                                                        className="inline-flex max-w-full items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700"
                                                        key={`${file.name}-${file.lastModified}-${index}`}
                                                    >
                                                        <FileText className="size-3.5 shrink-0" />
                                                        <span className="max-w-48 truncate">
                                                            {file.name}
                                                        </span>
                                                        <span className="text-slate-400">
                                                            {formatFileSize(
                                                                file.size,
                                                            )}
                                                        </span>
                                                        <button
                                                            aria-label={`Remove ${file.name}`}
                                                            className="grid size-5 place-items-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                                                            onClick={() =>
                                                                setSelectedFiles(
                                                                    (files) =>
                                                                        files.filter(
                                                                            (
                                                                                _file,
                                                                                fileIndex,
                                                                            ) =>
                                                                                fileIndex !==
                                                                                index,
                                                                        ),
                                                                )
                                                            }
                                                            type="button"
                                                        >
                                                            <X className="size-3" />
                                                        </button>
                                                    </span>
                                                ),
                                            )}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <input
                                            className="sr-only"
                                            multiple
                                            onChange={(event) =>
                                                setSelectedFiles((files) =>
                                                    [
                                                        ...files,
                                                        ...Array.from(
                                                            event.target
                                                                .files ?? [],
                                                        ),
                                                    ].slice(0, 5),
                                                )
                                            }
                                            ref={fileInputRef}
                                            type="file"
                                        />
                                        <button
                                            aria-label="Attach file"
                                            className="grid size-10 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
                                            onClick={() =>
                                                fileInputRef.current?.click()
                                            }
                                            type="button"
                                        >
                                            <Paperclip className="size-5" />
                                        </button>
                                        <input
                                            className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm transition outline-none focus:border-[#0054b8] focus:bg-white"
                                            onChange={(event) =>
                                                setMessageBody(
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="Type a message..."
                                            value={messageBody}
                                        />
                                        <button
                                            aria-label="Send message"
                                            className="grid size-11 place-items-center rounded-full bg-[#0054b8] text-white shadow-sm transition hover:bg-[#004996] disabled:cursor-not-allowed disabled:bg-slate-300"
                                            disabled={
                                                (!messageBody.trim() &&
                                                    selectedFiles.length ===
                                                        0) ||
                                                sending
                                            }
                                            type="submit"
                                        >
                                            <Send className="size-5" />
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            <EmptyState
                                icon={<MessageCircle className="size-6" />}
                                title="Messenger is ready"
                                body="Start a conversation to begin using the web app."
                            />
                        )}
                    </section>

                    <aside className="hidden min-h-0 border-l border-slate-200 bg-white xl:flex xl:flex-col">
                        <div className="min-h-0 flex-1 overflow-y-auto p-4">
                            {activeConversation ? (
                                <ChatDetails
                                    conversation={activeConversation}
                                />
                            ) : (
                                <EmptyState
                                    icon={<Info className="size-6" />}
                                    title="No chat selected"
                                    body="Choose a chat to see details."
                                />
                            )}
                        </div>
                    </aside>
                </div>
                {composerOpen && (
                    <ConversationComposer
                        contacts={contacts}
                        onClose={() => setComposerOpen(false)}
                        onCreate={createConversation}
                    />
                )}
            </div>
        </>
    );
}

function ConversationComposer({
    contacts,
    onClose,
    onCreate,
}: {
    contacts: Contact[];
    onClose: () => void;
    onCreate: (payload: NewConversationPayload) => Promise<boolean>;
}) {
    const [mode, setMode] = useState<'direct' | 'group'>('direct');
    const [query, setQuery] = useState('');
    const [title, setTitle] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const filteredContacts = contacts.filter((contact) => {
        const haystack = `${contact.name} ${contact.email} ${contact.school_role}`;

        return haystack.toLowerCase().includes(query.toLowerCase());
    });
    const canSubmit =
        selectedIds.length > 0 && (mode === 'direct' || title.trim() !== '');

    const chooseMode = (nextMode: 'direct' | 'group') => {
        setMode(nextMode);
        setError(null);

        if (nextMode === 'direct' && selectedIds.length > 1) {
            setSelectedIds([selectedIds[0]]);
        }
    };

    const toggleContact = (contactId: number) => {
        setError(null);

        if (mode === 'direct') {
            setSelectedIds((ids) =>
                ids.includes(contactId) ? [] : [contactId],
            );

            return;
        }

        setSelectedIds((ids) =>
            ids.includes(contactId)
                ? ids.filter((id) => id !== contactId)
                : [...ids, contactId],
        );
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canSubmit || submitting) {
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const created = await onCreate({
                type: mode,
                title: mode === 'group' ? title.trim() : null,
                participant_ids: selectedIds,
            });

            if (created) {
                onClose();

                return;
            }

            setError('Could not create that conversation.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
            <form
                className="flex max-h-[min(680px,calc(100vh-3rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                onSubmit={submit}
            >
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
                    <h2 className="text-base font-semibold text-slate-950">
                        New message
                    </h2>
                    <button
                        aria-label="Close"
                        className="grid size-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                <div className="shrink-0 space-y-3 border-b border-slate-100 p-4">
                    <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                        {(['direct', 'group'] as const).map((item) => (
                            <button
                                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                    mode === item
                                        ? 'bg-white text-[#0054b8] shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                                key={item}
                                onClick={() => chooseMode(item)}
                                type="button"
                            >
                                {item === 'direct' ? 'Direct' : 'Group'}
                            </button>
                        ))}
                    </div>

                    {mode === 'group' && (
                        <input
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm transition outline-none focus:border-[#0054b8]"
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Group name"
                            value={title}
                        />
                    )}

                    <label className="flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-3 text-slate-400">
                        <Search className="size-4" />
                        <input
                            className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
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
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                                    key={contact.id}
                                    onClick={() => toggleContact(contact.id)}
                                    type="button"
                                >
                                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-rose-500 text-sm font-bold text-white">
                                        {initials(contact.name)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-slate-950">
                                            {contact.name}
                                        </span>
                                        <span className="block truncate text-xs text-slate-500 capitalize">
                                            {contact.school_role}
                                        </span>
                                    </span>
                                    <span
                                        className={`grid size-6 shrink-0 place-items-center rounded-full border ${
                                            selected
                                                ? 'border-[#0054b8] bg-[#0054b8] text-white'
                                                : 'border-slate-300 text-transparent'
                                        }`}
                                    >
                                        <Check className="size-4" />
                                    </span>
                                </button>
                            );
                        })
                    ) : (
                        <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                            <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
                                <UsersRound className="size-6" />
                            </span>
                            <h3 className="mt-3 text-sm font-semibold text-slate-900">
                                No people found
                            </h3>
                            <p className="mt-1 max-w-72 text-sm leading-6 text-slate-500">
                                Team members will appear here when they are
                                added to this school.
                            </p>
                        </div>
                    )}
                </div>

                <div className="shrink-0 border-t border-slate-200 p-4">
                    {error && (
                        <p className="mb-3 text-sm font-medium text-rose-600">
                            {error}
                        </p>
                    )}
                    <button
                        className="h-11 w-full rounded-xl bg-[#0054b8] px-4 text-sm font-semibold text-white transition hover:bg-[#004996] disabled:cursor-not-allowed disabled:bg-slate-300"
                        disabled={!canSubmit || submitting}
                        type="submit"
                    >
                        {submitting ? 'Creating...' : 'Create'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function ConversationHeader({ conversation }: { conversation: Conversation }) {
    return (
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-4 md:px-6">
            <Avatar
                label={conversation.display_name}
                type={conversation.type}
            />
            <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold text-slate-950">
                    {conversation.display_name}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                        <UsersRound className="size-3.5" />
                        {conversation.participants.length} members
                    </span>
                </div>
            </div>
        </header>
    );
}

function ChatDetails({ conversation }: { conversation: Conversation }) {
    return (
        <div className="flex flex-col items-center text-center">
            <Avatar
                label={conversation.display_name}
                type={conversation.type}
            />
            <h2 className="mt-3 max-w-full truncate text-base font-semibold text-slate-950">
                {conversation.display_name}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
                {conversation.type === 'direct'
                    ? 'Direct message'
                    : 'Group chat'}
            </p>

            <div className="mt-6 w-full text-left">
                <PanelTitle
                    icon={<UsersRound className="size-4" />}
                    title="People"
                />
                <div className="mt-3 space-y-2">
                    {conversation.participants.map((participant) => (
                        <div
                            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"
                            key={participant.id}
                        >
                            <span className="grid size-9 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                                {initials(participant.name)}
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-900">
                                    {participant.name}
                                </p>
                                <p className="truncate text-xs text-slate-500 capitalize">
                                    {participant.school_role}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function MessageBubble({
    currentUserId,
    message,
}: {
    currentUserId: number;
    message: MessengerMessage;
}) {
    const mine = message.sender?.id === currentUserId;

    return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[min(72%,42rem)] rounded-2xl px-4 py-3 shadow-sm ${
                    mine
                        ? 'rounded-br-md bg-[#cfe8ff] text-slate-950'
                        : 'rounded-bl-md bg-white text-slate-950'
                }`}
            >
                {!mine && message.sender && (
                    <p className="mb-1 text-xs font-semibold text-[#0054b8]">
                        {message.sender.name}
                    </p>
                )}
                {message.body && (
                    <p className="text-sm leading-6 whitespace-pre-wrap">
                        {message.body}
                    </p>
                )}
                {message.attachments.length > 0 && (
                    <div
                        className={
                            message.body ? 'mt-3 space-y-2' : 'space-y-2'
                        }
                    >
                        {message.attachments.map((attachment) => (
                            <a
                                className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                                    mine
                                        ? 'border-sky-200 bg-white/60 hover:bg-white'
                                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                }`}
                                href={attachment.url}
                                key={attachment.id}
                                rel="noreferrer"
                                target="_blank"
                            >
                                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-[#0054b8]">
                                    <FileText className="size-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">
                                        {attachment.name}
                                    </span>
                                    <span className="block text-xs text-slate-500">
                                        {formatFileSize(attachment.size)}
                                    </span>
                                </span>
                            </a>
                        ))}
                    </div>
                )}
                <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-slate-500">
                    {formatTime(message.created_at)}
                    {mine && <CheckCheck className="size-3.5 text-[#0054b8]" />}
                </div>
            </div>
        </div>
    );
}

function Avatar({
    label,
    type,
}: {
    label: string;
    type: Conversation['type'];
}) {
    return (
        <span
            className={`grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${
                type === 'direct' ? 'bg-rose-500' : 'bg-[#0054b8]'
            }`}
        >
            {type === 'direct' ? (
                initials(label)
            ) : (
                <UsersRound className="size-5" />
            )}
        </span>
    );
}

function PanelTitle({
    className = '',
    icon,
    title,
}: {
    className?: string;
    icon: React.ReactNode;
    title: string;
}) {
    return (
        <div
            className={`flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase ${className}`}
        >
            {icon}
            {title}
        </div>
    );
}

function EmptyState({
    body,
    icon,
    title,
}: {
    body: string;
    icon: React.ReactNode;
    title: string;
}) {
    return (
        <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
                {icon}
            </span>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">
                {title}
            </h3>
            <p className="mt-1 max-w-72 text-sm leading-6 text-slate-500">
                {body}
            </p>
        </div>
    );
}

function formatTime(value: string | null) {
    if (!value) {
        return 'No activity';
    }

    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

function conversationPreview(message: MessengerMessage | null) {
    if (!message) {
        return 'No messages yet';
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

function formatFileSize(size: number) {
    if (size < 1024) {
        return `${size} B`;
    }

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function getCookie(name: string) {
    const cookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${name}=`));

    return cookie ? decodeURIComponent(cookie.split('=')[1]) : '';
}

function getConversationIdFromUrl(conversations: Conversation[]) {
    if (typeof window === 'undefined') {
        return null;
    }

    const conversationId = Number(
        new URLSearchParams(window.location.search).get('conversation'),
    );

    if (!Number.isInteger(conversationId)) {
        return null;
    }

    return conversations.some(
        (conversation) => conversation.id === conversationId,
    )
        ? conversationId
        : null;
}

function initials(label: string) {
    return label
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

Messenger.layout = (props: { workspace?: { slug: string } }) => ({
    breadcrumbs: [
        {
            title: 'Messenger',
            href: props.workspace ? `/${props.workspace.slug}/messenger` : '/',
        },
    ],
});
