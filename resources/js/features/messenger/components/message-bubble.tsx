import {
    FileText,
    Forward,
    ImageIcon,
    Mic,
    PencilLine,
    Pin,
    PinOff,
    Reply,
    Smile,
    Trash2,
    Video,
} from 'lucide-react';
import { useState } from 'react';
import {
    EventCard,
    LinkPreviewCard,
    PollCard,
} from '@/features/messenger/components/interactive-message-cards';
import { REACTION_OPTIONS } from '@/features/messenger/lib/constants';
import { participantDisplayName } from '@/features/messenger/lib/conversations';
import {
    formatFileSize,
    formatTime,
    typingLabel,
} from '@/features/messenger/lib/format';
import {
    messageLinkPreviews,
    replyMessagePreview,
} from '@/features/messenger/lib/messages';
import { linkifyText, mentionifyText } from '@/features/messenger/lib/text';
import type {
    Conversation,
    MessageAttachment,
    MessengerMessage,
    ReplyToMessage,
    RsvpStatus,
    TypingUser,
} from '@/features/messenger/types';

export function MessageBubble({
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
    // Polls and events render on a light card so their controls stay readable.
    const interactive = Boolean(message.poll || message.event);
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
            className={`group flex w-full flex-col outline-none ${mine ? 'items-end' : 'items-start'}`}
            // Tap-focusable (not a Tab stop) so a tap reveals the actions on touch screens;
            // keyboard users reveal them by tabbing to the action buttons themselves.
            tabIndex={-1}
        >
            <div className="relative max-w-[min(82%,34rem)]">
                {!unsent && (
                    <div className="pointer-events-none absolute -top-3.5 right-3 z-10 flex gap-1 opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
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
                                : interactive
                                  ? 'rounded-br-md bg-message-incoming text-foreground ring-1 ring-brand/25'
                                  : 'rounded-br-md bg-message-outgoing text-message-outgoing-foreground'
                            : 'rounded-bl-md bg-message-incoming text-foreground'
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
                                    voiceNote={message.type === 'voice'}
                                />
                            ))}
                        </div>
                    )}
                    <div
                        className={`mt-2 text-right text-[11px] ${
                            mine && !unsent && !interactive
                                ? 'text-message-outgoing-foreground/70'
                                : 'text-muted-foreground'
                        }`}
                    >
                        {message.edited_at && !unsent && (
                            <span className="mr-1">Edited</span>
                        )}
                        {formatTime(message.created_at)}
                    </div>
                    {!unsent && (
                        <div className="absolute right-2 -bottom-3 flex max-w-[calc(100%-1rem)] flex-wrap justify-end gap-1">
                            <button
                                aria-label="Add reaction"
                                className="pointer-events-none grid size-7 place-items-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 hover:scale-105 hover:text-brand"
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

export function ReplyPreview({
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
            className={`mb-2 rounded-lg border-l-4 px-3 py-2 text-left ${
                mine
                    ? 'border-message-outgoing-foreground/50 bg-message-outgoing-foreground/12'
                    : 'border-brand bg-muted'
            }`}
        >
            <p
                className={`truncate text-xs font-semibold ${
                    mine ? 'text-message-outgoing-foreground' : 'text-brand'
                }`}
            >
                {replyTo.sender?.id === currentUserId
                    ? 'You'
                    : (replyTo.sender?.name ?? 'Message')}
            </p>
            <p
                className={`mt-0.5 line-clamp-2 text-xs leading-5 ${
                    mine
                        ? 'text-message-outgoing-foreground/75'
                        : 'text-muted-foreground'
                }`}
            >
                {replyMessagePreview(replyTo)}
            </p>
        </div>
    );
}

export function MessageAttachmentPreview({
    attachment,
    mine,
    voiceNote,
}: {
    attachment: MessageAttachment;
    mine: boolean;
    voiceNote: boolean;
}) {
    const mimeType = attachment.mime_type ?? '';
    const canPreview = attachment.preview_url !== null;
    const isImage = canPreview && mimeType.startsWith('image/');
    const isAudio =
        canPreview &&
        (mimeType.startsWith('audio/') ||
            (voiceNote && mimeType.startsWith('video/')));
    const isVideo = canPreview && mimeType.startsWith('video/') && !isAudio;
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
                    <span className="min-w-0 truncate">
                        {voiceNote ? 'Voice message' : attachment.name}
                    </span>
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

export function LinkedMessageText({ text }: { text: string }) {
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

export function AttachmentCaption({
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

export function TypingIndicator({ users }: { users: TypingUser[] }) {
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
