export type Participant = {
    id: number;
    name: string;
    email: string;
    school_role: string;
    last_seen_at: string | null;
    nickname: string | null;
    conversation_role?: string | null;
};

export type Contact = Participant;

export type PresenceUser = Participant;

export type TypingUser = {
    id: number;
    name: string;
};

export type MentionOption = {
    id: number | 'everyone';
    label: string;
    token: string;
    description: string;
};

export type ConversationPermissions = {
    can_rename: boolean;
    can_add_members: boolean;
    can_remove_members: boolean;
    can_pin_messages: boolean;
    can_mention_everyone: boolean;
    can_customize_group: boolean;
};

export type NotificationPreference = 'all' | 'mentions' | 'muted';

export type Conversation = {
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

export type MessengerMessage = {
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

export type LinkPreview = {
    url: string;
    host: string;
    title: string | null;
    description: string | null;
    image_url: string | null;
};

export type MessagePoll = {
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

export type RsvpStatus = 'attending' | 'maybe' | 'declined';

export type MessageEvent = {
    title: string;
    description: string | null;
    starts_at: string;
    location: string | null;
    my_response: RsvpStatus | null;
    responses: Record<RsvpStatus, { id: number; name: string }[]>;
};

export type NewPollPayload = {
    question: string;
    options: string[];
    allow_multiple: boolean;
    closes_at: string | null;
};

export type NewEventPayload = {
    title: string;
    description: string | null;
    starts_at: string;
    location: string | null;
};

export type ReplyToMessage = {
    id: number;
    sender: {
        id: number;
        name: string;
    } | null;
    body: string;
    attachment_count: number;
    unsent_at: string | null;
};

export type MessageMention = {
    id: number;
    name: string;
    type: 'user' | 'everyone';
};

export type MessageDeliveryReceipt = {
    id: number;
    name: string;
    delivered_at: string;
};

export type MessageReactionSummary = {
    emoji: string;
    count: number;
    reacted_by_me: boolean;
    users: {
        id: number;
        name: string;
    }[];
};

export type MessageReadReceipt = {
    id: number;
    name: string;
    read_at: string;
};

export type MessageAttachment = {
    id: number;
    name: string;
    mime_type: string | null;
    size: number;
    url: string;
    preview_url: string | null;
};

export type SharedContent = {
    media: SharedAttachment[];
    files: SharedAttachment[];
    links: SharedLink[];
};

export type SharedAttachment = {
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

export type SharedLink = {
    url: string;
    host: string;
    message_id: number;
    created_at: string | null;
    sender: {
        id: number;
        name: string;
    } | null;
};

export type MessengerPageProps = {
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

export type MessageCreatedPayload = {
    message: MessengerMessage;
};

export type ConversationMutationPayload = {
    data: Conversation;
    system_message?: MessengerMessage | null;
};

export type MessageReactionUpdatedPayload = {
    message_id: number;
    reactions: MessageReactionSummary[];
};

export type MessageUpdatedPayload = {
    message: MessengerMessage;
};

export type ConversationReadPayload = {
    conversation_id: number;
    user_id: number;
    read_at: string | null;
};

export type MessageDeliveredPayload = {
    conversation_id: number;
    message_id: number;
    user_id: number;
    user_name: string;
    delivered_at: string;
};

export type TypingPayload = {
    id: number;
    name: string;
    typing: boolean;
};

export type TypingChannel = {
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

export type WindowWithWebAudio = Window &
    typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
    };

export type NewConversationPayload = {
    type: 'direct' | 'group';
    title: string | null;
    participant_ids: number[];
};
