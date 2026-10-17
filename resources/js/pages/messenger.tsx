import { Head, usePage } from '@inertiajs/react';
import { echo } from '@laravel/echo-react';
import {
    Archive,
    ArrowLeft,
    Inbox,
    Info,
    MessageCircle,
    PencilLine,
} from 'lucide-react';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import type { FormEvent } from 'react';
import { ChatDetails } from '@/features/messenger/components/chat-details';
import { EmptyState } from '@/features/messenger/components/common';
import { ConversationComposer } from '@/features/messenger/components/conversation-composer';
import {
    ConversationHeader,
    PinnedMessageBanner,
} from '@/features/messenger/components/conversation-header';
import { ConversationList } from '@/features/messenger/components/conversation-list';
import { ForwardMessageDialog } from '@/features/messenger/components/forward-message-dialog';
import {
    EventComposer,
    PollComposer,
} from '@/features/messenger/components/interactive-composers';
import {} from '@/features/messenger/components/message-bubble';
import { MessageComposer } from '@/features/messenger/components/message-composer';
import { MessageSearchBar } from '@/features/messenger/components/message-search-bar';
import { MessageTimeline } from '@/features/messenger/components/message-timeline';
import type { PendingOutgoingMessage } from '@/features/messenger/components/pending-message';
import {} from '@/features/messenger/components/voice-note-controls';
import { apiFetch } from '@/features/messenger/lib/api';
import {
    applyConversationSystemMessage,
    sortConversations,
    updateConversationMessageSnapshot,
} from '@/features/messenger/lib/conversations';
import {
    addDeliveryReceipt,
    latestDeliveredMessageId,
    latestOwnMessageIdFor,
    latestPinnedMessage,
    latestSeenMessageId,
    mapMessages,
    messageMentionsUser,
    messagePreview,
    personalizeMessage,
    personalizeReactions,
    pinnedMessagesList,
    replyToFromMessage,
    shouldPlayNotificationSound,
    sortMessagesByCreatedAt,
} from '@/features/messenger/lib/messages';
import {
    loadConversationDrafts,
    saveConversationDrafts,
} from '@/features/messenger/lib/storage';
import {
    mentionOptionsFor,
    mentionQueryAtCursor,
    mentionRangeAtCursor,
} from '@/features/messenger/lib/text';
import type {
    Conversation,
    ConversationReadPayload,
    MentionOption,
    MessageCreatedPayload,
    MessageDeliveredPayload,
    MessageDeliveryReceipt,
    MessageReactionSummary,
    MessageReactionUpdatedPayload,
    MessageUpdatedPayload,
    MessengerMessage,
    MessengerPageProps,
    NewConversationPayload,
} from '@/features/messenger/types';
import { useBrowserNotifications } from '@/features/messenger/use-browser-notifications';
import { useConversationActions } from '@/features/messenger/use-conversation-actions';
import { useMessageActions } from '@/features/messenger/use-message-actions';
import { useNotificationSound } from '@/features/messenger/use-notification-sound';
import { useOlderMessages } from '@/features/messenger/use-older-messages';
import { usePresence } from '@/features/messenger/use-presence';
import { useSharedContent } from '@/features/messenger/use-shared-content';
import { useTypingIndicators } from '@/features/messenger/use-typing-indicators';
import type { VoiceRecorderStatus } from '@/features/messenger/use-voice-recorder';
import type { User } from '@/types';

const subscribeToHydration = () => () => {};

type UnreadSnapshot = { count: number; lastReadAt: string | null };

export default function Messenger({
    apiBaseUrl,
    archived,
    contacts,
    conversations: initialConversations,
    initialConversationId,
    initialHasOlderMessages,
    initialMessages,
    webPushPublicKey,
    workspace,
}: MessengerPageProps) {
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
    const [unreadSnapshots, setUnreadSnapshots] = useState<
        Record<number, UnreadSnapshot>
    >(() => {
        const conversation = initialConversations.find(
            (item) => item.id === initialConversationId,
        );

        return conversation && conversation.unread_count > 0
            ? {
                  [conversation.id]: {
                      count: conversation.unread_count,
                      lastReadAt: conversation.last_read_at,
                  },
              }
            : {};
    });
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
    const [draftsByConversation, setDraftsByConversation] = useState<
        Record<number, string>
    >({});
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [messageSearch, setMessageSearch] = useState('');
    const [messageSearchOpen, setMessageSearchOpen] = useState(false);
    const [messageSearchResults, setMessageSearchResults] = useState<
        MessengerMessage[]
    >([]);
    const [searchingMessages, setSearchingMessages] = useState(false);
    const [pinnedMessagesByConversation, setPinnedMessagesByConversation] =
        useState<Record<number, MessengerMessage[]>>({});
    const [loadingPinnedConversationId, setLoadingPinnedConversationId] =
        useState<number | null>(initialConversationId);
    const hasHydrated = useSyncExternalStore(
        subscribeToHydration,
        () => true,
        () => false,
    );
    const [sending, setSending] = useState(false);
    const [showJumpToLatest, setShowJumpToLatest] = useState(false);
    const [pendingMessagesByConversation, setPendingMessagesByConversation] =
        useState<Record<number, PendingOutgoingMessage[]>>({});
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
    const [replyToMessage, setReplyToMessage] =
        useState<MessengerMessage | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [recordedVoiceNote, setRecordedVoiceNote] = useState<File | null>(
        null,
    );
    const [voiceRecorderStatus, setVoiceRecorderStatus] =
        useState<VoiceRecorderStatus>('idle');
    const browserNotifications = useBrowserNotifications(
        auth.user.id,
        workspace.id,
        workspace.slug,
        webPushPublicKey,
    );
    const notifyBrowserMessage = browserNotifications.notify;
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const messageInputRef = useRef<HTMLInputElement | null>(null);
    const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const messagesViewportRef = useRef<HTMLDivElement | null>(null);
    const unreadMarkerRef = useRef<HTMLDivElement | null>(null);
    const initialScrollConversationRef = useRef(initialConversationId);
    const nearBottomRef = useRef(true);
    const forceScrollToLatestRef = useRef(false);
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
    const deliveredMessageIdsRef = useRef(new Set<number>());
    const inFlightMessageIdsRef = useRef(new Set<string>());
    const sendingRef = useRef(false);
    const draftsRef = useRef<Record<number, string>>({});
    const draftStorageKey = `uhoo:drafts:v1:${auth.user.id}:${workspace.id}`;

    const playNotificationSound = useNotificationSound();
    const handleUserLeft = useCallback((userId: number, lastSeenAt: string) => {
        setConversations((items) =>
            items.map((conversation) => ({
                ...conversation,
                participants: conversation.participants.map((participant) =>
                    participant.id === userId
                        ? { ...participant, last_seen_at: lastSeenAt }
                        : participant,
                ),
            })),
        );
    }, []);
    const onlineUserIds = usePresence({
        apiBaseUrl,
        workspaceId: workspace.id,
        onUserLeft: handleUserLeft,
    });
    const { typingUsersByConversation, stopOwnTyping, handleOwnTyping } =
        useTypingIndicators({
            activeConversationId,
            activeConversationIdRef,
            currentUser: auth.user,
        });

    const updateDraft = useCallback(
        (conversationId: number, body: string) => {
            const nextDrafts = { ...draftsRef.current };

            if (body.trim()) {
                nextDrafts[conversationId] = body;
            } else {
                delete nextDrafts[conversationId];
            }

            draftsRef.current = nextDrafts;
            setDraftsByConversation(nextDrafts);
            saveConversationDrafts(draftStorageKey, nextDrafts);
        },
        [draftStorageKey],
    );

    const handleRecordedVoiceNote = useCallback((file: File) => {
        setSelectedFiles([file]);
        setRecordedVoiceNote(file);
    }, []);

    useEffect(() => {
        const savedDrafts = loadConversationDrafts(draftStorageKey);
        draftsRef.current = savedDrafts;
        setDraftsByConversation(savedDrafts);

        if (initialConversationId) {
            setMessageBody(savedDrafts[initialConversationId] ?? '');
        }
    }, [draftStorageKey, initialConversationId]);

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
    const activePendingMessages = activeConversationId
        ? (pendingMessagesByConversation[activeConversationId] ?? [])
        : [];
    const activeUnreadSnapshot = activeConversationId
        ? unreadSnapshots[activeConversationId]
        : undefined;
    const firstUnreadMessageId = activeUnreadSnapshot
        ? (activeMessages.find(
              (message) =>
                  message.sender?.id !== auth.user.id &&
                  message.created_at !== null &&
                  (activeUnreadSnapshot.lastReadAt === null ||
                      new Date(message.created_at).getTime() >
                          new Date(activeUnreadSnapshot.lastReadAt).getTime()),
          )?.id ?? null)
        : null;
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
    const {
        sharedContent: activeSharedContent,
        loadingSharedContent,
        markSharedContentLoading,
    } = useSharedContent({
        apiBaseUrl,
        activeConversationId,
        messageCount: activeMessages.length,
        initialConversationId,
    });
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

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    const handleMessageBodyChange = (value: string) => {
        setMessageBody(value);

        if (activeConversationId && !editingMessage) {
            updateDraft(activeConversationId, value);
        }

        setMentionQuery(
            mentionQueryAtCursor(
                value,
                messageInputRef.current?.selectionStart ?? value.length,
            ),
        );

        if (!activeConversationId) {
            return;
        }

        handleOwnTyping(activeConversationId, value);
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

        if (activeConversationId && !editingMessage) {
            updateDraft(activeConversationId, nextBody);
        }

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
            if (message.client_message_id) {
                setPendingMessagesByConversation((pendingByConversation) => ({
                    ...pendingByConversation,
                    [message.conversation_id]: (
                        pendingByConversation[message.conversation_id] ?? []
                    ).filter(
                        (pending) =>
                            pending.clientId !== message.client_message_id,
                    ),
                }));
            }

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
                const preview = messagePreview(message);
                const title =
                    conversation?.display_name ??
                    message.sender?.name ??
                    'New message';
                const body =
                    conversation?.type === 'group' ||
                    conversation?.type === 'announcement'
                        ? `${message.sender?.name ?? 'Someone'}: ${preview}`
                        : preview;

                void notifyBrowserMessage({
                    messageId: message.id,
                    conversationId: message.conversation_id,
                    title,
                    body,
                }).then((shown) => {
                    if (!shown) {
                        playNotificationSound();
                    }
                });
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
        [notifyBrowserMessage, playNotificationSound],
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

    const selectConversation = (conversationId: number | null) => {
        stopOwnTyping(activeConversationIdRef.current);
        const selectedConversation = conversations.find(
            (conversation) => conversation.id === conversationId,
        );

        if (conversationId) {
            setUnreadSnapshots((snapshots) => {
                const nextSnapshots = { ...snapshots };

                if (
                    selectedConversation &&
                    selectedConversation.unread_count > 0
                ) {
                    nextSnapshots[conversationId] = {
                        count: selectedConversation.unread_count,
                        lastReadAt: selectedConversation.last_read_at,
                    };
                } else {
                    delete nextSnapshots[conversationId];
                }

                return nextSnapshots;
            });
        }

        initialScrollConversationRef.current = conversationId;
        nearBottomRef.current = true;
        setShowJumpToLatest(false);
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
        setMessageBody(
            conversationId ? (draftsRef.current[conversationId] ?? '') : '',
        );
        setSelectedFiles([]);
        setRecordedVoiceNote(null);
        markSharedContentLoading(conversationId);
        setLoadingPinnedConversationId(conversationId);
        const url = new URL(window.location.href);

        if (conversationId === null) {
            url.searchParams.delete('conversation');
        } else {
            url.searchParams.set('conversation', String(conversationId));
        }

        window.history.replaceState({}, '', url);
    };

    const createConversation = async (payload: NewConversationPayload) => {
        const response = await apiFetch(`${apiBaseUrl}/conversations`, {
            method: 'POST',
            json: payload,
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

    /** Merges fetched messages (newest first, as the API returns them) into a conversation. */
    const mergeLoadedMessages = useCallback(
        (conversationId: number, loaded: MessengerMessage[]) => {
            loaded.forEach((message) => {
                seenMessageIdsRef.current.add(message.id);
            });

            setMessagesByConversation((messages) => {
                const fetchedMessages = [...loaded].reverse();
                const fetchedIds = new Set(
                    fetchedMessages.map((message) => message.id),
                );
                const existingMessages = (
                    messages[conversationId] ?? []
                ).filter((message) => !fetchedIds.has(message.id));

                return {
                    ...messages,
                    [conversationId]: sortMessagesByCreatedAt([
                        ...fetchedMessages,
                        ...existingMessages,
                    ]),
                };
            });
        },
        [],
    );

    const {
        hasOlder: hasOlderMessages,
        loadingOlder: loadingOlderMessages,
        loadOlder: loadOlderMessages,
        setHasOlder: setHasOlderMessages,
    } = useOlderMessages({
        apiBaseUrl,
        conversationId: activeConversationId,
        messages: activeMessages,
        viewportRef: messagesViewportRef,
        messageRefs,
        initialConversationId,
        initialHasOlder: initialHasOlderMessages,
        onLoaded: mergeLoadedMessages,
    });

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
                next_page_url: string | null;
            };
            loadedConversationIdsRef.current.add(conversationId);
            mergeLoadedMessages(conversationId, payload.data);
            setHasOlderMessages(conversationId, payload.next_page_url !== null);
        },
        [apiBaseUrl, mergeLoadedMessages, setHasOlderMessages],
    );

    const markConversationRead = useCallback(
        async (conversationId: number) => {
            await apiFetch(
                `${apiBaseUrl}/conversations/${conversationId}/read`,
                { method: 'PATCH', json: {} },
            );
        },
        [apiBaseUrl],
    );

    const markMessageDelivered = useCallback(
        async (message: MessengerMessage) => {
            await apiFetch(
                `${apiBaseUrl}/conversations/${message.conversation_id}/messages/${message.id}/delivered`,
                { method: 'PATCH', json: {} },
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

    const scrollToLatest = useCallback(
        (behavior: ScrollBehavior = 'smooth') => {
            const viewport = messagesViewportRef.current;

            if (!viewport) {
                return;
            }

            viewport.scrollTo({ top: viewport.scrollHeight, behavior });
            nearBottomRef.current = true;
            forceScrollToLatestRef.current = false;
            setShowJumpToLatest(false);
        },
        [],
    );

    const updateTimelineScrollState = () => {
        const viewport = messagesViewportRef.current;

        if (!viewport) {
            return null;
        }

        const nearBottom =
            viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
            96;
        nearBottomRef.current = nearBottom;
        setShowJumpToLatest(!nearBottom);

        return viewport;
    };

    const handleTimelineScroll = () => {
        const viewport = updateTimelineScrollState();

        // Near the top: fetch the previous page of history.
        if (viewport && viewport.scrollTop < 150 && !messageSearchTerm) {
            void loadOlderMessages();
        }
    };

    useEffect(() => {
        const viewport = messagesViewportRef.current;

        if (!viewport || !activeConversationId || messageSearchTerm) {
            return;
        }

        if (initialScrollConversationRef.current === activeConversationId) {
            if (
                !loadedConversationIdsRef.current.has(activeConversationId) &&
                activeMessages.length === 0
            ) {
                return;
            }

            const marker = unreadMarkerRef.current;

            if (marker) {
                viewport.scrollTop +=
                    marker.getBoundingClientRect().top -
                    viewport.getBoundingClientRect().top -
                    12;
                updateTimelineScrollState();
            } else {
                scrollToLatest('auto');
            }

            initialScrollConversationRef.current = null;

            return;
        }

        if (forceScrollToLatestRef.current || nearBottomRef.current) {
            scrollToLatest('auto');
        } else {
            setShowJumpToLatest(true);
        }
    }, [
        activeConversationId,
        activeMessages.length,
        activePendingMessages.length,
        firstUnreadMessageId,
        messageSearchTerm,
        scrollToLatest,
    ]);

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

    const startReply = (message: MessengerMessage) => {
        if (message.unsent_at) {
            return;
        }

        setReplyToMessage(message);

        if (editingMessage) {
            setMessageBody(draftsRef.current[message.conversation_id] ?? '');
        }

        setEditingMessage(null);
    };

    const startEdit = (message: MessengerMessage) => {
        if (message.unsent_at || message.sender?.id !== auth.user.id) {
            return;
        }

        setEditingMessage(message);
        setReplyToMessage(null);
        setSelectedFiles([]);
        setRecordedVoiceNote(null);
        setMessageBody(message.body);
        setMentionQuery(null);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const cancelComposerContext = () => {
        setEditingMessage(null);
        setReplyToMessage(null);
        setMessageBody(
            activeConversationId
                ? (draftsRef.current[activeConversationId] ?? '')
                : '',
        );
        setMentionQuery(null);
    };

    const updateMessage = async () => {
        if (!editingMessage || !messageBody.trim() || sending) {
            return;
        }

        setSending(true);

        try {
            const response = await apiFetch(
                `${apiBaseUrl}/conversations/${editingMessage.conversation_id}/messages/${editingMessage.id}`,
                { method: 'PATCH', json: { body: messageBody.trim() } },
            );

            if (!response.ok) {
                return;
            }

            const payload = (await response.json()) as {
                data: MessengerMessage;
            };

            replaceMessage(payload.data);
            setEditingMessage(null);
            setMessageBody(
                activeConversationId
                    ? (draftsRef.current[activeConversationId] ?? '')
                    : '',
            );
            setMentionQuery(null);
        } finally {
            setSending(false);
        }
    };

    const {
        toggleConversationPin,
        moveConversationToArchiveState,
        deleteArchivedConversation,
        toggleConversationMute,
        updateNotificationPreference,
        renameConversation,
        updateConversationPhoto,
        removeConversationPhoto,
        updateParticipantNickname,
        addConversationMembers,
        removeConversationMember,
        leaveConversation,
    } = useConversationActions({
        apiBaseUrl,
        setConversations,
        replaceConversation,
        appendMessage,
        removeConversationFromCurrentView,
    });

    const {
        forwarding,
        createPoll,
        createEvent,
        votePoll,
        respondToEvent,
        toggleReaction,
        unsendMessage,
        toggleMessagePin,
        forwardMessage,
    } = useMessageActions({
        apiBaseUrl,
        activeConversationId,
        currentUserId: auth.user.id,
        appendMessage,
        replaceMessage,
        updateMessageReactions,
        onUnsent: (message) => {
            if (editingMessage?.id === message.id) {
                setEditingMessage(null);
                setMessageBody(
                    activeConversationId
                        ? (draftsRef.current[activeConversationId] ?? '')
                        : '',
                );
                setMentionQuery(null);
            }

            if (replyToMessage?.id === message.id) {
                setReplyToMessage(null);
            }
        },
        onForwarded: () => setForwardingMessage(null),
    });

    const sendPendingMessage = async (
        pendingMessage: PendingOutgoingMessage,
    ) => {
        if (
            sendingRef.current ||
            inFlightMessageIdsRef.current.has(pendingMessage.clientId)
        ) {
            return;
        }

        sendingRef.current = true;
        inFlightMessageIdsRef.current.add(pendingMessage.clientId);
        setSending(true);
        setPendingMessagesByConversation((pendingByConversation) => ({
            ...pendingByConversation,
            [pendingMessage.conversationId]: (
                pendingByConversation[pendingMessage.conversationId] ?? []
            ).map((message) =>
                message.clientId === pendingMessage.clientId
                    ? { ...message, status: 'sending', error: null }
                    : message,
            ),
        }));

        try {
            const formData = new FormData();
            formData.append('client_message_id', pendingMessage.clientId);

            if (pendingMessage.type) {
                formData.append('type', pendingMessage.type);
            }

            if (pendingMessage.body) {
                formData.append('body', pendingMessage.body);
            }

            pendingMessage.files.forEach((file) => {
                formData.append('attachments[]', file);
            });

            if (pendingMessage.replyToMessageId) {
                formData.append(
                    'reply_to_message_id',
                    String(pendingMessage.replyToMessageId),
                );
            }

            const response = await apiFetch(
                `${apiBaseUrl}/conversations/${pendingMessage.conversationId}/messages`,
                { method: 'POST', body: formData },
            );

            if (!response.ok) {
                const failure = (await response.json().catch(() => null)) as {
                    message?: string;
                } | null;

                throw new Error(failure?.message ?? 'Could not send message.');
            }

            const payload = (await response.json()) as {
                data: MessengerMessage;
            };

            appendMessage(payload.data);
            setPendingMessagesByConversation((pendingByConversation) => ({
                ...pendingByConversation,
                [pendingMessage.conversationId]: (
                    pendingByConversation[pendingMessage.conversationId] ?? []
                ).filter(
                    (message) => message.clientId !== pendingMessage.clientId,
                ),
            }));
        } catch (error) {
            setPendingMessagesByConversation((pendingByConversation) => ({
                ...pendingByConversation,
                [pendingMessage.conversationId]: (
                    pendingByConversation[pendingMessage.conversationId] ?? []
                ).map((message) =>
                    message.clientId === pendingMessage.clientId
                        ? {
                              ...message,
                              status: 'failed',
                              error:
                                  error instanceof Error
                                      ? error.message
                                      : 'Could not send message.',
                          }
                        : message,
                ),
            }));
        } finally {
            inFlightMessageIdsRef.current.delete(pendingMessage.clientId);
            sendingRef.current = false;
            setSending(false);
        }
    };

    const discardPendingMessage = (clientId: string) => {
        if (!activeConversationId) {
            return;
        }

        setPendingMessagesByConversation((pendingByConversation) => ({
            ...pendingByConversation,
            [activeConversationId]: (
                pendingByConversation[activeConversationId] ?? []
            ).filter((message) => message.clientId !== clientId),
        }));
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
            sending ||
            voiceRecorderStatus !== 'idle' ||
            sendingRef.current
        ) {
            return;
        }

        const pendingMessage: PendingOutgoingMessage = {
            clientId: crypto.randomUUID(),
            conversationId: activeConversationId,
            body: messageBody.trim(),
            type: recordedVoiceNote ? 'voice' : null,
            files: selectedFiles,
            replyToMessageId: replyToMessage?.id ?? null,
            replyPreview: replyToMessage
                ? messagePreview(replyToMessage)
                : null,
            status: 'sending',
            error: null,
        };

        forceScrollToLatestRef.current = true;
        setPendingMessagesByConversation((pendingByConversation) => ({
            ...pendingByConversation,
            [activeConversationId]: [
                ...(pendingByConversation[activeConversationId] ?? []),
                pendingMessage,
            ],
        }));
        setMessageBody('');
        updateDraft(activeConversationId, '');
        setMentionQuery(null);
        setReplyToMessage(null);
        setSelectedFiles([]);
        setRecordedVoiceNote(null);
        stopOwnTyping(activeConversationId);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        await sendPendingMessage(pendingMessage);
    };

    return (
        <>
            <Head title="Messages" />
            <div className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden bg-background">
                <div className="flex shrink-0 items-center justify-between px-4 py-4 sm:px-6">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            {workspace.name}
                        </p>
                        <h1 className="truncate font-heading text-2xl font-bold text-foreground">
                            {archived ? 'Archived' : 'Chat'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {activeConversation && (
                            <button
                                aria-label="Back to chats"
                                className="grid size-10 place-items-center rounded-xl bg-secondary text-foreground transition hover:bg-accent lg:hidden"
                                onClick={() => selectConversation(null)}
                                type="button"
                            >
                                <ArrowLeft className="size-5" />
                            </button>
                        )}
                        <a
                            aria-label={archived ? 'Back to inbox' : 'Archive'}
                            className="grid size-10 place-items-center rounded-xl bg-secondary text-muted-foreground transition hover:bg-accent hover:text-foreground"
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
                                className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm transition hover:bg-[#121e41]"
                                onClick={() => setComposerOpen(true)}
                                type="button"
                            >
                                <PencilLine className="size-5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="mx-4 mb-4 grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-[20px] bg-card shadow-sm sm:mx-6 sm:mb-6 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_320px]">
                    <ConversationList
                        activeConversationId={activeConversationId}
                        archived={archived}
                        browserNotifications={browserNotifications}
                        conversations={filteredConversations}
                        currentUserId={auth.user.id}
                        draftsByConversation={draftsByConversation}
                        hasActiveConversation={activeConversation !== null}
                        onSearchChange={setSearch}
                        onSelectConversation={selectConversation}
                        onlineUserIds={onlineUserIdsSet}
                        search={search}
                        showBrowserAlerts={hasHydrated}
                        typingUsersByConversation={typingUsersByConversation}
                        webPushPublicKey={webPushPublicKey}
                    />

                    <section
                        className={`min-h-0 flex-col bg-background lg:flex ${activeConversation ? 'flex' : 'hidden'}`}
                    >
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
                                    <MessageSearchBar
                                        onChange={setMessageSearch}
                                        onClose={() => {
                                            setMessageSearch('');
                                            setMessageSearchOpen(false);
                                            setMessageSearchResults([]);
                                        }}
                                        value={messageSearch}
                                    />
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
                                <MessageTimeline
                                    conversation={activeConversation}
                                    currentUserId={auth.user.id}
                                    deliveredMessageId={deliveredMessageId}
                                    firstUnreadMessageId={firstUnreadMessageId}
                                    hasOlderMessages={hasOlderMessages}
                                    highlightedMessageId={highlightedMessageId}
                                    latestOwnMessageId={latestOwnMessageId}
                                    loadingOlderMessages={loadingOlderMessages}
                                    onLoadOlderMessages={() =>
                                        void loadOlderMessages()
                                    }
                                    messageActions={{
                                        onEdit: startEdit,
                                        onForward: setForwardingMessage,
                                        onPin: toggleMessagePin,
                                        onReact: toggleReaction,
                                        onReply: startReply,
                                        onRsvp: respondToEvent,
                                        onUnsend: unsendMessage,
                                        onVote: votePoll,
                                    }}
                                    messageRefs={messageRefs}
                                    messages={visibleMessages}
                                    onDiscardPending={discardPendingMessage}
                                    onJumpToLatest={() => scrollToLatest()}
                                    onRetryPending={(pendingMessage) =>
                                        void sendPendingMessage(pendingMessage)
                                    }
                                    onScroll={handleTimelineScroll}
                                    pendingMessages={activePendingMessages}
                                    searchOpen={messageSearchOpen}
                                    searchTerm={messageSearchTerm}
                                    searching={searchingMessages}
                                    seenMessageId={seenMessageId}
                                    showDeliveryStatus={hasHydrated}
                                    showJumpToLatest={showJumpToLatest}
                                    typingUsers={activeTypingUsers}
                                    unreadCount={activeUnreadSnapshot?.count}
                                    unreadMarkerRef={unreadMarkerRef}
                                    viewportRef={messagesViewportRef}
                                />
                                <MessageComposer
                                    body={messageBody}
                                    conversationId={activeConversationId}
                                    currentUserId={auth.user.id}
                                    editingMessage={editingMessage}
                                    fileInputRef={fileInputRef}
                                    mentionOptions={filteredMentionOptions}
                                    mentionQuery={mentionQuery}
                                    messageInputRef={messageInputRef}
                                    onBodyChange={handleMessageBodyChange}
                                    onCancelEdit={cancelComposerContext}
                                    onCancelReply={() =>
                                        setReplyToMessage(null)
                                    }
                                    onInsertMention={insertMention}
                                    onOpenEvent={() =>
                                        setEventComposerOpen(true)
                                    }
                                    onOpenPoll={() => setPollComposerOpen(true)}
                                    onSubmit={sendMessage}
                                    onSyncMentionQuery={
                                        syncMentionQueryFromInput
                                    }
                                    onVoiceNoteRecorded={
                                        handleRecordedVoiceNote
                                    }
                                    onVoiceRecorderStatusChange={
                                        setVoiceRecorderStatus
                                    }
                                    recordedVoiceNote={recordedVoiceNote}
                                    replyToMessage={replyToMessage}
                                    selectedFiles={selectedFiles}
                                    sending={sending}
                                    setRecordedVoiceNote={setRecordedVoiceNote}
                                    setSelectedFiles={setSelectedFiles}
                                    voiceRecorderStatus={voiceRecorderStatus}
                                />
                            </>
                        ) : (
                            <EmptyState
                                icon={<MessageCircle className="size-6" />}
                                title="Uhoo! is ready"
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

Messenger.layout = (props: { workspace?: { slug: string } }) => ({
    breadcrumbs: [
        {
            title: 'Messages',
            href: props.workspace ? `/${props.workspace.slug}/messenger` : '/',
        },
    ],
});
