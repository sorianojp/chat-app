import {
    Calendar,
    FileText,
    ListChecks,
    Paperclip,
    Send,
    X,
} from 'lucide-react';
import type { Dispatch, FormEvent, RefObject, SetStateAction } from 'react';
import { ComposerContext } from '@/features/messenger/components/conversation-composer';
import {
    VoiceNoteControls,
    VoiceNoteDraftPreview,
} from '@/features/messenger/components/voice-note-controls';
import { formatFileSize, initials } from '@/features/messenger/lib/format';
import { messagePreview } from '@/features/messenger/lib/messages';
import type {
    MentionOption,
    MessengerMessage,
} from '@/features/messenger/types';
import type { VoiceRecorderStatus } from '@/features/messenger/use-voice-recorder';

/** The send form: reply/edit context, attachments, voice notes, mentions and actions. */
export function MessageComposer({
    conversationId,
    currentUserId,
    body,
    onBodyChange,
    onSyncMentionQuery,
    messageInputRef,
    editingMessage,
    onCancelEdit,
    replyToMessage,
    onCancelReply,
    selectedFiles,
    setSelectedFiles,
    fileInputRef,
    recordedVoiceNote,
    setRecordedVoiceNote,
    onVoiceNoteRecorded,
    voiceRecorderStatus,
    onVoiceRecorderStatusChange,
    mentionQuery,
    mentionOptions,
    onInsertMention,
    sending,
    onSubmit,
    onOpenPoll,
    onOpenEvent,
}: {
    conversationId: number | null;
    currentUserId: number;
    body: string;
    onBodyChange: (value: string) => void;
    onSyncMentionQuery: (input: HTMLInputElement) => void;
    messageInputRef: RefObject<HTMLInputElement | null>;
    editingMessage: MessengerMessage | null;
    onCancelEdit: () => void;
    replyToMessage: MessengerMessage | null;
    onCancelReply: () => void;
    selectedFiles: File[];
    setSelectedFiles: Dispatch<SetStateAction<File[]>>;
    fileInputRef: RefObject<HTMLInputElement | null>;
    recordedVoiceNote: File | null;
    setRecordedVoiceNote: Dispatch<SetStateAction<File | null>>;
    onVoiceNoteRecorded: (file: File) => void;
    voiceRecorderStatus: VoiceRecorderStatus;
    onVoiceRecorderStatusChange: (status: VoiceRecorderStatus) => void;
    mentionQuery: string | null;
    mentionOptions: MentionOption[];
    onInsertMention: (option: MentionOption) => void;
    sending: boolean;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onOpenPoll: () => void;
    onOpenEvent: () => void;
}) {
    const isEditing = editingMessage !== null;

    return (
        <form
            className="@container shrink-0 border-t border-border bg-card p-4"
            onSubmit={onSubmit}
        >
            {editingMessage && (
                <ComposerContext
                    body={editingMessage.body}
                    label="Editing message"
                    onCancel={onCancelEdit}
                />
            )}
            {replyToMessage && !editingMessage && (
                <ComposerContext
                    body={messagePreview(replyToMessage)}
                    label={`Replying to ${replyToMessage.sender?.id === currentUserId ? 'yourself' : (replyToMessage.sender?.name ?? 'message')}`}
                    onCancel={onCancelReply}
                />
            )}
            {selectedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                    {selectedFiles.map((file, index) => (
                        <span
                            className="inline-flex max-w-full items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs font-medium text-foreground"
                            key={`${file.name}-${file.lastModified}-${index}`}
                        >
                            <FileText className="size-3.5 shrink-0" />
                            <span className="max-w-48 truncate">
                                {file === recordedVoiceNote
                                    ? 'Voice note'
                                    : file.name}
                            </span>
                            <span className="text-muted-foreground">
                                {formatFileSize(file.size)}
                            </span>
                            <button
                                aria-label={`Remove ${file.name}`}
                                className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                                onClick={() => {
                                    setSelectedFiles((files) =>
                                        files.filter(
                                            (_file, fileIndex) =>
                                                fileIndex !== index,
                                        ),
                                    );

                                    if (file === recordedVoiceNote) {
                                        setRecordedVoiceNote(null);
                                    }
                                }}
                                type="button"
                            >
                                <X className="size-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            {recordedVoiceNote && (
                <VoiceNoteDraftPreview file={recordedVoiceNote} />
            )}
            {mentionQuery !== null && mentionOptions.length > 0 && (
                <div className="mb-3 max-h-56 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-lg">
                    {mentionOptions.map((option) => (
                        <button
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted/40"
                            key={option.id}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                onInsertMention(option);
                            }}
                            type="button"
                        >
                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                                {option.id === 'everyone'
                                    ? '@'
                                    : initials(option.label)}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-foreground">
                                    {option.token}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                    {option.description}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
            {/* Narrow columns: text field and Send on their own row above the action icons. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 @xl:flex-nowrap">
                <input
                    className="sr-only"
                    multiple
                    onChange={(event) =>
                        setSelectedFiles((files) =>
                            [
                                ...files,
                                ...Array.from(event.target.files ?? []),
                            ].slice(0, 5),
                        )
                    }
                    ref={fileInputRef}
                    disabled={
                        isEditing ||
                        recordedVoiceNote !== null ||
                        voiceRecorderStatus !== 'idle'
                    }
                    type="file"
                />
                <button
                    aria-label="Attach file"
                    className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={
                        isEditing ||
                        recordedVoiceNote !== null ||
                        voiceRecorderStatus !== 'idle'
                    }
                    type="button"
                >
                    <Paperclip className="size-5" />
                </button>
                <VoiceNoteControls
                    disabled={isEditing || selectedFiles.length > 0 || sending}
                    key={conversationId}
                    onRecorded={onVoiceNoteRecorded}
                    onStatusChange={onVoiceRecorderStatusChange}
                />
                <button
                    aria-label="Create poll"
                    className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-brand"
                    disabled={isEditing || voiceRecorderStatus !== 'idle'}
                    onClick={onOpenPoll}
                    type="button"
                >
                    <ListChecks className="size-5" />
                </button>
                <button
                    aria-label="Create event"
                    className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-brand"
                    disabled={isEditing || voiceRecorderStatus !== 'idle'}
                    onClick={onOpenEvent}
                    type="button"
                >
                    <Calendar className="size-5" />
                </button>
                <input
                    className="order-first h-11 min-w-0 flex-1 basis-[calc(100%-3.5rem)] rounded-xl border border-transparent bg-secondary/70 px-4 text-sm transition outline-none placeholder:text-muted-foreground focus:bg-card focus:ring-4 focus:ring-ring/20 @xl:order-none @xl:basis-auto"
                    onClick={(event) => onSyncMentionQuery(event.currentTarget)}
                    onChange={(event) => onBodyChange(event.target.value)}
                    maxLength={5000}
                    onKeyUp={(event) => onSyncMentionQuery(event.currentTarget)}
                    placeholder="Type a message..."
                    ref={messageInputRef}
                    value={body}
                />
                <button
                    aria-label="Send message"
                    className="order-first grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm transition hover:bg-[#121e41] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground @xl:order-none"
                    disabled={
                        (!body.trim() && selectedFiles.length === 0) ||
                        sending ||
                        voiceRecorderStatus !== 'idle'
                    }
                    type="submit"
                >
                    <Send className="size-5" />
                </button>
            </div>
        </form>
    );
}
