import { Head, usePage } from '@inertiajs/react';
import { echo } from '@laravel/echo-react';
import {
    Archive,
    ArchiveRestore,
    Bell,
    BellOff,
    Calendar,
    Camera,
    Check,
    CheckCircle2,
    CircleHelp,
    CircleX,
    Clock,
    FileText,
    Forward,
    ImageIcon,
    Inbox,
    Info,
    Link as LinkIcon,
    ListChecks,
    LogOut,
    MapPin,
    MessageCircle,
    Mic,
    Paperclip,
    PencilLine,
    Pin,
    PinOff,
    Plus,
    Reply,
    Search,
    Send,
    Smile,
    Trash2,
    UserMinus,
    UserPlus,
    Users,
    UsersRound,
    Video,
    X,
} from 'lucide-react';
import type { FormEvent } from 'react';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import type { User } from '@/types';

type Participant = {
    id: number;
    name: string;
    email: string;
    school_role: string;
    last_seen_at: string | null;
    nickname: string | null;
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
    can_customize_group: boolean;
};

type Conversation = {
    id: number;
    type: 'direct' | 'group' | 'announcement';
    title: string | null;
    display_name: string;
    photo_url: string | null;
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
    poll: MessagePoll | null;
    event: MessageEvent | null;
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

type LinkPreview = {
    url: string;
    host: string;
    title: string | null;
    description: string | null;
    image_url: string | null;
};

type MessagePoll = {
    question: string;
    allow_multiple: boolean;
    closes_at: string | null;
    total_voters: number;
    options: {
        id: string;
        label: string;
        vote_count: number;
        voted_by_me: boolean;
        voters: { id: number; name: string }[];
    }[];
};

type RsvpStatus = 'attending' | 'maybe' | 'declined';

type MessageEvent = {
    title: string;
    description: string | null;
    starts_at: string;
    location: string | null;
    my_response: RsvpStatus | null;
    responses: Record<RsvpStatus, { id: number; name: string }[]>;
};

type NewPollPayload = {
    question: string;
    options: string[];
    allow_multiple: boolean;
    closes_at: string | null;
};

type NewEventPayload = {
    title: string;
    description: string | null;
    starts_at: string;
    location: string | null;
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
const PRESENCE_HEARTBEAT_INTERVAL_MS = 60_000;
const EMPTY_SHARED_CONTENT: SharedContent = {
    media: [],
    files: [],
    links: [],
};
const subscribeToHydration = () => () => {};

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
        sortConversations(
            initialConversations.map((conversation) =>
                conversation.id === initialConversationId
                    ? {
                          ...conversation,
                          unread_count: 0,
                          unread_mentions_count: 0,
                      }
                    : conversation,
            ),
        ),
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
        useState<number | null>(initialConversationId);
    const [loadingPinnedConversationId, setLoadingPinnedConversationId] =
        useState<number | null>(initialConversationId);
    const [onlineUserIds, setOnlineUserIds] = useState<number[]>([]);
    const [, setRelativeTimeTick] = useState(0);
    const [typingUsersByConversation, setTypingUsersByConversation] = useState<
        Record<number, Record<number, TypingUser>>
    >({});
    const hasHydrated = useSyncExternalStore(
        subscribeToHydration,
        () => true,
        () => false,
    );
    const [sending, setSending] = useState(false);
    const [composerOpen, setComposerOpen] = useState(false);
    const [pollComposerOpen, setPollComposerOpen] = useState(false);
    const [eventComposerOpen, setEventComposerOpen] = useState(false);
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
    const activeMessages = useMemo(
        () =>
            activeConversationId
                ? (messagesByConversation[activeConversationId] ?? [])
                : [],
        [activeConversationId, messagesByConversation],
    );
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
                                  ...applyConversationSystemMessage(
                                      conversation,
                                      message,
                                  ),
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
        setMessageSearch('');
        setMessageSearchOpen(false);
        setMessageSearchResults([]);
        setEditingMessage(null);
        setReplyToMessage(null);
        setMentionQuery(null);
        setMessageBody('');
        setSelectedFiles([]);
        setLoadingSharedConversationId(conversationId);
        setLoadingPinnedConversationId(conversationId);
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

    const createPoll = async (payload: NewPollPayload) => {
        if (!activeConversationId) {
            return false;
        }

        const response = await fetch(
            `${apiBaseUrl}/conversations/${activeConversationId}/polls`,
            {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
                body: JSON.stringify(payload),
            },
        );

        if (!response.ok) {
            window.alert(await apiErrorMessage(response));

            return false;
        }

        const result = (await response.json()) as { data: MessengerMessage };
        appendMessage(result.data);

        return true;
    };

    const createEvent = async (payload: NewEventPayload) => {
        if (!activeConversationId) {
            return false;
        }

        const response = await fetch(
            `${apiBaseUrl}/conversations/${activeConversationId}/events`,
            {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
                body: JSON.stringify(payload),
            },
        );

        if (!response.ok) {
            window.alert(await apiErrorMessage(response));

            return false;
        }

        const result = (await response.json()) as { data: MessengerMessage };
        appendMessage(result.data);

        return true;
    };

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
        const response = await fetch(
            `${apiBaseUrl}/conversations/${message.conversation_id}/messages/${message.id}/poll-vote`,
            {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
                body: JSON.stringify({ option_ids: optionIds }),
            },
        );

        if (response.ok) {
            const result = (await response.json()) as {
                data: MessengerMessage;
            };
            replaceMessage(result.data);
        }
    };

    const respondToEvent = async (
        message: MessengerMessage,
        status: RsvpStatus,
    ) => {
        const response = await fetch(
            `${apiBaseUrl}/conversations/${message.conversation_id}/messages/${message.id}/rsvp`,
            {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
                body: JSON.stringify({
                    status:
                        message.event?.my_response === status ? null : status,
                }),
            },
        );

        if (response.ok) {
            const result = (await response.json()) as {
                data: MessengerMessage;
            };
            replaceMessage(result.data);
        }
    };

    useEffect(() => {
        activeConversationIdRef.current = activeConversationId;
    }, [activeConversationId]);

    useEffect(() => {
        const heartbeat = () => {
            if (document.visibilityState === 'hidden') {
                return;
            }

            void fetch(`${apiBaseUrl}/presence`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
                keepalive: true,
            });
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                heartbeat();
            }
        };

        heartbeat();
        const heartbeatInterval = window.setInterval(
            heartbeat,
            PRESENCE_HEARTBEAT_INTERVAL_MS,
        );
        const relativeTimeInterval = window.setInterval(
            () => setRelativeTimeTick((tick) => tick + 1),
            PRESENCE_HEARTBEAT_INTERVAL_MS,
        );
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearInterval(heartbeatInterval);
            window.clearInterval(relativeTimeInterval);
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
        };
    }, [apiBaseUrl]);

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
                const lastSeenAt = new Date().toISOString();

                setConversations((items) =>
                    items.map((conversation) => ({
                        ...conversation,
                        participants: conversation.participants.map(
                            (participant) =>
                                participant.id === user.id
                                    ? {
                                          ...participant,
                                          last_seen_at: lastSeenAt,
                                      }
                                    : participant,
                        ),
                    })),
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
        const typingTimeouts = typingTimeoutsRef.current;
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
            const existingTimeout = typingTimeouts[key];

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

            typingTimeouts[key] = window.setTimeout(() => {
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

            Object.keys(typingTimeouts)
                .filter((key) => key.startsWith(`${conversationId}:`))
                .forEach((key) => {
                    window.clearTimeout(typingTimeouts[key]);
                    delete typingTimeouts[key];
                });
        };
    }, [activeConversationId, auth.user.id, removeTypingUser]);

    useEffect(() => {
        const typingTimeouts = typingTimeoutsRef.current;

        return () => {
            stopOwnTyping(activeConversationIdRef.current);
            Object.values(typingTimeouts).forEach((timeout) => {
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

    const fetchMessages = useCallback(
        async (conversationId: number) => {
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

            const payload = (await response.json()) as {
                data: MessengerMessage[];
            };
            payload.data.forEach((message) => {
                seenMessageIdsRef.current.add(message.id);
            });
            loadedConversationIdsRef.current.add(conversationId);

            setMessagesByConversation((messages) => ({
                ...messages,
                [conversationId]: [...payload.data].reverse(),
            }));
        },
        [apiBaseUrl],
    );

    const markConversationRead = useCallback(
        async (conversationId: number) => {
            await fetch(`${apiBaseUrl}/conversations/${conversationId}/read`, {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
            });
        },
        [apiBaseUrl],
    );

    const markMessageDelivered = useCallback(
        async (message: MessengerMessage) => {
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
        },
        [apiBaseUrl],
    );

    const searchMessages = useCallback(
        async (conversationId: number, query: string) => {
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
        },
        [apiBaseUrl],
    );

    const fetchSharedContent = useCallback(
        async (conversationId: number) => {
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
        },
        [apiBaseUrl],
    );

    const fetchPinnedMessages = useCallback(
        async (conversationId: number) => {
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
        },
        [apiBaseUrl],
    );

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeConversationId, activeMessages.length]);

    useEffect(() => {
        if (!activeConversationId) {
            return;
        }

        void markConversationRead(activeConversationId);
    }, [activeConversationId, activeMessages.length, markConversationRead]);

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
    }, [
        activeConversationId,
        activeMessages,
        auth.user.id,
        markMessageDelivered,
    ]);

    useEffect(() => {
        if (
            !activeConversationId ||
            loadedConversationIdsRef.current.has(activeConversationId)
        ) {
            return;
        }

        void fetchMessages(activeConversationId);
    }, [activeConversationId, fetchMessages]);

    useEffect(() => {
        if (!activeConversationId) {
            return;
        }

        void fetchSharedContent(activeConversationId);
    }, [activeConversationId, activeMessages.length, fetchSharedContent]);

    useEffect(() => {
        if (!activeConversationId) {
            return;
        }

        void fetchPinnedMessages(activeConversationId);
    }, [activeConversationId, fetchPinnedMessages]);

    useEffect(() => {
        if (!activeConversationId || !messageSearchOpen || !messageSearchTerm) {
            return;
        }

        const timeout = window.setTimeout(() => {
            void searchMessages(activeConversationId, messageSearchTerm);
        }, 250);

        return () => window.clearTimeout(timeout);
    }, [
        activeConversationId,
        messageSearchOpen,
        messageSearchTerm,
        searchMessages,
    ]);

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

    const updateConversationPhoto = async (
        conversation: Conversation,
        photo: File,
    ) => {
        const formData = new FormData();
        formData.append('photo', photo);
        const response = await fetch(
            `${apiBaseUrl}/conversations/${conversation.id}/photo`,
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
            return false;
        }

        const payload = (await response.json()) as ConversationMutationPayload;
        replaceConversation(payload.data);

        if (payload.system_message) {
            appendMessage(payload.system_message);
        }

        return true;
    };

    const removeConversationPhoto = async (conversation: Conversation) => {
        const response = await fetch(
            `${apiBaseUrl}/conversations/${conversation.id}/photo`,
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

    const updateParticipantNickname = async (
        conversation: Conversation,
        userId: number,
        nickname: string | null,
    ) => {
        const response = await fetch(
            `${apiBaseUrl}/conversations/${conversation.id}/members/${userId}/nickname`,
            {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN'),
                },
                body: JSON.stringify({ nickname }),
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
            <div className="flex h-[calc(100vh-6.5rem)] min-h-[680px] flex-col overflow-hidden bg-card">
                <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            {workspace.name}
                        </p>
                        <h1 className="truncate text-2xl font-bold text-foreground">
                            {archived ? 'Archived' : 'Chat'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            aria-label={archived ? 'Back to inbox' : 'Archive'}
                            className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
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
                                className="grid size-10 place-items-center rounded-full bg-brand-solid text-white shadow-sm transition hover:bg-brand-solid/90"
                                onClick={() => setComposerOpen(true)}
                                type="button"
                            >
                                <PencilLine className="size-5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_320px]">
                    <aside className="hidden min-h-0 border-r border-border bg-card lg:flex lg:flex-col">
                        <div className="border-b border-border p-4">
                            <div className="mb-3 flex items-center">
                                <h2 className="text-lg font-bold text-foreground">
                                    {archived ? 'Archives' : 'Chats'}
                                </h2>
                            </div>
                            <label className="flex h-10 items-center gap-2 rounded-lg bg-muted px-3 text-muted-foreground">
                                <Search className="size-4" />
                                <input
                                    className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
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
                                            className={`flex w-full gap-3 border-b border-border px-4 py-4 text-left transition ${
                                                conversation.id ===
                                                activeConversationId
                                                    ? 'bg-brand/10'
                                                    : 'bg-card hover:bg-muted/40'
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
                                                photoUrl={
                                                    conversation.photo_url
                                                }
                                                type={conversation.type}
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-3">
                                                    <p className="truncate text-sm font-semibold text-foreground">
                                                        {
                                                            conversation.display_name
                                                        }
                                                    </p>
                                                    <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                                                        {conversation.pinned_at && (
                                                            <Pin className="size-3.5 text-brand" />
                                                        )}
                                                        {conversation.muted_at && (
                                                            <BellOff className="size-3.5" />
                                                        )}
                                                    </span>
                                                    {conversation.unread_count >
                                                        0 && (
                                                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-solid text-[10px] font-bold text-white">
                                                            {
                                                                conversation.unread_count
                                                            }
                                                        </span>
                                                    )}
                                                    {conversation.unread_mentions_count >
                                                        0 && (
                                                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-amber-400 text-[11px] font-bold text-amber-950">
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
                                                        ? typingLabel(
                                                              typingUsers,
                                                          )
                                                        : conversationPreview(
                                                              conversation.latest_message,
                                                          )}
                                                </p>
                                                <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                                                    {conversationStatusLabel(
                                                        conversation,
                                                        auth.user.id,
                                                        onlineUserIdsSet,
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

                    <section className="flex min-h-0 flex-col bg-background">
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
                                    <div className="border-b border-border bg-card px-4 py-3 md:px-6">
                                        <label className="flex h-10 items-center gap-2 rounded-lg bg-muted px-3 text-muted-foreground">
                                            <Search className="size-4" />
                                            <input
                                                autoFocus
                                                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
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
                                                className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
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
                                                        ? 'bg-brand/15 ring-2 ring-brand/30'
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
                                                    conversation={
                                                        activeConversation
                                                    }
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
                                                    onRsvp={respondToEvent}
                                                    onUnsend={unsendMessage}
                                                    onVote={votePoll}
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
                                    className="shrink-0 border-t border-border bg-card p-4"
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
                                                        className="inline-flex max-w-full items-center gap-2 rounded-full bg-muted px-3 py-2 text-xs font-medium text-foreground"
                                                        key={`${file.name}-${file.lastModified}-${index}`}
                                                    >
                                                        <FileText className="size-3.5 shrink-0" />
                                                        <span className="max-w-48 truncate">
                                                            {file.name}
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            {formatFileSize(
                                                                file.size,
                                                            )}
                                                        </span>
                                                        <button
                                                            aria-label={`Remove ${file.name}`}
                                                            className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
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
                                            <div className="mb-3 max-h-56 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-lg">
                                                {filteredMentionOptions.map(
                                                    (option) => (
                                                        <button
                                                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted/40"
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
                                                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                                                                {option.id ===
                                                                'everyone'
                                                                    ? '@'
                                                                    : initials(
                                                                          option.label,
                                                                      )}
                                                            </span>
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block truncate text-sm font-semibold text-foreground">
                                                                    {
                                                                        option.token
                                                                    }
                                                                </span>
                                                                <span className="block truncate text-xs text-muted-foreground">
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
                                            className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                                            onClick={() =>
                                                fileInputRef.current?.click()
                                            }
                                            disabled={isEditing}
                                            type="button"
                                        >
                                            <Paperclip className="size-5" />
                                        </button>
                                        <button
                                            aria-label="Create poll"
                                            className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-brand"
                                            disabled={isEditing}
                                            onClick={() =>
                                                setPollComposerOpen(true)
                                            }
                                            type="button"
                                        >
                                            <ListChecks className="size-5" />
                                        </button>
                                        <button
                                            aria-label="Create event"
                                            className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-brand"
                                            disabled={isEditing}
                                            onClick={() =>
                                                setEventComposerOpen(true)
                                            }
                                            type="button"
                                        >
                                            <Calendar className="size-5" />
                                        </button>
                                        <input
                                            className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-muted/40 px-4 text-sm transition outline-none focus:border-brand focus:bg-card"
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
                                            className="grid size-11 place-items-center rounded-full bg-brand-solid text-white shadow-sm transition hover:bg-brand-solid/90 disabled:cursor-not-allowed disabled:bg-muted"
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

                    <aside className="hidden min-h-0 border-l border-border bg-card xl:flex xl:flex-col">
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
                                    onRemovePhoto={removeConversationPhoto}
                                    onUpdateNickname={updateParticipantNickname}
                                    onUpdatePhoto={updateConversationPhoto}
                                    onOpenPinnedMessage={openPinnedMessage}
                                    onUnpinPinnedMessage={toggleMessagePin}
                                    pinnedMessages={activePinnedMessages}
                                    sharedContent={activeSharedContent}
                                    key={`${activeConversation.id}:${activeConversation.title ?? ''}:${activeConversation.participants.map((participant) => participant.id).join(',')}`}
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
                {pollComposerOpen && (
                    <PollComposer
                        onClose={() => setPollComposerOpen(false)}
                        onCreate={createPoll}
                    />
                )}
                {eventComposerOpen && (
                    <EventComposer
                        onClose={() => setEventComposerOpen(false)}
                        onCreate={createEvent}
                    />
                )}
            </div>
        </>
    );
}

function PollComposer({
    onClose,
    onCreate,
}: {
    onClose: () => void;
    onCreate: (payload: NewPollPayload) => Promise<boolean>;
}) {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);
    const [allowMultiple, setAllowMultiple] = useState(false);
    const [closesAt, setClosesAt] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const usableOptions = options
        .map((option) => option.trim())
        .filter(Boolean);
    const canSubmit = question.trim() !== '' && usableOptions.length >= 2;

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canSubmit || submitting) {
            return;
        }

        setSubmitting(true);
        const created = await onCreate({
            question: question.trim(),
            options: usableOptions,
            allow_multiple: allowMultiple,
            closes_at: closesAt ? new Date(closesAt).toISOString() : null,
        });
        setSubmitting(false);

        if (created) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
            <form
                aria-labelledby="poll-composer-title"
                aria-modal="true"
                className="flex max-h-[min(720px,calc(100vh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
                onSubmit={submit}
                role="dialog"
            >
                <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand">
                        <ListChecks className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2
                            className="text-lg font-bold text-foreground"
                            id="poll-composer-title"
                        >
                            New poll
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Get a quick decision from everyone.
                        </p>
                    </div>
                    <button
                        aria-label="Close"
                        className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
                    <label className="block">
                        <span className="flex items-center justify-between text-sm font-semibold text-foreground">
                            Question
                            <span className="text-xs font-normal text-muted-foreground">
                                {question.length}/300
                            </span>
                        </span>
                        <textarea
                            autoFocus
                            className="mt-2 min-h-20 w-full resize-none rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm leading-6 transition outline-none placeholder:text-muted-foreground focus:border-brand focus:bg-card focus:ring-4 focus:ring-brand/10"
                            maxLength={300}
                            onChange={(event) =>
                                setQuestion(event.target.value)
                            }
                            placeholder="Ask a clear question…"
                            value={question}
                        />
                    </label>

                    <div>
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">
                                Answer choices
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {usableOptions.length} of 10
                            </p>
                        </div>
                        <div className="mt-2 space-y-2">
                            {options.map((option, index) => (
                                <div
                                    className="group flex items-center gap-2"
                                    key={index}
                                >
                                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                                        {index + 1}
                                    </span>
                                    <input
                                        className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-sm transition outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                                        maxLength={120}
                                        onChange={(event) =>
                                            setOptions((items) =>
                                                items.map((item, itemIndex) =>
                                                    itemIndex === index
                                                        ? event.target.value
                                                        : item,
                                                ),
                                            )
                                        }
                                        placeholder={`Choice ${index + 1}`}
                                        value={option}
                                    />
                                    {options.length > 2 && (
                                        <button
                                            aria-label={`Remove choice ${index + 1}`}
                                            className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                                            onClick={() =>
                                                setOptions((items) =>
                                                    items.filter(
                                                        (_item, itemIndex) =>
                                                            itemIndex !== index,
                                                    ),
                                                )
                                            }
                                            type="button"
                                        >
                                            <X className="size-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        {options.length < 10 && (
                            <button
                                className="mt-3 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand/10"
                                onClick={() =>
                                    setOptions((items) => [...items, ''])
                                }
                                type="button"
                            >
                                <Plus className="size-4" /> Add another choice
                            </button>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border p-3 transition hover:bg-muted/30">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                                <ListChecks className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-foreground">
                                    Multiple answers
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                    People can select more than one choice
                                </span>
                            </span>
                            <input
                                checked={allowMultiple}
                                className="size-4 accent-[var(--brand-solid)]"
                                onChange={(event) =>
                                    setAllowMultiple(event.target.checked)
                                }
                                type="checkbox"
                            />
                        </label>
                        <label className="block rounded-2xl border border-border p-3">
                            <span className="flex items-center gap-3">
                                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                                    <Clock className="size-4" />
                                </span>
                                <span>
                                    <span className="block text-sm font-semibold text-foreground">
                                        Voting deadline
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                        Optional — leave empty to keep it open
                                    </span>
                                </span>
                            </span>
                            <input
                                className="mt-3 h-10 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm font-normal transition outline-none focus:border-brand focus:bg-card focus:ring-4 focus:ring-brand/10"
                                min={localDateTimeInputValue(1)}
                                onChange={(event) =>
                                    setClosesAt(event.target.value)
                                }
                                type="datetime-local"
                                value={closesAt}
                            />
                        </label>
                    </div>
                </div>

                <div className="flex shrink-0 gap-3 border-t border-border bg-muted/30 p-4">
                    <button
                        className="h-11 flex-1 rounded-xl border border-border bg-card text-sm font-semibold text-foreground transition hover:bg-muted"
                        onClick={onClose}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="h-11 flex-[1.4] rounded-xl bg-brand-solid text-sm font-semibold text-white shadow-sm transition hover:bg-brand-solid/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                        disabled={!canSubmit || submitting}
                        type="submit"
                    >
                        {submitting ? 'Publishing…' : 'Publish poll'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function EventComposer({
    onClose,
    onCreate,
}: {
    onClose: () => void;
    onCreate: (payload: NewEventPayload) => Promise<boolean>;
}) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startsAt, setStartsAt] = useState('');
    const [location, setLocation] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const canSubmit = title.trim() !== '' && startsAt !== '';

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canSubmit || submitting) {
            return;
        }

        setSubmitting(true);
        const created = await onCreate({
            title: title.trim(),
            description: description.trim() || null,
            starts_at: new Date(startsAt).toISOString(),
            location: location.trim() || null,
        });
        setSubmitting(false);

        if (created) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
            <form
                aria-labelledby="event-composer-title"
                aria-modal="true"
                className="flex max-h-[min(700px,calc(100vh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
                onSubmit={submit}
                role="dialog"
            >
                <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand">
                        <Calendar className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2
                            className="text-lg font-bold text-foreground"
                            id="event-composer-title"
                        >
                            New event
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Share the details and collect RSVPs.
                        </p>
                    </div>
                    <button
                        aria-label="Close"
                        className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
                    <label className="block">
                        <span className="text-sm font-semibold text-foreground">
                            Event name
                        </span>
                        <input
                            autoFocus
                            className="mt-2 h-12 w-full rounded-2xl border border-border bg-muted/30 px-4 text-sm transition outline-none placeholder:text-muted-foreground focus:border-brand focus:bg-card focus:ring-4 focus:ring-brand/10"
                            maxLength={200}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="e.g. Parent–teacher meeting"
                            value={title}
                        />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                <Clock className="size-4 text-brand" /> Date and
                                time
                            </span>
                            <input
                                className="mt-2 h-12 w-full rounded-2xl border border-border bg-card px-3 text-sm transition outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                                min={localDateTimeInputValue(1)}
                                onChange={(event) =>
                                    setStartsAt(event.target.value)
                                }
                                type="datetime-local"
                                value={startsAt}
                            />
                        </label>
                        <label className="block">
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                <MapPin className="size-4 text-brand" />{' '}
                                Location
                                <span className="font-normal text-muted-foreground">
                                    · optional
                                </span>
                            </span>
                            <input
                                className="mt-2 h-12 w-full rounded-2xl border border-border bg-card px-3 text-sm transition outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-4 focus:ring-brand/10"
                                maxLength={240}
                                onChange={(event) =>
                                    setLocation(event.target.value)
                                }
                                placeholder="Room or online link"
                                value={location}
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className="flex items-center justify-between text-sm font-semibold text-foreground">
                            Details
                            <span className="font-normal text-muted-foreground">
                                Optional
                            </span>
                        </span>
                        <textarea
                            className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-border bg-muted/30 p-4 text-sm leading-6 transition outline-none placeholder:text-muted-foreground focus:border-brand focus:bg-card focus:ring-4 focus:ring-brand/10"
                            maxLength={2000}
                            onChange={(event) =>
                                setDescription(event.target.value)
                            }
                            placeholder="Add an agenda, reminders, or anything guests should know…"
                            value={description}
                        />
                    </label>

                    <div className="flex items-start gap-3 rounded-2xl bg-brand/10 p-3 text-sm text-foreground">
                        <Users className="mt-0.5 size-4 shrink-0 text-brand" />
                        <p className="leading-5">
                            Everyone in this conversation can respond with
                            <span className="font-semibold"> Going</span>,
                            <span className="font-semibold"> Maybe</span>, or
                            <span className="font-semibold"> Can’t go</span>.
                        </p>
                    </div>
                </div>

                <div className="flex shrink-0 gap-3 border-t border-border bg-muted/30 p-4">
                    <button
                        className="h-11 flex-1 rounded-xl border border-border bg-card text-sm font-semibold text-foreground transition hover:bg-muted"
                        onClick={onClose}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="h-11 flex-[1.4] rounded-xl bg-brand-solid text-sm font-semibold text-white shadow-sm transition hover:bg-brand-solid/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                        disabled={!canSubmit || submitting}
                        type="submit"
                    >
                        {submitting ? 'Publishing…' : 'Publish event'}
                    </button>
                </div>
            </form>
        </div>
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 py-6 backdrop-blur-sm">
            <form
                className="flex max-h-[min(680px,calc(100vh-3rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
                onSubmit={submit}
            >
                <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                    <h2 className="text-base font-semibold text-foreground">
                        New message
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

                <div className="shrink-0 space-y-3 border-b border-border p-4">
                    <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
                        {(['direct', 'group'] as const).map((item) => (
                            <button
                                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                    mode === item
                                        ? 'bg-card text-brand shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
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
                            className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm transition outline-none focus:border-brand"
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Group name"
                            value={title}
                        />
                    )}

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
                                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-rose-500 text-sm font-bold text-white">
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
                                                ? 'border-brand bg-brand-solid text-white'
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
                            <p className="mt-1 max-w-72 text-sm leading-6 text-muted-foreground">
                                Team members will appear here when they are
                                added to this school.
                            </p>
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
                        className="h-11 w-full rounded-xl bg-brand-solid px-4 text-sm font-semibold text-white transition hover:bg-brand-solid/90 disabled:cursor-not-allowed disabled:bg-muted"
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 py-6 backdrop-blur-sm">
            <form
                className="flex max-h-[min(680px,calc(100vh-3rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
                onSubmit={submit}
            >
                <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                    <h2 className="text-base font-semibold text-foreground">
                        Forward message
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

                <div className="shrink-0 space-y-3 border-b border-border p-4">
                    <div className="rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        <span className="line-clamp-2">
                            {messagePreview(message)}
                        </span>
                    </div>
                    <label className="flex h-11 items-center gap-2 rounded-xl bg-muted px-3 text-muted-foreground">
                        <Search className="size-4" />
                        <input
                            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
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
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-muted/40"
                                    key={conversation.id}
                                    onClick={() =>
                                        toggleConversation(conversation.id)
                                    }
                                    type="button"
                                >
                                    <Avatar
                                        label={conversation.display_name}
                                        photoUrl={conversation.photo_url}
                                        type={conversation.type}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-foreground">
                                            {conversation.display_name}
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {conversationPreview(
                                                conversation.latest_message,
                                            )}
                                        </span>
                                    </span>
                                    <span
                                        className={`grid size-6 shrink-0 place-items-center rounded-full border ${
                                            selected
                                                ? 'border-brand bg-brand-solid text-white'
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
                                <Forward className="size-6" />
                            </span>
                            <h3 className="mt-3 text-sm font-semibold text-foreground">
                                No chats found
                            </h3>
                        </div>
                    )}
                </div>

                <div className="shrink-0 border-t border-border p-4">
                    <button
                        className="h-11 w-full rounded-xl bg-brand-solid px-4 text-sm font-semibold text-white transition hover:bg-brand-solid/90 disabled:cursor-not-allowed disabled:bg-muted"
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
                                    online ? 'bg-emerald-500' : 'bg-muted'
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
                                    className="rounded-lg bg-brand-solid px-3 py-2 text-xs font-semibold text-white disabled:bg-muted"
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
                                        <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-card bg-emerald-500" />
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
                                                ? 'font-medium text-emerald-600 dark:text-emerald-400'
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
                                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-rose-500 text-sm font-bold text-white">
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
                                                ? 'border-brand bg-brand-solid text-white'
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
                        className="h-11 w-full rounded-xl bg-brand-solid px-4 text-sm font-semibold text-white transition hover:bg-brand-solid/90 disabled:cursor-not-allowed disabled:bg-muted"
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

function SharedContentEmpty({
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
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-brand">
                <Reply className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-brand">
                    {label}
                </span>
                <span className="block truncate text-sm text-muted-foreground">
                    {body}
                </span>
            </span>
            <button
                aria-label="Cancel"
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
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

function MessageBubble({
    canPin,
    conversation,
    currentUserId,
    deliveryStatus,
    message,
    onEdit,
    onForward,
    onPin,
    onReact,
    onReply,
    onRsvp,
    onUnsend,
    onVote,
}: {
    canPin: boolean;
    conversation: Conversation;
    currentUserId: number;
    deliveryStatus: string | null;
    message: MessengerMessage;
    onEdit: (message: MessengerMessage) => void;
    onForward: (message: MessengerMessage) => void;
    onPin: (message: MessengerMessage) => void;
    onReact: (message: MessengerMessage, emoji: string) => void;
    onReply: (message: MessengerMessage) => void;
    onRsvp: (message: MessengerMessage, status: RsvpStatus) => void;
    onUnsend: (message: MessengerMessage) => void;
    onVote: (message: MessengerMessage, optionId: string) => void;
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
                <div className="max-w-[min(82%,32rem)] rounded-full bg-muted/80 px-3 py-1.5 text-center text-xs leading-5 font-medium text-muted-foreground">
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
                            className="grid size-7 place-items-center rounded-full bg-card text-muted-foreground shadow-sm ring-1 ring-border hover:text-brand"
                            onClick={() => onReply(message)}
                            type="button"
                        >
                            <Reply className="size-3.5" />
                        </button>
                        <button
                            aria-label="Forward"
                            className="grid size-7 place-items-center rounded-full bg-card text-muted-foreground shadow-sm ring-1 ring-border hover:text-brand"
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
                                className={`grid size-7 place-items-center rounded-full bg-card shadow-sm ring-1 ring-border ${
                                    message.pinned_at
                                        ? 'text-brand hover:text-muted-foreground'
                                        : 'text-muted-foreground hover:text-brand'
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
                                {['text', 'attachment'].includes(
                                    message.type,
                                ) && (
                                    <button
                                        aria-label="Edit"
                                        className="grid size-7 place-items-center rounded-full bg-card text-muted-foreground shadow-sm ring-1 ring-border hover:text-brand"
                                        onClick={() => onEdit(message)}
                                        type="button"
                                    >
                                        <PencilLine className="size-3.5" />
                                    </button>
                                )}
                                <button
                                    aria-label="Unsend"
                                    className="grid size-7 place-items-center rounded-full bg-card text-muted-foreground shadow-sm ring-1 ring-border hover:text-rose-600 dark:hover:text-rose-400"
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
                                ? 'rounded-br-md bg-muted text-muted-foreground'
                                : 'rounded-br-md bg-message-outgoing text-foreground'
                            : 'rounded-bl-md bg-card text-foreground'
                    } mb-3`}
                >
                    {!mine && message.sender && (
                        <p className="mb-1 text-xs font-semibold text-brand">
                            {participantDisplayName(
                                conversation,
                                message.sender.id,
                                message.sender.name,
                            )}
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
                        <p className="text-sm text-muted-foreground italic">
                            {mine
                                ? 'You unsent a message.'
                                : 'This message was unsent.'}
                        </p>
                    ) : (
                        message.body &&
                        !message.poll &&
                        !message.event && (
                            <LinkedMessageText text={message.body} />
                        )
                    )}
                    {!unsent && message.poll && (
                        <PollCard
                            message={message}
                            onVote={(optionId) => onVote(message, optionId)}
                        />
                    )}
                    {!unsent && message.event && (
                        <EventCard
                            event={message.event}
                            onRsvp={(status) => onRsvp(message, status)}
                        />
                    )}
                    {!unsent && messageLinkPreviews(message).length > 0 && (
                        <div className="mt-3 space-y-2">
                            {messageLinkPreviews(message).map((preview) => (
                                <LinkPreviewCard
                                    key={preview.url}
                                    preview={preview}
                                />
                            ))}
                        </div>
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
                    <div className="mt-2 text-right text-[11px] text-muted-foreground">
                        {message.edited_at && !unsent && (
                            <span className="mr-1">Edited</span>
                        )}
                        {formatTime(message.created_at)}
                    </div>
                    {!unsent && (
                        <div className="absolute right-2 -bottom-3 flex max-w-[calc(100%-1rem)] flex-wrap justify-end gap-1">
                            <button
                                aria-label="Add reaction"
                                className="grid size-7 place-items-center rounded-full border border-border bg-card text-muted-foreground opacity-100 shadow-sm transition hover:scale-105 hover:text-brand md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
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
                                    aria-pressed={reaction.reacted_by_me}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs shadow-sm transition ${
                                        reaction.reacted_by_me
                                            ? 'border-brand/40 bg-brand/15 text-brand hover:bg-brand/20'
                                            : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                                    }`}
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
                        className={`absolute bottom-11 z-10 flex gap-1 rounded-full border border-border bg-card p-1.5 shadow-xl ${
                            mine ? 'right-0' : 'left-0'
                        }`}
                    >
                        {REACTION_OPTIONS.map((emoji) => (
                            <button
                                aria-label={`React with ${emoji}`}
                                className="grid size-9 place-items-center rounded-full text-lg transition hover:scale-125 hover:bg-muted"
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
                <p className="mt-1 text-right text-[11px] font-medium text-muted-foreground">
                    {deliveryStatus}
                </p>
            )}
        </div>
    );
}

function PollCard({
    message,
    onVote,
}: {
    message: MessengerMessage;
    onVote: (optionId: string) => void;
}) {
    const poll = message.poll;
    const [currentTime, setCurrentTime] = useState<number | null>(null);

    useEffect(() => {
        const updateCurrentTime = () => setCurrentTime(Date.now());

        updateCurrentTime();
        const interval = window.setInterval(updateCurrentTime, 60_000);

        return () => window.clearInterval(interval);
    }, []);

    if (!poll) {
        return null;
    }

    const closed =
        poll.closes_at && currentTime !== null
            ? new Date(poll.closes_at).getTime() <= currentTime
            : false;

    const voters = uniquePeople(
        poll.options.flatMap((option) => option.voters),
    );

    return (
        <div className="w-[min(22rem,72vw)] min-w-64">
            <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-brand uppercase">
                    <ListChecks className="size-3.5" /> Poll
                </span>
                <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase ${
                        closed
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    }`}
                >
                    {closed ? 'Closed' : 'Open'}
                </span>
            </div>
            <h3 className="mt-2 text-base leading-6 font-bold text-foreground">
                {poll.question}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
                {closed
                    ? 'Voting has ended'
                    : poll.allow_multiple
                      ? 'Select all answers that apply'
                      : 'Select one answer'}
            </p>

            <div className="mt-4 space-y-2.5">
                {poll.options.map((option) => {
                    const percent =
                        poll.total_voters > 0
                            ? Math.round(
                                  (option.vote_count / poll.total_voters) * 100,
                              )
                            : 0;

                    return (
                        <button
                            aria-label={`${option.label}, ${option.vote_count} votes`}
                            aria-pressed={option.voted_by_me}
                            className={`group/option relative w-full overflow-hidden rounded-xl border p-3 text-left transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:cursor-default ${
                                option.voted_by_me
                                    ? 'border-brand/60 bg-brand/10 shadow-sm'
                                    : 'border-border bg-card/70 hover:border-brand/40 hover:bg-card'
                            }`}
                            disabled={closed}
                            key={option.id}
                            onClick={() => onVote(option.id)}
                            title={option.voters
                                .map((voter) => voter.name)
                                .join(', ')}
                            type="button"
                        >
                            <span
                                className="absolute inset-y-0 left-0 bg-brand/8 transition-[width] duration-300"
                                style={{ width: `${percent}%` }}
                            />
                            <span className="relative flex items-center gap-3">
                                <span
                                    className={`grid size-5 shrink-0 place-items-center border-2 transition ${
                                        poll.allow_multiple
                                            ? 'rounded-md'
                                            : 'rounded-full'
                                    } ${
                                        option.voted_by_me
                                            ? 'border-brand bg-brand-solid text-white'
                                            : 'border-muted-foreground/40 bg-card'
                                    }`}
                                >
                                    {option.voted_by_me && (
                                        <Check className="size-3" />
                                    )}
                                </span>
                                <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                                    {option.label}
                                </span>
                                <span className="shrink-0 text-right">
                                    <span className="block text-sm font-bold text-foreground">
                                        {percent}%
                                    </span>
                                    <span className="block text-[10px] text-muted-foreground">
                                        {option.vote_count}{' '}
                                        {option.vote_count === 1
                                            ? 'vote'
                                            : 'votes'}
                                    </span>
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                <div className="flex min-w-0 items-center gap-2">
                    <PeopleStack people={voters} />
                    <span className="truncate text-xs font-medium text-muted-foreground">
                        {poll.total_voters === 0
                            ? 'Be the first to vote'
                            : `${poll.total_voters} ${poll.total_voters === 1 ? 'voter' : 'voters'}`}
                    </span>
                </div>
                {poll.closes_at && (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="size-3" />
                        {closed
                            ? 'Ended'
                            : `Ends ${formatShortDate(poll.closes_at)}`}
                    </span>
                )}
            </div>
        </div>
    );
}

function EventCard({
    event,
    onRsvp,
}: {
    event: MessageEvent;
    onRsvp: (status: RsvpStatus) => void;
}) {
    const choices: Array<{
        status: RsvpStatus;
        label: string;
        icon: React.ReactNode;
    }> = [
        {
            status: 'attending',
            label: 'Going',
            icon: <CheckCircle2 className="size-4" />,
        },
        {
            status: 'maybe',
            label: 'Maybe',
            icon: <CircleHelp className="size-4" />,
        },
        {
            status: 'declined',
            label: "Can't go",
            icon: <CircleX className="size-4" />,
        },
    ];
    const date = eventDateParts(event.starts_at);
    const attending = event.responses.attending;
    const responseCount = Object.values(event.responses).reduce(
        (total, people) => total + people.length,
        0,
    );

    return (
        <div className="w-[min(22rem,72vw)] min-w-64">
            <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-brand uppercase">
                <Calendar className="size-3.5" /> Event invitation
            </div>
            <div className="mt-3 flex items-start gap-3">
                <div className="w-14 shrink-0 overflow-hidden rounded-2xl border border-brand/20 bg-card text-center shadow-sm">
                    <div className="bg-brand-solid px-1 py-1 text-[10px] font-bold tracking-wide text-white uppercase">
                        {date.month}
                    </div>
                    <div className="py-1.5 text-xl leading-none font-bold text-foreground">
                        {date.day}
                    </div>
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                    <h3 className="text-base leading-6 font-bold text-foreground">
                        {event.title}
                    </h3>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Clock className="size-3.5 text-brand" /> {date.time}
                    </p>
                    {event.location && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="mt-0.5 size-3.5 shrink-0 text-brand" />
                            <span className="line-clamp-2">
                                {event.location}
                            </span>
                        </p>
                    )}
                </div>
            </div>
            {event.description && (
                <p className="mt-4 border-l-2 border-brand/30 pl-3 text-sm leading-5 whitespace-pre-wrap text-muted-foreground">
                    {event.description}
                </p>
            )}
            <p className="mt-4 text-xs font-semibold text-foreground">
                Will you attend?
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
                {choices.map(({ status, label, icon }) => (
                    <button
                        aria-pressed={event.my_response === status}
                        className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                            event.my_response === status
                                ? status === 'attending'
                                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 shadow-sm dark:text-emerald-400'
                                    : status === 'maybe'
                                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 shadow-sm dark:text-amber-400'
                                      : 'border-rose-500/50 bg-rose-500/10 text-rose-700 shadow-sm dark:text-rose-400'
                                : 'border-border bg-card/70 text-muted-foreground hover:border-brand/40 hover:bg-card hover:text-foreground'
                        }`}
                        key={status}
                        onClick={() => onRsvp(status)}
                        title={event.responses[status]
                            .map((user) => user.name)
                            .join(', ')}
                        type="button"
                    >
                        {icon}
                        <span className="truncate">{label}</span>
                        <span className="text-[10px] font-normal opacity-75">
                            {event.responses[status].length}
                        </span>
                    </button>
                ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                <div className="flex min-w-0 items-center gap-2">
                    <PeopleStack people={attending} />
                    <span className="truncate text-xs font-medium text-muted-foreground">
                        {attending.length === 0
                            ? 'No one is going yet'
                            : `${attending.length} ${attending.length === 1 ? 'person is' : 'people are'} going`}
                    </span>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                    {responseCount} responded
                </span>
            </div>
        </div>
    );
}

function PeopleStack({
    people,
}: {
    people: Array<{ id: number; name: string }>;
}) {
    if (people.length === 0) {
        return (
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                <Users className="size-3.5" />
            </span>
        );
    }

    return (
        <span className="flex shrink-0 -space-x-2">
            {people.slice(0, 3).map((person) => (
                <span
                    className="grid size-7 place-items-center rounded-full border-2 border-card bg-brand-solid text-[9px] font-bold text-white"
                    key={person.id}
                    title={person.name}
                >
                    {initials(person.name)}
                </span>
            ))}
            {people.length > 3 && (
                <span className="grid size-7 place-items-center rounded-full border-2 border-card bg-muted text-[9px] font-bold text-muted-foreground">
                    +{people.length - 3}
                </span>
            )}
        </span>
    );
}

function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
    return (
        <a
            className="block overflow-hidden rounded-xl border border-border bg-card/70 text-left transition hover:border-brand/50"
            href={preview.url}
            rel="noreferrer"
            target="_blank"
        >
            {preview.image_url && (
                <img
                    alt=""
                    className="max-h-52 w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    src={preview.image_url}
                />
            )}
            <span className="block p-3">
                <span className="block text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {preview.host}
                </span>
                {preview.title && (
                    <span className="mt-1 line-clamp-2 block text-sm font-semibold text-foreground">
                        {preview.title}
                    </span>
                )}
                {preview.description && (
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                        {preview.description}
                    </span>
                )}
            </span>
        </a>
    );
}

function TypingIndicator({ users }: { users: TypingUser[] }) {
    return (
        <div className="flex w-full flex-col items-start">
            <div className="rounded-2xl rounded-bl-md bg-card px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((index) => (
                        <span
                            className="size-2 animate-bounce rounded-full bg-muted-foreground"
                            key={index}
                            style={{ animationDelay: `${index * 120}ms` }}
                        />
                    ))}
                </div>
            </div>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
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
            className={`mb-2 rounded-lg border-l-4 border-brand px-3 py-2 text-left ${
                mine ? 'bg-card/60' : 'bg-muted'
            }`}
        >
            <p className="truncate text-xs font-semibold text-brand">
                {replyTo.sender?.id === currentUserId
                    ? 'You'
                    : (replyTo.sender?.name ?? 'Message')}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
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
        ? 'border-brand/30 bg-card/60'
        : 'border-border bg-muted/40';

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
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Mic className="size-3.5 text-brand" />
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
                    ? 'border-brand/30 bg-card/60 hover:bg-card'
                    : 'border-border bg-muted/40 hover:bg-muted'
            }`}
            href={attachment.url}
            rel="noreferrer"
            target="_blank"
        >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-brand">
                <FileText className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block max-w-full truncate text-sm font-medium">
                    {attachment.name}
                </span>
                <span className="block text-xs text-muted-foreground">
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
                        className="font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
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
                                className="font-semibold text-brand"
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
            className="flex max-w-full min-w-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-brand"
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
    photoUrl,
    type,
}: {
    label: string;
    online?: boolean;
    photoUrl: string | null;
    type: Conversation['type'];
}) {
    return (
        <span
            className={`relative grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${
                type === 'direct' ? 'bg-rose-500' : 'bg-brand-solid'
            }`}
        >
            {photoUrl ? (
                <img
                    alt=""
                    className="size-full rounded-full object-cover"
                    src={photoUrl}
                />
            ) : type === 'direct' ? (
                initials(label)
            ) : (
                <UsersRound className="size-5" />
            )}
            {online && (
                <span className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-card bg-emerald-500" />
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
            className={`flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase ${className}`}
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
            <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                {icon}
            </span>
            <h3 className="mt-3 text-sm font-semibold text-foreground">
                {title}
            </h3>
            <p className="mt-1 max-w-72 text-sm leading-6 text-muted-foreground">
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

function offlineStatusLabel(lastSeenAt: string | null) {
    return lastSeenAt
        ? `Offline · ${formatRelativeLastSeen(lastSeenAt)}`
        : 'Offline';
}

function formatRelativeLastSeen(value: string) {
    const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - timestamp(value)) / 1000),
    );

    if (elapsedSeconds < 60) {
        return 'just now';
    }

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);

    if (elapsedMinutes < 60) {
        return `${elapsedMinutes} min ago`;
    }

    const elapsedHours = Math.floor(elapsedMinutes / 60);

    if (elapsedHours < 24) {
        return `${elapsedHours} ${elapsedHours === 1 ? 'hour' : 'hours'} ago`;
    }

    const elapsedDays = Math.floor(elapsedHours / 24);

    return `${elapsedDays} ${elapsedDays === 1 ? 'day' : 'days'} ago`;
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

    if (message.poll) {
        return `Poll: ${message.poll.question}`;
    }

    if (message.event) {
        return `Event: ${message.event.title}`;
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

function eventDateParts(value: string) {
    const date = new Date(value);

    return {
        month: new Intl.DateTimeFormat(undefined, {
            month: 'short',
        }).format(date),
        day: new Intl.DateTimeFormat(undefined, { day: 'numeric' }).format(
            date,
        ),
        time: new Intl.DateTimeFormat(undefined, {
            weekday: 'short',
            hour: 'numeric',
            minute: '2-digit',
        }).format(date),
    };
}

function formatShortDate(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

function uniquePeople(people: Array<{ id: number; name: string }>) {
    return Array.from(
        new Map(people.map((person) => [person.id, person])).values(),
    );
}

function localDateTimeInputValue(minutesAhead = 0) {
    const date = new Date(Date.now() + minutesAhead * 60_000);
    const localTime = new Date(
        date.getTime() - date.getTimezoneOffset() * 60_000,
    );

    return localTime.toISOString().slice(0, 16);
}

async function apiErrorMessage(response: Response) {
    try {
        const payload = (await response.json()) as {
            message?: string;
            errors?: Record<string, string[]>;
        };
        const validationMessage = Object.values(payload.errors ?? {})[0]?.[0];

        return validationMessage ?? payload.message ?? 'Please try again.';
    } catch {
        return 'Please try again.';
    }
}

function messageLinkPreviews(message: MessengerMessage): LinkPreview[] {
    const previews = message.metadata?.link_previews;

    return Array.isArray(previews) ? (previews as LinkPreview[]) : [];
}

function participantDisplayName(
    conversation: Conversation,
    userId: number,
    fallback: string,
) {
    const participant = conversation.participants.find(
        (item) => item.id === userId,
    );

    return participant?.nickname || participant?.name || fallback;
}

function applyConversationSystemMessage(
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
