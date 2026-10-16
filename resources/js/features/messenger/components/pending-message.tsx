import { FileText, RotateCcw, X } from 'lucide-react';

export type PendingOutgoingMessage = {
    clientId: string;
    conversationId: number;
    body: string;
    type: 'voice' | null;
    files: File[];
    replyToMessageId: number | null;
    replyPreview: string | null;
    status: 'sending' | 'failed';
    error: string | null;
};

export function PendingMessage({
    message,
    onDiscard,
    onRetry,
}: {
    message: PendingOutgoingMessage;
    onDiscard: (clientId: string) => void;
    onRetry: (message: PendingOutgoingMessage) => void;
}) {
    return (
        <div
            className="flex flex-col items-end"
            data-client-message-id={message.clientId}
        >
            <div
                className={`max-w-[85%] rounded-2xl rounded-br-md bg-message-outgoing px-4 py-3 text-message-outgoing-foreground shadow-sm md:max-w-[75%] ${message.status === 'sending' ? 'opacity-75' : 'ring-2 ring-destructive/50'}`}
            >
                {message.replyPreview && (
                    <p className="mb-2 border-l-2 border-current/50 pl-2 text-xs opacity-80">
                        Replying to {message.replyPreview}
                    </p>
                )}
                {message.body && (
                    <p className="text-sm break-words whitespace-pre-wrap">
                        {message.body}
                    </p>
                )}
                {message.files.length > 0 && (
                    <div className="mt-2 space-y-1">
                        {message.files.map((file, index) => (
                            <p
                                className="flex items-center gap-2 text-xs"
                                key={`${file.name}-${index}`}
                            >
                                <FileText className="size-3.5 shrink-0" />
                                <span className="truncate">
                                    {message.type === 'voice'
                                        ? 'Voice note'
                                        : file.name}
                                </span>
                            </p>
                        ))}
                    </div>
                )}
            </div>
            <div
                aria-live="polite"
                className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"
            >
                {message.status === 'sending' ? (
                    <span>Sending…</span>
                ) : (
                    <>
                        <span className="text-destructive">
                            {message.error ?? 'Could not send message.'}
                        </span>
                        <button
                            className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                            onClick={() => onRetry(message)}
                            type="button"
                        >
                            <RotateCcw className="size-3" /> Retry
                        </button>
                        <button
                            aria-label="Discard failed message"
                            className="rounded-full p-1 hover:bg-muted"
                            onClick={() => onDiscard(message.clientId)}
                            type="button"
                        >
                            <X className="size-3.5" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
