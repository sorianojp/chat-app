import { Head, usePage } from '@inertiajs/react';
import { echo } from '@laravel/echo-react';
import {
    CheckCheck,
    Info,
    MessageCircle,
    Paperclip,
    Search,
    Send,
    UsersRound,
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
    created_at: string | null;
};

type Props = {
    apiBaseUrl: string;
    conversations: Conversation[];
    initialMessages: MessengerMessage[];
};

type MessageCreatedPayload = {
    message: MessengerMessage;
};

export default function Messenger({
    apiBaseUrl,
    conversations: initialConversations,
    initialMessages,
}: Props) {
    const { auth } = usePage<{ auth: { user: User } }>().props;
    const [conversations, setConversations] = useState(initialConversations);
    const [activeConversationId, setActiveConversationId] = useState(
        initialConversations[0]?.id ?? null,
    );
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
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const activeConversationIdRef = useRef(activeConversationId);
    const currentUserIdRef = useRef(auth.user.id);
    const seenMessageIdsRef = useRef(
        new Set(initialMessages.map((message) => message.id)),
    );
    const loadedConversationIdsRef = useRef(
        new Set(activeConversationId ? [activeConversationId] : []),
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

        if (!activeConversationId || !messageBody.trim() || sending) {
            return;
        }

        setSending(true);

        try {
            const response = await fetch(
                `${apiBaseUrl}/conversations/${activeConversationId}/messages`,
                {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                    },
                    body: JSON.stringify({
                        body: messageBody.trim(),
                    }),
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
                        <h1 className="truncate text-2xl font-bold text-slate-950">
                            Chats
                        </h1>
                    </div>
                    <div className="hidden items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 sm:flex">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        Realtime ready
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_320px]">
                    <aside className="hidden min-h-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
                        <div className="border-b border-slate-100 p-4">
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
                                            setActiveConversationId(
                                                conversation.id,
                                            )
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
                                                {conversation.latest_message
                                                    ?.body ?? 'No messages yet'}
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
                                    body="Create a conversation from the API or seed data to start messaging."
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
                                    className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-white p-4"
                                    onSubmit={sendMessage}
                                >
                                    <button
                                        aria-label="Attach file"
                                        className="grid size-10 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
                                        type="button"
                                    >
                                        <Paperclip className="size-5" />
                                    </button>
                                    <input
                                        className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm transition outline-none focus:border-[#0054b8] focus:bg-white"
                                        onChange={(event) =>
                                            setMessageBody(event.target.value)
                                        }
                                        placeholder="Type a message..."
                                        value={messageBody}
                                    />
                                    <button
                                        aria-label="Send message"
                                        className="grid size-11 place-items-center rounded-full bg-[#0054b8] text-white shadow-sm transition hover:bg-[#004996] disabled:cursor-not-allowed disabled:bg-slate-300"
                                        disabled={
                                            !messageBody.trim() || sending
                                        }
                                        type="submit"
                                    >
                                        <Send className="size-5" />
                                    </button>
                                </form>
                            </>
                        ) : (
                            <EmptyState
                                icon={<MessageCircle className="size-6" />}
                                title="Messenger is ready"
                                body="Seed or create a conversation to begin using the web app."
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
            </div>
        </>
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
                <p className="text-sm leading-6 whitespace-pre-wrap">
                    {message.body}
                </p>
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

function getCookie(name: string) {
    const cookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${name}=`));

    return cookie ? decodeURIComponent(cookie.split('=')[1]) : '';
}

function initials(label: string) {
    return label
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

Messenger.layout = () => ({
    breadcrumbs: [
        {
            title: 'Messenger',
            href: '/messenger',
        },
    ],
});
