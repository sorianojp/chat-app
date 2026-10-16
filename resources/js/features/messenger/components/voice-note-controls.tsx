import { Mic, Square, Trash2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useVoiceRecorder } from '@/features/messenger/use-voice-recorder';

function formatDuration(seconds: number): string {
    return `${Math.floor(seconds / 60)
        .toString()
        .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function VoiceNoteControls({
    disabled,
    onRecorded,
    onStatusChange,
}: {
    disabled: boolean;
    onRecorded: (file: File) => void;
    onStatusChange: (
        status: 'idle' | 'requesting' | 'recording' | 'finishing',
    ) => void;
}) {
    const { status, seconds, error, start, stop, cancel } =
        useVoiceRecorder(onRecorded);

    useEffect(() => {
        onStatusChange(status);
    }, [onStatusChange, status]);

    return (
        <div className="relative shrink-0">
            <button
                aria-label="Record voice note"
                className="grid size-10 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled || status !== 'idle'}
                onClick={() => void start()}
                title="Record voice note"
                type="button"
            >
                <Mic className="size-5" />
            </button>
            {(status !== 'idle' || error) && (
                <div
                    aria-live="polite"
                    className="absolute bottom-12 -left-12 z-30 w-[min(19rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-3 text-foreground shadow-xl sm:left-0"
                    role="status"
                >
                    {error ? (
                        <div className="flex items-start gap-2">
                            <p className="min-w-0 flex-1 text-xs leading-5 text-destructive">
                                {error}
                            </p>
                            <button
                                aria-label="Dismiss recording error"
                                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                                onClick={cancel}
                                type="button"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                    ) : status === 'requesting' ? (
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-medium">
                                Allow microphone access to record.
                            </p>
                            <button
                                className="text-xs font-semibold text-brand hover:underline"
                                onClick={cancel}
                                type="button"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : status === 'recording' ? (
                        <>
                            <div className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2 text-sm font-semibold">
                                    <span className="size-2 animate-pulse rounded-full bg-destructive" />
                                    Recording {formatDuration(seconds)}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        aria-label="Discard recording"
                                        className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                                        onClick={cancel}
                                        type="button"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                    <button
                                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                                        onClick={stop}
                                        type="button"
                                    >
                                        <Square className="size-3" /> Stop
                                    </button>
                                </div>
                            </div>
                            <p className="mt-2 text-[11px] text-muted-foreground">
                                Maximum 5 minutes or 18 MB.
                            </p>
                        </>
                    ) : (
                        <p className="text-xs font-medium">
                            Preparing voice note…
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

export function VoiceNoteDraftPreview({ file }: { file: File }) {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const url = URL.createObjectURL(file);
        const audio = audioRef.current;

        if (audio) {
            audio.src = url;
        }

        return () => {
            audio?.removeAttribute('src');
            URL.revokeObjectURL(url);
        };
    }, [file]);

    return (
        <div className="mb-3 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2">
            <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-brand">
                <Mic className="size-3.5" /> Voice note ready to send
            </p>
            <audio
                aria-label="Preview voice note"
                className="w-full"
                controls
                preload="metadata"
                ref={audioRef}
            />
        </div>
    );
}
