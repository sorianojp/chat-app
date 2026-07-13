import { Head, usePage } from '@inertiajs/react';
import { echo } from '@laravel/echo-react';
import {
    Archive,
    ArchiveRestore,
    Bell,
    BellOff,
    Check,
    FileText,
    Forward,
    ImageIcon,
    Inbox,
    Info,
    Link as LinkIcon,
    LogOut,
    MessageCircle,
    Mic,
    Paperclip,
    PencilLine,
    Pin,
    PinOff,
    Reply,
    Search,
    Send,
    Smile,
    Trash2,
    UserMinus,
    UserPlus,
    UsersRound,
    Video,
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
    conversation_role?: string | null;
};

type Contact = Participant;

type PresenceUser = Participant;

type TypingUser = {
    id: number;
    name: string;
};

type MentionOption = {
    id: number | 'everyone';
    label: string;
    token: string;
    description: string;
};

type ConversationPermissions = {
    can_rename: boolean;
    can_add_members: boolean;
    can_remove_members: boolean;
    can_pin_messages: boolean;
    can_mention_everyone: boolean;
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
    pinned_message: MessengerMessage | null;
    messages_count: number;
    unread_count: number;
    unread_mentions_count: number;
    last_message_at: string | null;
    pinned_at: string | null;
    muted_at: string | null;
    archived_at: string | null;
    notification_preference: NotificationPreference;
    permissions: ConversationPermissions;
};

type NotificationPreference = 'all' | 'mentions' | 'muted';

type MessengerMessage = {
    id: number;
    conversation_id: number;
    sender: {
        id: number;
        name: string;
        school_role: string;
    } | null;
    pinned_by: {
        id: number;
        name: string;
    } | null;
    type: string;
    body: string;
    metadata: Record<string, unknown> | null;
    reply_to: ReplyToMessage | null;
    attachments: MessageAttachment[];
    mentions: MessageMention[];
    mentions_me: boolean;
    mentions_everyone: boolean;
    delivered_to: MessageDeliveryReceipt[];
    reactions: MessageReactionSummary[];
    read_by: MessageReadReceipt[];
    created_at: string | null;
    edited_at: string | null;
    unsent_at: string | null;
    pinned_at: string | null;
};

type ReplyToMessage = {
    id: number;
    sender: {
        id: number;
        name: string;
    } | null;
    body: string;
    attachment_count: number;
    unsent_at: string | null;
};

type MessageMention = {
    id: number;
    name: string;
    type: 'user' | 'everyone';
};

type MessageDeliveryReceipt = {
    id: number;
    name: string;
    delivered_at: string;
};

type MessageReactionSummary = {
    emoji: string;
    count: number;
    reacted_by_me: boolean;
    users: {
        id: number;
        name: string;
    }[];
};

type MessageReadReceipt = {
    id: number;
    name: string;
    read_at: string;
};

type MessageAttachment = {
    id: number;
    name: string;
    mime_type: string | null;
    size: number;
    url: string;
    preview_url: string | null;
};

type SharedContent = {
    media: SharedAttachment[];
    files: SharedAttachment[];
    links: SharedLink[];
};

type SharedAttachment = {
    id: number;
    message_id: number;
    name: string;
    mime_type: string | null;
    size: number;
    url: string;
    preview_url: string | null;
    created_at: string | null;
    sender: {
        id: number;
        name: string;
    } | null;
};

type SharedLink = {
    url: string;
    host: string;
    message_id: number;
    created_at: string | null;
    sender: {
        id: number;
        name: string;
    } | null;
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
    initialConversationId: number | null;
    initialMessages: MessengerMessage[];
    archived: boolean;
};

type MessageCreatedPayload = {
    message: MessengerMessage;
};

type ConversationMutationPayload = {
    data: Conversation;
    system_message?: MessengerMessage | null;
};

type MessageReactionUpdatedPayload = {
    message_id: number;
    reactions: MessageReactionSummary[];
};

type MessageUpdatedPayload = {
    message: MessengerMessage;
};

type ConversationReadPayload = {
    conversation_id: number;
    user_id: number;
    read_at: string | null;
};

type MessageDeliveredPayload = {
    conversation_id: number;
    message_id: number;
    user_id: number;
    user_name: string;
    delivered_at: string;
};

type TypingPayload = {
    id: number;
    name: string;
    typing: boolean;
};

type TypingChannel = {
    listenForWhisper: (
        event: string,
        callback: (payload: TypingPayload) => void,
    ) => TypingChannel;
    stopListeningForWhisper: (
        event: string,
        callback?: (payload: TypingPayload) => void,
    ) => TypingChannel;
    whisper: (
        event: string,
        payload: Record<string, boolean | number | string>,
    ) => TypingChannel;
};

type WindowWithWebAudio = Window &
    typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
    };

type NewConversationPayload = {
    type: 'direct' | 'group';
    title: string | null;
    participant_ids: number[];
};

const REACTION_OPTIONS = ['👍', '❤️', '😂', '😮', '🙏', '✅'];
const TYPING_IDLE_MS = 3000;
const TYPING_WHISPER_INTERVAL_MS = 1200;
const EMPTY_SHARED_CONTENT: SharedContent = {
    media: [],
    files: [],
    links: [],
};

export default function Messenger({
    apiBaseUrl,
    archived,
    contacts,
    conversations: initialConversations,
    initialConversationId,
    initialMessages,
    workspace,
}: Props) {
    const { auth } = usePage<{ auth: { user: User } }>().props;
    const [conversations, setConversations] = useState(() =>
        sortConversations(initialConversations),
    );
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
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [messageSearch, setMessageSearch] = useState('');
    const [messageSearchOpen, setMessageSearchOpen] = useState(false);
    const [messageSearchResults, setMessageSearchResults] = useState<
        MessengerMessage[]
    >([]);
    const [searchingMessages, setSearchingMessages] = useState(false);
    const [sharedContentByConversation, setSharedContentByConversation] =
        useState<Record<number, SharedContent>>({});
    const [pinnedMessagesByConversation, setPinnedMessagesByConversation] =
        useState<Record<number, MessengerMessage[]>>({});
    const [loadingSharedConversationId, setLoadingSharedConversationId] =
        useState<number | null>(null);
    const [loadingPinnedConversationId, setLoadingPinnedConversationId] =
        useState<number | null>(null);
    const [onlineUserIds, setOnlineUserIds] = useState<number[]>([]);
    const [typingUsersByConversation, setTypingUsersByConversation] = useState<
        Record<number, Record<number, TypingUser>>
    >({});
    const [hasHydrated, setHasHydrated] = useState(false);
    const [sending, setSending] = useState(false);
    const [composerOpen, setComposerOpen] = useState(false);
    const [highlightedMessageId, setHighlightedMessageId] = useState<
        number | null
    >(null);
    const [editingMessage, setEditingMessage] =
        useState<MessengerMessage | null>(null);
    const [forwardingMessage, setForwardingMessage] =
        useState<MessengerMessage | null>(null);
    const [forwarding, setForwarding] = useState(false);
    const [replyToMessage, setReplyToMessage] =
        useState<MessengerMessage | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const messageInputRef = useRef<HTMLInputElement | null>(null);
    const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const activeConversationIdRef = useRef(activeConversationId);
    const conversationsRef = useRef(conversations);
    const currentUserIdRef = useRef(auth.user.id);
    const currentUserNameRef = useRef(auth.user.name);
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
    const lastTypingWhisperAtRef = useRef(0);
    const ownTypingStopTimeoutRef = useRef<number | null>(null);
    const activeTypingChannelRef = useRef<TypingChannel | null>(null);
    const notificationAudioContextRef = useRef<AudioContext | null>(null);
    const deliveredMessageIdsRef = useRef(new Set<number>());
    const typingTimeoutsRef = useRef<Record<string, number>>({});

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
    const activePinnedMessages = activeConversationId
        ? (pinnedMessagesByConversation[activeConversationId] ??
          pinnedMessagesList([
              activeConversation?.pinned_message ?? null,
              ...activeMessages,
          ]))
        : [];
    const activePinnedMessage = activePinnedMessages[0] ?? null;
    const messageSearchTerm = messageSearch.trim();
    const visibleMessages =
        messageSearchOpen && messageSearchTerm
            ? messageSearchResults
            : activeMessages;
    const seenMessageId = latestSeenMessageId(visibleMessages, auth.user.id);
    const deliveredMessageId = latestDeliveredMessageId(
        visibleMessages,
        auth.user.id,
    );
    const latestOwnMessageId = latestOwnMessageIdFor(
        visibleMessages,
        auth.user.id,
    );
    const activeSharedContent = activeConversationId
        ? (sharedContentByConversation[activeConversationId] ??
          EMPTY_SHARED_CONTENT)
        : EMPTY_SHARED_CONTENT;
    const loadingSharedContent =
        activeConversationId !== null &&
        loadingSharedConversationId === activeConversationId;
    const loadingPinnedMessages =
        activeConversationId !== null &&
        loadingPinnedConversationId === activeConversationId;
    const onlineUserIdsSet = useMemo(
        () => new Set(onlineUserIds),
        [onlineUserIds],
    );
    const activeTypingUsers = activeConversationId
        ? Object.values(typingUsersByConversation[activeConversationId] ?? {})
        : [];
    const mentionOptions = useMemo(
        () => mentionOptionsFor(activeConversation, auth.user.id),
        [activeConversation, auth.user.id],
    );
    const filteredMentionOptions = mentionQuery
        ? mentionOptions.filter((option) =>
              `${option.label} ${option.token}`
                  .toLowerCase()
                  .includes(mentionQuery.toLowerCase()),
          )
        : mentionOptions;
    const isEditing = editingMessage !== null;
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
                id: auth.user.id,
                name: auth.user.name,
                typing,
            });
        },
        [auth.user.id, auth.user.name],
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
        [whisperTyping],
    );

    useEffect(() => {
        setHasHydrated(true);
    }, []);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    const ensureNotificationAudioContext = useCallback(() => {
        if (typeof window === 'undefined') {
            return null;
        }

        if (notificationAudioContextRef.current) {
            return notificationAudioContextRef.current;
        }

        const AudioContextConstructor =
            window.AudioContext ??
            (window as WindowWithWebAudio).webkitAudioContext;

        if (!AudioContextConstructor) {
            return null;
        }

        notificationAudioContextRef.current = new AudioContextConstructor();

        return notificationAudioContextRef.current;
    }, []);

    const unlockNotificationAudio = useCallback(() => {
        const audioContext = ensureNotificationAudioContext();

        if (audioContext?.state === 'suspended') {
            void audioContext.resume();
        }
    }, [ensureNotificationAudioContext]);

    useEffect(() => {
        window.addEventListener('pointerdown', unlockNotificationAudio, {
            once: true,
        });
        window.addEventListener('keydown', unlockNotificationAudio, {
            once: true,
        });

        return () => {
            window.removeEventListener('pointerdown', unlockNotificationAudio);
            window.removeEventListener('keydown', unlockNotificationAudio);
        };
    }, [unlockNotificationAudio]);

    const playNotificationSound = useCallback(() => {
        const audioContext = ensureNotificationAudioContext();

        if (!audioContext) {
            return;
        }

        const playTone = () => {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            const now = audioContext.currentTime;

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, now);
            oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.045, now + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            oscillator.start(now);
            oscillator.stop(now + 0.2);
        };

        if (audioContext.state === 'suspended') {
            void audioContext
                .resume()
                .then(playTone)
                .catch(() => {});

            return;
        }

        playTone();
    }, [ensureNotificationAudioContext]);

    const handleMessageBodyChange = (value: string) => {
        setMessageBody(value);
        setMentionQuery(
            mentionQueryAtCursor(
                value,
                messageInputRef.current?.selectionStart ?? value.length,
            ),
        );

        if (!activeConversationId) {
            return;
        }

        if (!value.trim()) {
            stopOwnTyping(activeConversationId);

            return;
        }

        const now = Date.now();

        if (
            now - lastTypingWhisperAtRef.current >=
            TYPING_WHISPER_INTERVAL_MS
        ) {
            whisperTyping(activeConversationId, true);
            lastTypingWhisperAtRef.current = now;
        }

        if (ownTypingStopTimeoutRef.current) {
            window.clearTimeout(ownTypingStopTimeoutRef.current);
        }

        ownTypingStopTimeoutRef.current = window.setTimeout(() => {
            stopOwnTyping(activeConversationId);
        }, TYPING_IDLE_MS);
    };

    const syncMentionQueryFromInput = (input: HTMLInputElement) => {
        setMentionQuery(
            mentionQueryAtCursor(
                input.value,
                input.selectionStart ?? input.value.length,
            ),
        );
    };

    const insertMention = (option: MentionOption) => {
        const input = messageInputRef.current;
        const cursor = input?.selectionStart ?? messageBody.length;
        const mentionRange = mentionRangeAtCursor(messageBody, cursor);

        if (!mentionRange) {
            return;
        }

        const beforeMention = messageBody.slice(0, mentionRange.start);
        const afterMention = messageBody.slice(mentionRange.end);
        const nextBody = `${beforeMention}${option.token} ${afterMention}`;
        const nextCursor = beforeMention.length + option.token.length + 1;

        setMessageBody(nextBody);
        setMentionQuery(null);

        window.setTimeout(() => {
            input?.focus();
            input?.setSelectionRange(nextCursor, nextCursor);
        }, 0);
    };

    const openPinnedMessage = (message: MessengerMessage) => {
        const scrollToMessage = () => {
            const messageElement = messageRefs.current[message.id];

            if (!messageElement) {
                return false;
            }

            messageElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
            setHighlightedMessageId(message.id);

            window.setTimeout(() => {
                setHighlightedMessageId((currentMessageId) =>
                    currentMessageId === message.id ? null : currentMessageId,
                );
            }, 1800);

            return true;
        };

        if (scrollToMessage()) {
            return;
        }

        setMessageSearch('');
        setMessageSearchOpen(false);
        setMessageSearchResults([]);

        setMessagesByConversation((messages) => {
            const conversationMessages =
                messages[message.conversation_id] ?? [];

            if (
                conversationMessages.some(
                    (conversationMessage) =>
                        conversationMessage.id === message.id,
                )
            ) {
                return messages;
            }

            return {
                ...messages,
                [message.conversation_id]: sortMessagesByCreatedAt([
                    ...conversationMessages,
                    message,
                ]),
            };
        });
        window.setTimeout(scrollToMessage, 0);
    };

    const appendMessage = useCallback(
        (message: MessengerMessage) => {
            const isActive =
                message.conversation_id === activeConversationIdRef.current;
            const isMine = message.sender?.id === currentUserIdRef.current;
            const wasAlreadyLoaded = seenMessageIdsRef.current.has(message.id);
            const conversation = conversationsRef.current.find(
                (item) => item.id === message.conversation_id,
            );

            if (!wasAlreadyLoaded) {
                seenMessageIdsRef.current.add(message.id);
            }

            if (
                !wasAlreadyLoaded &&
                shouldPlayNotificationSound(
                    message,
                    conversation,
                    currentUserIdRef.current,
                    currentUserNameRef.current,
                )
            ) {
                playNotificationSound();
            }

            setMessagesByConversation((messages) => {
                const existingMessages =
                    messages[message.conversation_id] ?? [];

                if (wasAlreadyLoaded) {
                    return messages;
                }

                return {
                    ...messages,
                    [message.conversation_id]: [...existingMessages, message],
                };
            });

            setConversations((items) =>
                sortConversations(
                    items.map((conversation) =>
                        conversation.id === message.conversation_id
                            ? {
                                  ...conversation,
                                  latest_message: message,
                                  last_message_at: message.created_at,
                                  pinned_message: latestPinnedMessage([
                                      conversation.pinned_message,
                                      message,
                                  ]),
                                  unread_count:
                                      isActive || isMine || wasAlreadyLoaded
                                          ? 0
                                          : conversation.unread_count + 1,
                                  unread_mentions_count:
                                      isActive || isMine || wasAlreadyLoaded
                                          ? 0
                                          : conversation.unread_mentions_count +
                                            (messageMentionsUser(
                                                message,
                                                currentUserIdRef.current,
                                                currentUserNameRef.current,
                                            )
                                                ? 1
                                                : 0),
                              }
                            : conversation,
                    ),
                ),
            );
        },
        [playNotificationSound],
    );

    const updateMessageReactions = useCallback(
        (messageId: number, reactions: MessageReactionSummary[]) => {
            const personalizedReactions = personalizeReactions(
                reactions,
                currentUserIdRef.current,
            );

            setMessagesByConversation((messages) =>
                mapMessages(messages, (message) =>
                    message.id === messageId
                        ? {
                              ...message,
                              reactions: personalizedReactions,
                          }
                        : message,
                ),
            );
            setMessageSearchResults((messages) =>
                messages.map((message) =>
                    message.id === messageId
                        ? {
                              ...message,
                              reactions: personalizedReactions,
                          }
                        : message,
                ),
            );
            setConversations((items) =>
                items.map((conversation) =>
                    conversation.latest_message?.id === messageId
                        ? {
                              ...conversation,
                              latest_message: {
                                  ...conversation.latest_message,
                                  reactions: personalizedReactions,
                              },
                              pinned_message:
                                  conversation.pinned_message?.id === messageId
                                      ? {
                                            ...conversation.pinned_message,
                                            reactions: personalizedReactions,
                                        }
                                      : conversation.pinned_message,
                          }
                        : conversation,
                ),
            );
        },
        [],
    );

    const replaceMessage = useCallback((message: MessengerMessage) => {
        const personalizedMessage = personalizeMessage(
            message,
            currentUserIdRef.current,
        );

        setMessagesByConversation((messages) =>
            mapMessages(messages, (item) => {
                if (item.id === personalizedMessage.id) {
                    return personalizedMessage;
                }

                if (item.reply_to?.id === personalizedMessage.id) {
                    return {
                        ...item,
                        reply_to: replyToFromMessage(personalizedMessage),
                    };
                }

                return item;
            }),
        );
        setMessageSearchResults((messages) =>
            messages.map((item) => {
                if (item.id === personalizedMessage.id) {
                    return personalizedMessage;
                }

                if (item.reply_to?.id === personalizedMessage.id) {
                    return {
                        ...item,
                        reply_to: replyToFromMessage(personalizedMessage),
                    };
                }

                return item;
            }),
        );
        setPinnedMessagesByConversation((pinnedMessages) => {
            const currentPinnedMessages =
                pinnedMessages[personalizedMessage.conversation_id];

            if (!currentPinnedMessages) {
                return pinnedMessages;
            }

            return {
                ...pinnedMessages,
                [personalizedMessage.conversation_id]:
                    personalizedMessage.pinned_at === null ||
                    personalizedMessage.unsent_at !== null
                        ? currentPinnedMessages.filter(
                              (item) => item.id !== personalizedMessage.id,
                          )
                        : pinnedMessagesList([
                              personalizedMessage,
                              ...currentPinnedMessages,
                          ]),
            };
        });
        setConversations((items) =>
            sortConversations(
                items.map((conversation) =>
                    conversation.id === personalizedMessage.conversation_id
                        ? updateConversationMessageSnapshot(
                              conversation,
                              personalizedMessage,
                          )
                        : conversation,
                ),
            ),
        );
    }, []);

    const replaceConversation = useCallback((conversation: Conversation) => {
        setConversations((items) =>
            sortConversations(
                items.map((item) =>
                    item.id === conversation.id ? conversation : item,
                ),
            ),
        );
    }, []);

    const removeConversationFromCurrentView = useCallback(
        (conversationId: number) => {
            setConversations((items) =>
                items.filter((item) => item.id !== conversationId),
            );

            if (activeConversationIdRef.current === conversationId) {
                setActiveConversationId(null);
                window.history.replaceState({}, '', window.location.pathname);
            }
        },
        [],
    );

    const applyConversationRead = useCallback(
        (payload: ConversationReadPayload) => {
            if (!payload.read_at) {
                return;
            }

            const conversation = conversations.find(
                (item) => item.id === payload.conversation_id,
            );
            const reader = conversation?.participants.find(
                (participant) => participant.id === payload.user_id,
            );

            if (!reader) {
                return;
            }

            const readAt = payload.read_at;

            setMessagesByConversation((messages) =>
                mapMessages(messages, (message) => {
                    if (
                        message.conversation_id !== payload.conversation_id ||
                        message.sender?.id !== currentUserIdRef.current ||
                        message.created_at === null ||
                        new Date(message.created_at).getTime() >
                            new Date(readAt).getTime() ||
                        message.read_by.some(
                            (receipt) => receipt.id === payload.user_id,
                        )
                    ) {
                        return message;
                    }

                    return {
                        ...message,
                        read_by: [
                            ...message.read_by,
                            {
                                id: reader.id,
                                name: reader.name,
                                read_at: readAt,
                            },
                        ],
                    };
                }),
            );
        },
        [conversations],
    );

    const applyMessageDelivered = useCallback(
        (payload: MessageDeliveredPayload) => {
            const conversation = conversations.find(
                (item) => item.id === payload.conversation_id,
            );
            const user = conversation?.participants.find(
                (participant) => participant.id === payload.user_id,
            ) ?? {
                id: payload.user_id,
                name: payload.user_name,
            };
            const receipt: MessageDeliveryReceipt = {
                id: user.id,
                name: user.name,
                delivered_at: payload.delivered_at,
            };

            setMessagesByConversation((messages) =>
                mapMessages(messages, (message) =>
                    message.id === payload.message_id
                        ? addDeliveryReceipt(message, receipt)
                        : message,
                ),
            );
            setMessageSearchResults((messages) =>
                messages.map((message) =>
                    message.id === payload.message_id
                        ? addDeliveryReceipt(message, receipt)
                        : message,
                ),
            );
            setPinnedMessagesByConversation((messages) =>
                mapMessages(messages, (message) =>
                    message.id === payload.message_id
                        ? addDeliveryReceipt(message, receipt)
                        : message,
                ),
            );
        },
        [conversations],
    );

    const selectConversation = (conversationId: number) => {
        stopOwnTyping(activeConversationIdRef.current);
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

        setConversations((items) =>
            sortConversations([
                conversation,
                ...items.filter((item) => item.id !== conversation.id),
            ]),
        );
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
        const channel = echo<'reverb'>().join(`teams.${workspace.id}.presence`);

        channel
            .here((users: PresenceUser[]) => {
                setOnlineUserIds(uniqueUserIds(users.map((user) => user.id)));
            })
            .joining((user: PresenceUser) => {
                setOnlineUserIds((ids) => uniqueUserIds([...ids, user.id]));
            })
            .leaving((user: PresenceUser) => {
                setOnlineUserIds((ids) =>
                    ids.filter((userId) => userId !== user.id),
                );
            });

        return () => {
            echo<'reverb'>().leave(`teams.${workspace.id}.presence`);
        };
    }, [workspace.id]);

    useEffect(() => {
        if (!activeConversationId) {
            return;
        }

        const conversationId = activeConversationId;
        const channel = echo<'reverb'>().join(
            `conversations.${conversationId}`,
        ) as TypingChannel;
        const handleTyping = (payload: TypingPayload) => {
            if (!payload.id || payload.id === auth.user.id) {
                return;
            }

            if (!payload.typing) {
                removeTypingUser(conversationId, payload.id);

                return;
            }

            const key = typingTimeoutKey(conversationId, payload.id);
            const existingTimeout = typingTimeoutsRef.current[key];

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

            typingTimeoutsRef.current[key] = window.setTimeout(() => {
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

            Object.keys(typingTimeoutsRef.current)
                .filter((key) => key.startsWith(`${conversationId}:`))
                .forEach((key) => {
                    window.clearTimeout(typingTimeoutsRef.current[key]);
                    delete typingTimeoutsRef.current[key];
                });
        };
    }, [activeConversationId, auth.user.id, removeTypingUser]);

    useEffect(() => {
        return () => {
            stopOwnTyping(activeConversationIdRef.current);
            Object.values(typingTimeoutsRef.current).forEach((timeout) => {
                window.clearTimeout(timeout);
            });
        };
    }, [stopOwnTyping]);

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
                )
                .listen(
                    '.message.reaction.updated',
                    (payload: MessageReactionUpdatedPayload) => {
                        updateMessageReactions(
                            payload.message_id,
                            payload.reactions,
                        );
                    },
                )
                .listen(
                    '.message.updated',
                    (payload: MessageUpdatedPayload) => {
                        replaceMessage(payload.message);
                    },
                )
                .listen(
                    '.message.delivered',
                    (payload: MessageDeliveredPayload) => {
                        applyMessageDelivered(payload);
                    },
                )
                .listen(
                    '.conversation.read',
                    (payload: ConversationReadPayload) => {
                        applyConversationRead(payload);
                    },
                );
        });

        return () => {
            conversationIds.forEach((conversationId) => {
                echo().leaveChannel(`private-conversations.${conversationId}`);
            });
        };
    }, [
        appendMessage,
        applyConversationRead,
        applyMessageDelivered,
        conversationIdsKey,
        replaceMessage,
        updateMessageReactions,
    ]);

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
        if (!activeConversationId) {
            return;
        }

        activeMessages
            .filter(
                (message) =>
                    message.sender !== null &&
                    message.sender.id !== auth.user.id &&
                    message.unsent_at === null &&
                    !message.delivered_to.some(
                        (receipt) => receipt.id === auth.user.id,
                    ) &&
                    !deliveredMessageIdsRef.current.has(message.id),
            )
            .forEach((message) => {
                deliveredMessageIdsRef.current.add(message.id);
                void markMessageDelivered(message);
            });
    }, [activeConversationId, activeMessages, auth.user.id]);

    useEffect(() => {
        if (
            !activeConversationId ||
            loadedConversationIdsRef.current.has(activeConversationId)
        ) {
            return;
        }

        void fetchMessages(activeConversationId);
    }, [activeConversationId, apiBaseUrl]);

    useEffect(() => {
        if (!activeConversationId) {
            return;
        }

        void fetchSharedContent(activeConversationId);
    }, [activeConversationId, activeMessages.length]);

    useEffect(() => {
        if (!activeConversationId) {
            return;
        }

        void fetchPinnedMessages(activeConversationId);
    }, [activeConversationId]);

    useEffect(() => {
        setMessageSearch('');
        setMessageSearchOpen(false);
        setMessageSearchResults([]);
        setEditingMessage(null);
        setReplyToMessage(null);
        setMentionQuery(null);
        setMessageBody('');
        setSelectedFiles([]);
    }, [activeConversationId]);

    useEffect(() => {
        if (!activeConversationId || !messageSearchOpen || !messageSearchTerm) {
            setMessageSearchResults([]);
            setSearchingMessages(false);

            return;
        }

        const timeout = window.setTimeout(() => {
            void searchMessages(activeConversationId, messageSearchTerm);
        }, 250);

        return () => window.clearTimeout(timeout);
    }, [activeConversationId, messageSearchOpen, messageSearchTerm]);

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
                          unread_mentions_count: 0,
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

    const markMessageDelivered = async (message: MessengerMessage) => {
        await fetch(
            `${apiBaseUrl}/conversations/${message.conversation_id}/messages/${message.id}/delivered`,
            {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
            },
        );
    };

    const searchMessages = async (conversationId: number, query: string) => {
        setSearchingMessages(true);

        try {
            const params = new URLSearchParams({ search: query });
            const response = await fetch(
                `${apiBaseUrl}/conversations/${conversationId}/messages?${params.toString()}`,
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

            const payload = (await response.json()) as {
                data: MessengerMessage[];
            };

            setMessageSearchResults([...payload.data].reverse());
        } finally {
            setSearchingMessages(false);
        }
    };

    const fetchSharedContent = async (conversationId: number) => {
        setLoadingSharedConversationId(conversationId);

        try {
            const response = await fetch(
                `${apiBaseUrl}/conversations/${conversationId}/shared`,
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

            const payload = (await response.json()) as {
                data: SharedContent;
            };

            setSharedContentByConversation((content) => ({
                ...content,
                [conversationId]: payload.data,
            }));
        } finally {
            setLoadingSharedConversationId((loadingConversationId) =>
                loadingConversationId === conversationId
                    ? null
                    : loadingConversationId,
            );
        }
    };

    const fetchPinnedMessages = async (conversationId: number) => {
        setLoadingPinnedConversationId(conversationId);

        try {
            const response = await fetch(
                `${apiBaseUrl}/conversations/${conversationId}/messages/pinned`,
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

            const payload = (await response.json()) as {
                data: MessengerMessage[];
            };

            setPinnedMessagesByConversation((messages) => ({
                ...messages,
                [conversationId]: payload.data,
            }));
        } finally {
            setLoadingPinnedConversationId((loadingConversationId) =>
                loadingConversationId === conversationId
                    ? null
                    : loadingConversationId,
            );
        }
    };

    const toggleReaction = async (message: MessengerMessage, emoji: string) => {
        if (message.unsent_at) {
            return;
        }

        const existingReaction = message.reactions.find(
            (reaction) => reaction.reacted_by_me,
        );
        const removingSameReaction = existingReaction?.emoji === emoji;
        const response = await fetch(
            `${apiBaseUrl}/conversations/${message.conversation_id}/messages/${message.id}/reaction`,
            {
                method: removingSameReaction ? 'DELETE' : 'PATCH',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
                body: removingSameReaction
                    ? undefined
                    : JSON.stringify({ emoji }),
            },
        );

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

    const startReply = (message: MessengerMessage) => {
        if (message.unsent_at) {
            return;
        }

        setReplyToMessage(message);
        setEditingMessage(null);
    };

    const startEdit = (message: MessengerMessage) => {
        if (message.unsent_at || message.sender?.id !== auth.user.id) {
            return;
        }

        setEditingMessage(message);
        setReplyToMessage(null);
        setSelectedFiles([]);
        setMessageBody(message.body);
        setMentionQuery(null);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const cancelComposerContext = () => {
        setEditingMessage(null);
        setReplyToMessage(null);
        setMessageBody('');
        setMentionQuery(null);
    };

    const updateMessage = async () => {
        if (!editingMessage || !messageBody.trim() || sending) {
            return;
        }

        setSending(true);

        try {
            const response = await fetch(
                `${apiBaseUrl}/conversations/${editingMessage.conversation_id}/messages/${editingMessage.id}`,
                {
                    method: 'PATCH',
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                    },
                    body: JSON.stringify({ body: messageBody.trim() }),
                },
            );

            if (!response.ok) {
                return;
            }

            const payload = (await response.json()) as {
                data: MessengerMessage;
            };

            replaceMessage(payload.data);
            setEditingMessage(null);
            setMessageBody('');
            setMentionQuery(null);
        } finally {
            setSending(false);
        }
    };

    const unsendMessage = async (message: MessengerMessage) => {
        if (
            message.unsent_at ||
            message.sender?.id !== auth.user.id ||
            !window.confirm('Unsend this message for everyone?')
        ) {
            return;
        }

        const response = await fetch(
            `${apiBaseUrl}/conversations/${message.conversation_id}/messages/${message.id}`,
            {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
            },
        );

        if (!response.ok) {
            return;
        }

        const payload = (await response.json()) as {
            data: MessengerMessage;
        };

        replaceMessage(payload.data);

        if (editingMessage?.id === message.id) {
            setEditingMessage(null);
            setMessageBody('');
            setMentionQuery(null);
        }

        if (replyToMessage?.id === message.id) {
            setReplyToMessage(null);
        }
    };

    const toggleMessagePin = async (message: MessengerMessage) => {
        if (message.unsent_at || message.type === 'system') {
            return;
        }

        const response = await fetch(
            `${apiBaseUrl}/conversations/${message.conversation_id}/messages/${message.id}/pin`,
            {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
                body: JSON.stringify({ pinned: message.pinned_at === null }),
            },
        );

        if (!response.ok) {
            return;
        }

        const payload = (await response.json()) as {
            data: MessengerMessage;
        };

        replaceMessage(payload.data);
    };

    const toggleConversationPin = async (conversation: Conversation) => {
        const nextPinned = conversation.pinned_at === null;
        const response = await fetch(
            `${apiBaseUrl}/conversations/${conversation.id}/pin`,
            {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
                body: JSON.stringify({ pinned: nextPinned }),
            },
        );

        if (!response.ok) {
            return;
        }

        const payload = (await response.json()) as {
            data: { pinned_at: string | null };
        };

        setConversations((items) =>
            sortConversations(
                items.map((item) =>
                    item.id === conversation.id
                        ? {
                              ...item,
                              pinned_at: payload.data.pinned_at,
                          }
                        : item,
                ),
            ),
        );
    };

    const moveConversationToArchiveState = async (
        conversation: Conversation,
        shouldArchive: boolean,
    ) => {
        const response = await fetch(
            `${apiBaseUrl}/conversations/${conversation.id}/archive`,
            {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
                body: JSON.stringify({ archived: shouldArchive }),
            },
        );

        if (!response.ok) {
            return;
        }

        removeConversationFromCurrentView(conversation.id);
    };

    const deleteArchivedConversation = async (conversation: Conversation) => {
        if (!window.confirm('Permanently delete this archived chat?')) {
            return;
        }

        const response = await fetch(
            `${apiBaseUrl}/conversations/${conversation.id}`,
            {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
            },
        );

        if (!response.ok) {
            return;
        }

        removeConversationFromCurrentView(conversation.id);
    };

    const toggleConversationMute = async (conversation: Conversation) => {
        await updateNotificationPreference(
            conversation,
            conversation.notification_preference === 'muted' ? 'all' : 'muted',
        );
    };

    const updateNotificationPreference = async (
        conversation: Conversation,
        preference: NotificationPreference,
    ) => {
        const response = await fetch(
            `${apiBaseUrl}/conversations/${conversation.id}/notifications`,
            {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
                body: JSON.stringify({ preference }),
            },
        );

        if (!response.ok) {
            return false;
        }

        const payload = (await response.json()) as {
            data: {
                muted_at: string | null;
                notification_preference: NotificationPreference;
            };
        };

        setConversations((items) =>
            items.map((item) =>
                item.id === conversation.id
                    ? {
                          ...item,
                          muted_at: payload.data.muted_at,
                          notification_preference:
                              payload.data.notification_preference,
                      }
                    : item,
            ),
        );

        return true;
    };

    const renameConversation = async (
        conversation: Conversation,
        title: string,
    ) => {
        const response = await fetch(
            `${apiBaseUrl}/conversations/${conversation.id}`,
            {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
                body: JSON.stringify({ title }),
            },
        );

        if (!response.ok) {
            return false;
        }

        const payload = (await response.json()) as ConversationMutationPayload;
        replaceConversation(payload.data);

        if (payload.system_message) {
            appendMessage(payload.system_message);
        }

        return true;
    };

    const addConversationMembers = async (
        conversation: Conversation,
        userIds: number[],
    ) => {
        const response = await fetch(
            `${apiBaseUrl}/conversations/${conversation.id}/members`,
            {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
                body: JSON.stringify({ user_ids: userIds }),
            },
        );

        if (!response.ok) {
            return false;
        }

        const payload = (await response.json()) as ConversationMutationPayload;
        replaceConversation(payload.data);

        if (payload.system_message) {
            appendMessage(payload.system_message);
        }

        return true;
    };

    const removeConversationMember = async (
        conversation: Conversation,
        userId: number,
    ) => {
        const response = await fetch(
            `${apiBaseUrl}/conversations/${conversation.id}/members/${userId}`,
            {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
            },
        );

        if (!response.ok) {
            return false;
        }

        const payload = (await response.json()) as ConversationMutationPayload;
        replaceConversation(payload.data);

        if (payload.system_message) {
            appendMessage(payload.system_message);
        }

        return true;
    };

    const leaveConversation = async (conversation: Conversation) => {
        if (!window.confirm('Leave this group chat?')) {
            return false;
        }

        const response = await fetch(
            `${apiBaseUrl}/conversations/${conversation.id}/members/me`,
            {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
            },
        );

        if (!response.ok) {
            return false;
        }

        removeConversationFromCurrentView(conversation.id);

        return true;
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
            const response = await fetch(
                `${apiBaseUrl}/conversations/${message.conversation_id}/messages/${message.id}/forward`,
                {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                    },
                    body: JSON.stringify({
                        conversation_ids: conversationIds,
                    }),
                },
            );

            if (!response.ok) {
                return false;
            }

            const payload = (await response.json()) as {
                data: MessengerMessage[];
            };

            payload.data.forEach((forwardedMessage) => {
                appendMessage(forwardedMessage);
            });
            setForwardingMessage(null);

            return true;
        } finally {
            setForwarding(false);
        }
    };

    const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (editingMessage) {
            await updateMessage();

            return;
        }

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

            if (replyToMessage) {
                formData.append(
                    'reply_to_message_id',
                    String(replyToMessage.id),
                );
            }

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
            setMentionQuery(null);
            setReplyToMessage(null);
            setSelectedFiles([]);
            stopOwnTyping(activeConversationId);

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
                            {archived ? 'Archived' : 'Chat'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            aria-label={archived ? 'Back to inbox' : 'Archive'}
                            className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200 hover:text-slate-900"
                            href={
                                archived
                                    ? `/${workspace.slug}/messenger`
                                    : `/${workspace.slug}/messenger?archived=1`
                            }
                        >
                            {archived ? (
                                <Inbox className="size-5" />
                            ) : (
                                <Archive className="size-5" />
                            )}
                        </a>
                        {!archived && (
                            <button
                                aria-label="New message"
                                className="grid size-10 place-items-center rounded-full bg-[#0054b8] text-white shadow-sm transition hover:bg-[#004996]"
                                onClick={() => setComposerOpen(true)}
                                type="button"
                            >
                                <PencilLine className="size-5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_320px]">
                    <aside className="hidden min-h-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
                        <div className="border-b border-slate-100 p-4">
                            <div className="mb-3 flex items-center">
                                <h2 className="text-lg font-bold text-slate-950">
                                    {archived ? 'Archives' : 'Chats'}
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
                                filteredConversations.map((conversation) => {
                                    const typingUsers = Object.values(
                                        typingUsersByConversation[
                                            conversation.id
                                        ] ?? {},
                                    );

                                    return (
                                        <button
                                            className={`flex w-full gap-3 border-b border-slate-100 px-4 py-4 text-left transition ${
                                                conversation.id ===
                                                activeConversationId
                                                    ? 'bg-sky-50'
                                                    : 'bg-white hover:bg-slate-50'
                                            }`}
                                            key={conversation.id}
                                            onClick={() =>
                                                selectConversation(
                                                    conversation.id,
                                                )
                                            }
                                            type="button"
                                        >
                                            <Avatar
                                                label={
                                                    conversation.display_name
                                                }
                                                online={conversationHasOnlineParticipants(
                                                    conversation,
                                                    auth.user.id,
                                                    onlineUserIdsSet,
                                                )}
                                                type={conversation.type}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-3">
                                                    <p className="truncate text-sm font-semibold text-slate-950">
                                                        {
                                                            conversation.display_name
                                                        }
                                                    </p>
                                                    <span className="flex shrink-0 items-center gap-1 text-slate-400">
                                                        {conversation.pinned_at && (
                                                            <Pin className="size-3.5 text-[#0054b8]" />
                                                        )}
                                                        {conversation.muted_at && (
                                                            <BellOff className="size-3.5" />
                                                        )}
                                                    </span>
                                                    {conversation.unread_count >
                                                        0 && (
                                                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#0054b8] text-[10px] font-bold text-white">
                                                            {
                                                                conversation.unread_count
                                                            }
                                                        </span>
                                                    )}
                                                    {conversation.unread_mentions_count >
                                                        0 && (
                                                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-amber-400 text-[11px] font-bold text-slate-950">
                                                            @
                                                        </span>
                                                    )}
                                                </div>
                                                <p
                                                    className={`mt-1 truncate text-xs ${
                                                        typingUsers.length > 0
                                                            ? 'font-medium text-[#0054b8]'
                                                            : 'text-slate-500'
                                                    }`}
                                                >
                                                    {typingUsers.length > 0
                                                        ? typingLabel(
                                                              typingUsers,
                                                          )
                                                        : conversationPreview(
                                                              conversation.latest_message,
                                                          )}
                                                </p>
                                                <p className="mt-2 text-[11px] font-medium text-slate-400">
                                                    {conversationStatusLabel(
                                                        conversation,
                                                        auth.user.id,
                                                        onlineUserIdsSet,
                                                        conversation.last_message_at,
                                                    )}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })
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
                                            : 'No conversations'
                                    }
                                    body={
                                        archived
                                            ? 'Archived chats will appear here.'
                                            : 'Start a direct message or create a group chat.'
                                    }
                                />
                            )}
                        </div>
                    </aside>

                    <section className="flex min-h-0 flex-col bg-[#f0f2f5]">
                        {activeConversation ? (
                            <>
                                <ConversationHeader
                                    archived={archived}
                                    conversation={activeConversation}
                                    currentUserId={auth.user.id}
                                    onArchive={(conversation) =>
                                        void moveConversationToArchiveState(
                                            conversation,
                                            true,
                                        )
                                    }
                                    onDeleteArchived={(conversation) =>
                                        void deleteArchivedConversation(
                                            conversation,
                                        )
                                    }
                                    onRestore={(conversation) =>
                                        void moveConversationToArchiveState(
                                            conversation,
                                            false,
                                        )
                                    }
                                    onOpenMessageSearch={() =>
                                        setMessageSearchOpen(true)
                                    }
                                    onToggleMute={toggleConversationMute}
                                    onTogglePin={toggleConversationPin}
                                    onlineUserIds={onlineUserIdsSet}
                                    typingUsers={activeTypingUsers}
                                />
                                {messageSearchOpen && (
                                    <div className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
                                        <label className="flex h-10 items-center gap-2 rounded-lg bg-slate-100 px-3 text-slate-400">
                                            <Search className="size-4" />
                                            <input
                                                autoFocus
                                                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                                                onChange={(event) =>
                                                    setMessageSearch(
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Search messages"
                                                type="search"
                                                value={messageSearch}
                                            />
                                            <button
                                                aria-label="Close search"
                                                className="grid size-7 place-items-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                                                onClick={() => {
                                                    setMessageSearch('');
                                                    setMessageSearchOpen(false);
                                                    setMessageSearchResults([]);
                                                }}
                                                type="button"
                                            >
                                                <X className="size-4" />
                                            </button>
                                        </label>
                                    </div>
                                )}
                                {activePinnedMessage && (
                                    <PinnedMessageBanner
                                        canUnpin={
                                            activeConversation.permissions
                                                .can_pin_messages
                                        }
                                        message={activePinnedMessage}
                                        onUnpin={toggleMessagePin}
                                    />
                                )}
                                <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-4 py-5 md:px-6">
                                    {visibleMessages.length > 0 ? (
                                        visibleMessages.map((message) => (
                                            <div
                                                className={`rounded-2xl transition ${
                                                    highlightedMessageId ===
                                                    message.id
                                                        ? 'bg-sky-100/70 ring-2 ring-[#0054b8]/30'
                                                        : ''
                                                }`}
                                                key={message.id}
                                                ref={(element) => {
                                                    messageRefs.current[
                                                        message.id
                                                    ] = element;
                                                }}
                                            >
                                                <MessageBubble
                                                    canPin={
                                                        activeConversation
                                                            .permissions
                                                            .can_pin_messages
                                                    }
                                                    currentUserId={auth.user.id}
                                                    deliveryStatus={messageDeliveryStatus(
                                                        message,
                                                        auth.user.id,
                                                        hasHydrated,
                                                        message.id ===
                                                            seenMessageId,
                                                        message.id ===
                                                            deliveredMessageId,
                                                        message.id ===
                                                            latestOwnMessageId,
                                                    )}
                                                    message={message}
                                                    onEdit={startEdit}
                                                    onForward={
                                                        setForwardingMessage
                                                    }
                                                    onPin={toggleMessagePin}
                                                    onReact={toggleReaction}
                                                    onReply={startReply}
                                                    onUnsend={unsendMessage}
                                                />
                                            </div>
                                        ))
                                    ) : searchingMessages ? (
                                        <EmptyState
                                            icon={<Search className="size-6" />}
                                            title="Searching messages"
                                            body="Looking through this conversation."
                                        />
                                    ) : messageSearchOpen &&
                                      messageSearchTerm ? (
                                        <EmptyState
                                            icon={<Search className="size-6" />}
                                            title="No messages found"
                                            body="Try another word or file name."
                                        />
                                    ) : (
                                        <EmptyState
                                            icon={
                                                <MessageCircle className="size-6" />
                                            }
                                            title="No messages yet"
                                            body="Send the first message in this conversation."
                                        />
                                    )}
                                    {activeTypingUsers.length > 0 &&
                                        !messageSearchTerm && (
                                            <TypingIndicator
                                                users={activeTypingUsers}
                                            />
                                        )}
                                    <div ref={messagesEndRef} />
                                </div>
                                <form
                                    className="shrink-0 border-t border-slate-200 bg-white p-4"
                                    onSubmit={sendMessage}
                                >
                                    {editingMessage && (
                                        <ComposerContext
                                            body={editingMessage.body}
                                            label="Editing message"
                                            onCancel={cancelComposerContext}
                                        />
                                    )}
                                    {replyToMessage && !editingMessage && (
                                        <ComposerContext
                                            body={messagePreview(
                                                replyToMessage,
                                            )}
                                            label={`Replying to ${replyToMessage.sender?.id === auth.user.id ? 'yourself' : (replyToMessage.sender?.name ?? 'message')}`}
                                            onCancel={() =>
                                                setReplyToMessage(null)
                                            }
                                        />
                                    )}
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
                                    {mentionQuery !== null &&
                                        filteredMentionOptions.length > 0 && (
                                            <div className="mb-3 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                                                {filteredMentionOptions.map(
                                                    (option) => (
                                                        <button
                                                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                                                            key={option.id}
                                                            onMouseDown={(
                                                                event,
                                                            ) => {
                                                                event.preventDefault();
                                                                insertMention(
                                                                    option,
                                                                );
                                                            }}
                                                            type="button"
                                                        >
                                                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sky-50 text-xs font-bold text-[#0054b8]">
                                                                {option.id ===
                                                                'everyone'
                                                                    ? '@'
                                                                    : initials(
                                                                          option.label,
                                                                      )}
                                                            </span>
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block truncate text-sm font-semibold text-slate-950">
                                                                    {
                                                                        option.token
                                                                    }
                                                                </span>
                                                                <span className="block truncate text-xs text-slate-500">
                                                                    {
                                                                        option.description
                                                                    }
                                                                </span>
                                                            </span>
                                                        </button>
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
                                            disabled={isEditing}
                                            type="file"
                                        />
                                        <button
                                            aria-label="Attach file"
                                            className="grid size-10 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
                                            onClick={() =>
                                                fileInputRef.current?.click()
                                            }
                                            disabled={isEditing}
                                            type="button"
                                        >
                                            <Paperclip className="size-5" />
                                        </button>
                                        <input
                                            className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm transition outline-none focus:border-[#0054b8] focus:bg-white"
                                            onClick={(event) =>
                                                syncMentionQueryFromInput(
                                                    event.currentTarget,
                                                )
                                            }
                                            onChange={(event) =>
                                                handleMessageBodyChange(
                                                    event.target.value,
                                                )
                                            }
                                            onKeyUp={(event) =>
                                                syncMentionQueryFromInput(
                                                    event.currentTarget,
                                                )
                                            }
                                            placeholder="Type a message..."
                                            ref={messageInputRef}
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
                                    contacts={contacts}
                                    conversation={activeConversation}
                                    currentUserId={auth.user.id}
                                    loadingPinnedMessages={
                                        loadingPinnedMessages
                                    }
                                    loadingSharedContent={loadingSharedContent}
                                    onlineUserIds={onlineUserIdsSet}
                                    onAddMembers={addConversationMembers}
                                    onLeave={leaveConversation}
                                    onNotificationChange={
                                        updateNotificationPreference
                                    }
                                    onRemoveMember={removeConversationMember}
                                    onRename={renameConversation}
                                    onOpenPinnedMessage={openPinnedMessage}
                                    onUnpinPinnedMessage={toggleMessagePin}
                                    pinnedMessages={activePinnedMessages}
                                    sharedContent={activeSharedContent}
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
                {forwardingMessage && (
                    <ForwardMessageDialog
                        conversations={conversations}
                        forwarding={forwarding}
                        message={forwardingMessage}
                        onClose={() => setForwardingMessage(null)}
                        onForward={forwardMessage}
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

function ForwardMessageDialog({
    conversations,
    forwarding,
    message,
    onClose,
    onForward,
}: {
    conversations: Conversation[];
    forwarding: boolean;
    message: MessengerMessage;
    onClose: () => void;
    onForward: (
        message: MessengerMessage,
        conversationIds: number[],
    ) => Promise<boolean>;
}) {
    const [query, setQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const filteredConversations = conversations.filter((conversation) =>
        conversation.display_name.toLowerCase().includes(query.toLowerCase()),
    );
    const canSubmit = selectedIds.length > 0 && !forwarding;

    const toggleConversation = (conversationId: number) => {
        setSelectedIds((ids) =>
            ids.includes(conversationId)
                ? ids.filter((id) => id !== conversationId)
                : [...ids, conversationId],
        );
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canSubmit) {
            return;
        }

        await onForward(message, selectedIds);
    };

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
            <form
                className="flex max-h-[min(680px,calc(100vh-3rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                onSubmit={submit}
            >
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
                    <h2 className="text-base font-semibold text-slate-950">
                        Forward message
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
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <span className="line-clamp-2">
                            {messagePreview(message)}
                        </span>
                    </div>
                    <label className="flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-3 text-slate-400">
                        <Search className="size-4" />
                        <input
                            className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search chats"
                            type="search"
                            value={query}
                        />
                    </label>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {filteredConversations.length > 0 ? (
                        filteredConversations.map((conversation) => {
                            const selected = selectedIds.includes(
                                conversation.id,
                            );

                            return (
                                <button
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                                    key={conversation.id}
                                    onClick={() =>
                                        toggleConversation(conversation.id)
                                    }
                                    type="button"
                                >
                                    <Avatar
                                        label={conversation.display_name}
                                        type={conversation.type}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-slate-950">
                                            {conversation.display_name}
                                        </span>
                                        <span className="block truncate text-xs text-slate-500">
                                            {conversationPreview(
                                                conversation.latest_message,
                                            )}
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
                                <Forward className="size-6" />
                            </span>
                            <h3 className="mt-3 text-sm font-semibold text-slate-900">
                                No chats found
                            </h3>
                        </div>
                    )}
                </div>

                <div className="shrink-0 border-t border-slate-200 p-4">
                    <button
                        className="h-11 w-full rounded-xl bg-[#0054b8] px-4 text-sm font-semibold text-white transition hover:bg-[#004996] disabled:cursor-not-allowed disabled:bg-slate-300"
                        disabled={!canSubmit}
                        type="submit"
                    >
                        {forwarding ? 'Forwarding...' : 'Forward'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function ConversationHeader({
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
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-4 md:px-6">
            <Avatar
                label={conversation.display_name}
                online={online}
                type={conversation.type}
            />
            <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold text-slate-950">
                    {conversation.display_name}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {typingUsers.length > 0 ? (
                        <span className="font-medium text-[#0054b8]">
                            {typingLabel(typingUsers)}
                        </span>
                    ) : (
                        <>
                            <span
                                className={`size-2 rounded-full ${
                                    online ? 'bg-emerald-500' : 'bg-slate-300'
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
                    className="grid size-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    onClick={onOpenMessageSearch}
                    type="button"
                >
                    <Search className="size-4" />
                </button>
                {archived ? (
                    <>
                        <button
                            aria-label="Restore chat"
                            className="grid size-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-[#0054b8]"
                            onClick={() => onRestore(conversation)}
                            type="button"
                        >
                            <ArchiveRestore className="size-4" />
                        </button>
                        <button
                            aria-label="Delete permanently"
                            className="grid size-9 place-items-center rounded-full text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                            onClick={() => onDeleteArchived(conversation)}
                            type="button"
                        >
                            <Trash2 className="size-4" />
                        </button>
                    </>
                ) : (
                    <button
                        aria-label="Archive chat"
                        className="grid size-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
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
                            ? 'bg-sky-50 text-[#0054b8]'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
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
                            ? 'bg-slate-100 text-slate-700'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
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

function ChatDetails({
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

    useEffect(() => {
        setTitle(conversation.title ?? '');
        setAddingMembers(false);
    }, [conversation.id, conversation.title, conversation.participants.length]);

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
                        icon={<Bell className="size-4" />}
                        title="Notifications"
                    />
                    <div className="mt-3 grid grid-cols-3 rounded-xl bg-slate-100 p-1">
                        {(['all', 'mentions', 'muted'] as const).map(
                            (preference) => (
                                <button
                                    className={`rounded-lg px-2 py-2 text-xs font-semibold capitalize transition ${
                                        conversation.notification_preference ===
                                        preference
                                            ? 'bg-white text-[#0054b8] shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800'
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
                    <div className="mt-3 grid grid-cols-3 rounded-xl bg-slate-100 p-1">
                        {tabs.map((tab) => (
                            <button
                                className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                                    activeTab === tab.id
                                        ? 'bg-white text-[#0054b8] shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                type="button"
                            >
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className="ml-1 text-[10px] text-slate-400">
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
                                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0054b8]"
                                    onChange={(event) =>
                                        setTitle(event.target.value)
                                    }
                                    placeholder="Group name"
                                    value={title}
                                />
                                <button
                                    className="rounded-lg bg-[#0054b8] px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-300"
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
                                    className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800"
                                    onClick={() => setAddingMembers(true)}
                                    type="button"
                                >
                                    <UserPlus className="size-4" />
                                    Add members
                                </button>
                            )}

                        <button
                            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-600 hover:bg-rose-50"
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
                                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"
                                key={participant.id}
                            >
                                <span className="relative grid size-9 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                                    {initials(participant.name)}
                                    {onlineUserIds.has(participant.id) && (
                                        <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-white bg-emerald-500" />
                                    )}
                                </span>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-slate-900">
                                        {participant.name}
                                        {participant.id === currentUserId
                                            ? ' (You)'
                                            : ''}
                                    </p>
                                    <p
                                        className={`truncate text-xs ${
                                            onlineUserIds.has(participant.id)
                                                ? 'font-medium text-emerald-600'
                                                : 'text-slate-500 capitalize'
                                        }`}
                                    >
                                        {onlineUserIds.has(participant.id)
                                            ? 'Active now'
                                            : participant.school_role}
                                    </p>
                                </div>
                                {conversation.permissions.can_remove_members &&
                                    participant.id !== currentUserId && (
                                        <button
                                            aria-label={`Remove ${participant.name}`}
                                            className="ml-auto grid size-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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

function AddMembersDialog({
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
            <form
                className="flex max-h-[min(620px,calc(100vh-3rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                onSubmit={submit}
            >
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
                    <h2 className="text-base font-semibold text-slate-950">
                        Add members
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

                <div className="shrink-0 border-b border-slate-100 p-4">
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

function SharedMediaGrid({ media }: { media: SharedAttachment[] }) {
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
                        className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
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
                            <span className="grid size-full place-items-center text-[#0054b8]">
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

function SharedLinksList({ links }: { links: SharedLink[] }) {
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
                    className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 transition hover:border-[#0054b8] hover:bg-sky-50"
                    href={link.url}
                    key={`${link.message_id}-${link.url}`}
                    rel="noreferrer"
                    target="_blank"
                >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-[#0054b8]">
                        <LinkIcon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">
                            {link.host}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                            {link.url}
                        </span>
                    </span>
                </a>
            ))}
        </div>
    );
}

function SharedFilesList({ files }: { files: SharedAttachment[] }) {
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
                    className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 transition hover:border-[#0054b8] hover:bg-sky-50"
                    href={file.url}
                    key={file.id}
                    rel="noreferrer"
                    target="_blank"
                >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-[#0054b8]">
                        <FileText className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">
                            {file.name}
                        </span>
                        <span className="block text-xs text-slate-500">
                            {formatFileSize(file.size)}
                        </span>
                    </span>
                </a>
            ))}
        </div>
    );
}

function PinnedMessagesList({
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
                    className="group flex min-w-0 items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-[#0054b8] hover:bg-sky-50"
                    key={message.id}
                >
                    <button
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        onClick={() => onOpen(message)}
                        type="button"
                    >
                        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-[#0054b8]">
                            <Pin className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-slate-500">
                                {message.sender?.name ?? 'System'} ·{' '}
                                {formatTime(message.pinned_at)}
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-sm leading-5 font-medium text-slate-900">
                                {messagePreview(message)}
                            </span>
                            {message.pinned_by && (
                                <span className="mt-1 block truncate text-[11px] text-slate-500">
                                    Pinned by {message.pinned_by.name}
                                </span>
                            )}
                        </span>
                    </button>
                    {canUnpin && (
                        <button
                            aria-label="Unpin message"
                            className="grid size-8 shrink-0 place-items-center rounded-full text-slate-400 opacity-100 transition hover:bg-white hover:text-[#0054b8] md:opacity-0 md:group-hover:opacity-100"
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

function SharedContentEmpty({
    icon,
    title,
}: {
    icon: React.ReactNode;
    title: string;
}) {
    return (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-white text-slate-400">
                {icon}
            </span>
            <p className="mt-2 text-xs font-semibold text-slate-500">{title}</p>
        </div>
    );
}

function ComposerContext({
    body,
    label,
    onCancel,
}: {
    body: string;
    label: string;
    onCancel: () => void;
}) {
    return (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#0054b8]">
                <Reply className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-[#0054b8]">
                    {label}
                </span>
                <span className="block truncate text-sm text-slate-600">
                    {body}
                </span>
            </span>
            <button
                aria-label="Cancel"
                className="grid size-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                onClick={onCancel}
                type="button"
            >
                <X className="size-4" />
            </button>
        </div>
    );
}

function PinnedMessageBanner({
    canUnpin,
    message,
    onUnpin,
}: {
    canUnpin: boolean;
    message: MessengerMessage;
    onUnpin: (message: MessengerMessage) => void;
}) {
    return (
        <div className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
            <div className="flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#0054b8] shadow-sm">
                    <Pin className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#0054b8]">
                        Pinned message
                    </p>
                    <p className="truncate text-sm text-slate-700">
                        {messagePreview(message)}
                    </p>
                    {message.pinned_by && (
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                            Pinned by {message.pinned_by.name}
                        </p>
                    )}
                </div>
                {canUnpin && (
                    <button
                        aria-label="Unpin message"
                        className="grid size-8 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-white hover:text-[#0054b8]"
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

function MessageBubble({
    canPin,
    currentUserId,
    deliveryStatus,
    message,
    onEdit,
    onForward,
    onPin,
    onReact,
    onReply,
    onUnsend,
}: {
    canPin: boolean;
    currentUserId: number;
    deliveryStatus: string | null;
    message: MessengerMessage;
    onEdit: (message: MessengerMessage) => void;
    onForward: (message: MessengerMessage) => void;
    onPin: (message: MessengerMessage) => void;
    onReact: (message: MessengerMessage, emoji: string) => void;
    onReply: (message: MessengerMessage) => void;
    onUnsend: (message: MessengerMessage) => void;
}) {
    const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
    const system = message.type === 'system';
    const mine = message.sender?.id === currentUserId;
    const unsent = message.unsent_at !== null;
    const handleReaction = (emoji: string) => {
        onReact(message, emoji);
        setReactionPickerOpen(false);
    };

    if (system) {
        return (
            <div className="flex w-full justify-center px-6">
                <div className="max-w-[min(82%,32rem)] rounded-full bg-slate-200/80 px-3 py-1.5 text-center text-xs leading-5 font-medium text-slate-600">
                    {message.body}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`group flex w-full flex-col ${mine ? 'items-end' : 'items-start'}`}
        >
            <div className="relative max-w-[min(82%,34rem)]">
                {!unsent && (
                    <div
                        className={`mb-1 flex gap-1 opacity-100 md:opacity-0 md:transition md:group-focus-within:opacity-100 md:group-hover:opacity-100 ${
                            mine ? 'justify-end' : 'justify-start'
                        }`}
                    >
                        <button
                            aria-label="Reply"
                            className="grid size-7 place-items-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-[#0054b8]"
                            onClick={() => onReply(message)}
                            type="button"
                        >
                            <Reply className="size-3.5" />
                        </button>
                        <button
                            aria-label="Forward"
                            className="grid size-7 place-items-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-[#0054b8]"
                            onClick={() => onForward(message)}
                            type="button"
                        >
                            <Forward className="size-3.5" />
                        </button>
                        {canPin && (
                            <button
                                aria-label={
                                    message.pinned_at
                                        ? 'Unpin message'
                                        : 'Pin message'
                                }
                                className={`grid size-7 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 ${
                                    message.pinned_at
                                        ? 'text-[#0054b8] hover:text-slate-600'
                                        : 'text-slate-500 hover:text-[#0054b8]'
                                }`}
                                onClick={() => onPin(message)}
                                type="button"
                            >
                                {message.pinned_at ? (
                                    <PinOff className="size-3.5" />
                                ) : (
                                    <Pin className="size-3.5" />
                                )}
                            </button>
                        )}
                        {mine && (
                            <>
                                <button
                                    aria-label="Edit"
                                    className="grid size-7 place-items-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-[#0054b8]"
                                    onClick={() => onEdit(message)}
                                    type="button"
                                >
                                    <PencilLine className="size-3.5" />
                                </button>
                                <button
                                    aria-label="Unsend"
                                    className="grid size-7 place-items-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-rose-600"
                                    onClick={() => onUnsend(message)}
                                    type="button"
                                >
                                    <Trash2 className="size-3.5" />
                                </button>
                            </>
                        )}
                    </div>
                )}
                <div
                    className={`relative min-w-0 rounded-2xl px-4 py-3 shadow-sm ${
                        mine
                            ? unsent
                                ? 'rounded-br-md bg-slate-100 text-slate-500'
                                : 'rounded-br-md bg-[#cfe8ff] text-slate-950'
                            : 'rounded-bl-md bg-white text-slate-950'
                    } mb-3`}
                >
                    {!mine && message.sender && (
                        <p className="mb-1 text-xs font-semibold text-[#0054b8]">
                            {message.sender.name}
                        </p>
                    )}
                    {message.reply_to && (
                        <ReplyPreview
                            currentUserId={currentUserId}
                            mine={mine}
                            replyTo={message.reply_to}
                        />
                    )}
                    {unsent ? (
                        <p className="text-sm text-slate-500 italic">
                            {mine
                                ? 'You unsent a message.'
                                : 'This message was unsent.'}
                        </p>
                    ) : (
                        message.body && (
                            <LinkedMessageText text={message.body} />
                        )
                    )}
                    {!unsent && message.attachments.length > 0 && (
                        <div
                            className={
                                message.body ? 'mt-3 space-y-2' : 'space-y-2'
                            }
                        >
                            {message.attachments.map((attachment) => (
                                <MessageAttachmentPreview
                                    attachment={attachment}
                                    key={attachment.id}
                                    mine={mine}
                                />
                            ))}
                        </div>
                    )}
                    <div className="mt-2 text-right text-[11px] text-slate-500">
                        {message.edited_at && !unsent && (
                            <span className="mr-1">Edited</span>
                        )}
                        {formatTime(message.created_at)}
                    </div>
                    {!unsent && (
                        <div className="absolute right-2 -bottom-3 flex max-w-[calc(100%-1rem)] flex-wrap justify-end gap-1">
                            <button
                                aria-label="Add reaction"
                                className="grid size-7 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-100 shadow-sm transition hover:scale-105 hover:text-[#0054b8] md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
                                onClick={() =>
                                    setReactionPickerOpen((open) => !open)
                                }
                                type="button"
                            >
                                <Smile className="size-3.5" />
                            </button>
                            {message.reactions.map((reaction) => (
                                <button
                                    aria-label={`Reacted with ${reaction.emoji}`}
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 shadow-sm transition hover:bg-slate-50"
                                    key={reaction.emoji}
                                    onClick={() =>
                                        handleReaction(reaction.emoji)
                                    }
                                    title={reaction.users
                                        .map((user) => user.name)
                                        .join(', ')}
                                    type="button"
                                >
                                    <span>{reaction.emoji}</span>
                                    <span>{reaction.count}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {reactionPickerOpen && !unsent && (
                    <div
                        className={`absolute bottom-11 z-10 flex gap-1 rounded-full border border-slate-200 bg-white p-1.5 shadow-xl ${
                            mine ? 'right-0' : 'left-0'
                        }`}
                    >
                        {REACTION_OPTIONS.map((emoji) => (
                            <button
                                aria-label={`React with ${emoji}`}
                                className="grid size-9 place-items-center rounded-full text-lg transition hover:scale-125 hover:bg-slate-100"
                                key={emoji}
                                onClick={() => handleReaction(emoji)}
                                type="button"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {deliveryStatus && (
                <p className="mt-1 text-right text-[11px] font-medium text-slate-500">
                    {deliveryStatus}
                </p>
            )}
        </div>
    );
}

function TypingIndicator({ users }: { users: TypingUser[] }) {
    return (
        <div className="flex w-full flex-col items-start">
            <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((index) => (
                        <span
                            className="size-2 animate-bounce rounded-full bg-slate-400"
                            key={index}
                            style={{ animationDelay: `${index * 120}ms` }}
                        />
                    ))}
                </div>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">
                {typingLabel(users)}
            </p>
        </div>
    );
}

function ReplyPreview({
    currentUserId,
    mine,
    replyTo,
}: {
    currentUserId: number;
    mine: boolean;
    replyTo: ReplyToMessage;
}) {
    return (
        <div
            className={`mb-2 rounded-lg border-l-4 border-[#0054b8] px-3 py-2 text-left ${
                mine ? 'bg-white/60' : 'bg-slate-100'
            }`}
        >
            <p className="truncate text-xs font-semibold text-[#0054b8]">
                {replyTo.sender?.id === currentUserId
                    ? 'You'
                    : (replyTo.sender?.name ?? 'Message')}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-600">
                {replyMessagePreview(replyTo)}
            </p>
        </div>
    );
}

function MessageAttachmentPreview({
    attachment,
    mine,
}: {
    attachment: MessageAttachment;
    mine: boolean;
}) {
    const mimeType = attachment.mime_type ?? '';
    const canPreview = attachment.preview_url !== null;
    const isImage = canPreview && mimeType.startsWith('image/');
    const isVideo = canPreview && mimeType.startsWith('video/');
    const isAudio = canPreview && mimeType.startsWith('audio/');
    const shellClass = mine
        ? 'border-sky-200 bg-white/60'
        : 'border-slate-200 bg-slate-50';

    if (isImage) {
        return (
            <div className="space-y-1.5">
                <a
                    className={`block max-w-full overflow-hidden rounded-xl border ${shellClass}`}
                    href={attachment.preview_url ?? attachment.url}
                    rel="noreferrer"
                    target="_blank"
                >
                    <img
                        alt={attachment.name}
                        className="max-h-80 w-full object-contain"
                        loading="lazy"
                        src={attachment.preview_url ?? attachment.url}
                    />
                </a>
                <AttachmentCaption
                    attachment={attachment}
                    icon={<ImageIcon className="size-3.5" />}
                />
            </div>
        );
    }

    if (isVideo) {
        return (
            <div className="space-y-1.5">
                <video
                    className={`max-h-80 w-full max-w-full rounded-xl border ${shellClass}`}
                    controls
                    preload="metadata"
                    src={attachment.preview_url ?? attachment.url}
                />
                <AttachmentCaption
                    attachment={attachment}
                    icon={<Video className="size-3.5" />}
                />
            </div>
        );
    }

    if (isAudio) {
        return (
            <div
                className={`max-w-full rounded-xl border px-3 py-2 ${shellClass}`}
            >
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-600">
                    <Mic className="size-3.5 text-[#0054b8]" />
                    <span className="min-w-0 truncate">{attachment.name}</span>
                </div>
                <audio
                    className="w-full"
                    controls
                    preload="metadata"
                    src={attachment.preview_url ?? attachment.url}
                />
            </div>
        );
    }

    return (
        <a
            className={`flex max-w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                mine
                    ? 'border-sky-200 bg-white/60 hover:bg-white'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
            }`}
            href={attachment.url}
            rel="noreferrer"
            target="_blank"
        >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-[#0054b8]">
                <FileText className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block max-w-full truncate text-sm font-medium">
                    {attachment.name}
                </span>
                <span className="block text-xs text-slate-500">
                    {formatFileSize(attachment.size)}
                </span>
            </span>
        </a>
    );
}

function LinkedMessageText({ text }: { text: string }) {
    return (
        <p className="text-sm leading-6 [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
            {linkifyText(text).map((part, index) =>
                part.type === 'link' ? (
                    <a
                        className="font-medium text-[#0054b8] underline decoration-[#0054b8]/30 underline-offset-2 hover:decoration-[#0054b8]"
                        href={part.href}
                        key={`${part.href}-${index}`}
                        rel="noreferrer"
                        target="_blank"
                    >
                        {part.text}
                    </a>
                ) : (
                    mentionifyText(part.text).map((mentionPart, partIndex) =>
                        mentionPart.type === 'mention' ? (
                            <span
                                className="font-semibold text-[#0054b8]"
                                key={`${mentionPart.text}-${index}-${partIndex}`}
                            >
                                {mentionPart.text}
                            </span>
                        ) : (
                            <span
                                key={`${mentionPart.text}-${index}-${partIndex}`}
                            >
                                {mentionPart.text}
                            </span>
                        ),
                    )
                ),
            )}
        </p>
    );
}

function AttachmentCaption({
    attachment,
    icon,
}: {
    attachment: MessageAttachment;
    icon: React.ReactNode;
}) {
    return (
        <a
            className="flex max-w-full min-w-0 items-center gap-1.5 text-xs text-slate-500 hover:text-[#0054b8]"
            href={attachment.url}
            rel="noreferrer"
            target="_blank"
        >
            {icon}
            <span className="min-w-0 truncate">{attachment.name}</span>
            <span className="shrink-0">{formatFileSize(attachment.size)}</span>
        </a>
    );
}

function Avatar({
    label,
    online = false,
    type,
}: {
    label: string;
    online?: boolean;
    type: Conversation['type'];
}) {
    return (
        <span
            className={`relative grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${
                type === 'direct' ? 'bg-rose-500' : 'bg-[#0054b8]'
            }`}
        >
            {type === 'direct' ? (
                initials(label)
            ) : (
                <UsersRound className="size-5" />
            )}
            {online && (
                <span className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-white bg-emerald-500" />
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

function conversationHasOnlineParticipants(
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

function conversationStatusLabel(
    conversation: Conversation,
    currentUserId: number,
    onlineUserIds: Set<number>,
    fallbackTime?: string | null,
) {
    const onlineParticipants = conversation.participants.filter(
        (participant) =>
            participant.id !== currentUserId &&
            onlineUserIds.has(participant.id),
    );

    if (conversation.type === 'direct') {
        return onlineParticipants.length > 0
            ? 'Active now'
            : fallbackTime
              ? formatTime(fallbackTime)
              : 'Offline';
    }

    if (onlineParticipants.length === 0) {
        return `${conversation.participants.length} members`;
    }

    return `${onlineParticipants.length} active now`;
}

function typingLabel(users: TypingUser[]) {
    if (users.length === 0) {
        return '';
    }

    if (users.length === 1) {
        return `${users[0].name} is typing...`;
    }

    if (users.length === 2) {
        return `${users[0].name} and ${users[1].name} are typing...`;
    }

    return 'Several people are typing...';
}

function typingTimeoutKey(conversationId: number, userId: number) {
    return `${conversationId}:${userId}`;
}

function uniqueUserIds(userIds: number[]) {
    return Array.from(new Set(userIds));
}

function sortConversations(conversations: Conversation[]) {
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

function sortMessagesByCreatedAt(messages: MessengerMessage[]) {
    return [...messages].sort(
        (first, second) =>
            timestamp(first.created_at) - timestamp(second.created_at),
    );
}

function timestamp(value: string | null) {
    return value ? new Date(value).getTime() : 0;
}

function formatTime(value: string | null) {
    if (!value) {
        return 'No activity';
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Manila',
    }).format(new Date(value));
}

function conversationPreview(message: MessengerMessage | null) {
    if (!message) {
        return 'No messages yet';
    }

    return messagePreview(message);
}

function messagePreview(message: MessengerMessage) {
    if (message.unsent_at) {
        return message.sender
            ? `${message.sender.name} unsent a message`
            : 'Message unsent';
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

function replyMessagePreview(replyTo: ReplyToMessage) {
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

function mentionOptionsFor(
    conversation: Conversation | null,
    currentUserId: number,
): MentionOption[] {
    if (!conversation) {
        return [];
    }

    return [
        ...(conversation.permissions.can_mention_everyone
            ? [
                  {
                      id: 'everyone' as const,
                      label: 'Everyone',
                      token: '@everyone',
                      description: 'Notify everyone in this chat',
                  },
              ]
            : []),
        ...conversation.participants
            .filter((participant) => participant.id !== currentUserId)
            .map((participant) => ({
                id: participant.id,
                label: participant.name,
                token: `@${mentionToken(participant.name)}`,
                description: participant.school_role,
            })),
    ];
}

function mentionToken(name: string) {
    return name.trim().replace(/\s+/g, '');
}

function mentionRangeAtCursor(text: string, cursor: number) {
    const beforeCursor = text.slice(0, cursor);
    const match = beforeCursor.match(/(^|\s)@([A-Za-z0-9._-]*)$/);

    if (!match || match.index === undefined) {
        return null;
    }

    const start = match.index + match[1].length;

    return {
        start,
        end: cursor,
        query: match[2] ?? '',
    };
}

function mentionQueryAtCursor(text: string, cursor: number) {
    return mentionRangeAtCursor(text, cursor)?.query ?? null;
}

function mentionifyText(text: string) {
    const parts: Array<
        | {
              type: 'text';
              text: string;
          }
        | {
              type: 'mention';
              text: string;
          }
    > = [];
    const pattern = /(^|\s)(@everyone|@[A-Za-z0-9._-]+)/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        const mention = match[2];
        const start = match.index + match[1].length;

        if (start > lastIndex) {
            parts.push({
                type: 'text',
                text: text.slice(lastIndex, start),
            });
        }

        parts.push({
            type: 'mention',
            text: mention,
        });

        lastIndex = start + mention.length;
    }

    if (lastIndex < text.length) {
        parts.push({
            type: 'text',
            text: text.slice(lastIndex),
        });
    }

    return parts.length > 0 ? parts : [{ type: 'text' as const, text }];
}

function linkifyText(text: string) {
    const parts: Array<
        | {
              type: 'text';
              text: string;
          }
        | {
              type: 'link';
              href: string;
              text: string;
          }
    > = [];
    const pattern = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        const [rawUrl] = match;
        const start = match.index;

        if (start > lastIndex) {
            parts.push({
                type: 'text',
                text: text.slice(lastIndex, start),
            });
        }

        const trailingPunctuation = rawUrl.match(/[.,);\]]+$/)?.[0] ?? '';
        const cleanUrl = trailingPunctuation
            ? rawUrl.slice(0, -trailingPunctuation.length)
            : rawUrl;

        parts.push({
            type: 'link',
            href: cleanUrl.startsWith('http')
                ? cleanUrl
                : `https://${cleanUrl}`,
            text: cleanUrl,
        });

        if (trailingPunctuation) {
            parts.push({
                type: 'text',
                text: trailingPunctuation,
            });
        }

        lastIndex = start + rawUrl.length;
    }

    if (lastIndex < text.length) {
        parts.push({
            type: 'text',
            text: text.slice(lastIndex),
        });
    }

    return parts.length > 0 ? parts : [{ type: 'text' as const, text }];
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

function formatSeenAt(value: string) {
    const seconds = Math.max(
        0,
        Math.floor((Date.now() - new Date(value).getTime()) / 1000),
    );

    if (seconds < 60) {
        return 'Seen Just Now';
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
        return `Seen ${minutes} ${minutes === 1 ? 'Minute' : 'Minutes'} Ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return `Seen ${hours} ${hours === 1 ? 'Hour' : 'Hours'} Ago`;
    }

    const days = Math.floor(hours / 24);

    return `Seen ${days} ${days === 1 ? 'Day' : 'Days'} Ago`;
}

function latestSeenMessageId(
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

function latestDeliveredMessageId(
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

function latestOwnMessageIdFor(
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

function messageDeliveryStatus(
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

function addDeliveryReceipt(
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

function personalizeReactions(
    reactions: MessageReactionSummary[],
    currentUserId: number,
) {
    return reactions.map((reaction) => ({
        ...reaction,
        reacted_by_me: reaction.users.some((user) => user.id === currentUserId),
    }));
}

function personalizeMessage(message: MessengerMessage, currentUserId: number) {
    return {
        ...message,
        reactions: personalizeReactions(message.reactions, currentUserId),
    };
}

function replyToFromMessage(message: MessengerMessage): ReplyToMessage {
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

function latestPinnedMessage(messages: Array<MessengerMessage | null>) {
    return pinnedMessagesList(messages)[0] ?? null;
}

function pinnedMessagesList(messages: Array<MessengerMessage | null>) {
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

function updateConversationMessageSnapshot(
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

function shouldPlayNotificationSound(
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

function messageMentionsUser(
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

function bodyContainsMention(body: string, token: string) {
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

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mapMessages(
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

Messenger.layout = (props: { workspace?: { slug: string } }) => ({
    breadcrumbs: [
        {
            title: 'Messenger',
            href: props.workspace ? `/${props.workspace.slug}/messenger` : '/',
        },
    ],
});
