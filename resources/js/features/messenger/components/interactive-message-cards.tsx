import { Calendar, ListChecks, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
    LinkPreview,
    MessageEvent,
    MessengerMessage,
    RsvpStatus,
} from '@/features/messenger/types';

export function PollCard({
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

    const totalVotes = poll.options.reduce(
        (total, option) => total + option.vote_count,
        0,
    );
    const closed =
        poll.closes_at && currentTime !== null
            ? new Date(poll.closes_at).getTime() <= currentTime
            : false;

    return (
        <div className="min-w-64">
            <div className="mb-3 flex items-start gap-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                    <ListChecks className="size-4" />
                </span>
                <div>
                    <p className="font-semibold text-foreground">
                        {poll.question}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {poll.allow_multiple
                            ? 'Choose one or more'
                            : 'Choose one'}
                    </p>
                </div>
            </div>
            <div className="space-y-2">
                {poll.options.map((option) => {
                    const percent =
                        totalVotes > 0
                            ? Math.round((option.vote_count / totalVotes) * 100)
                            : 0;

                    return (
                        <button
                            aria-pressed={option.voted_by_me}
                            className={`relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition ${
                                option.voted_by_me
                                    ? 'border-brand bg-brand/10'
                                    : 'border-border bg-card/70 hover:border-brand/50'
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
                                className="absolute inset-y-0 left-0 bg-brand/10"
                                style={{ width: `${percent}%` }}
                            />
                            <span className="relative flex items-center justify-between gap-3 text-sm">
                                <span className="font-medium">
                                    {option.voted_by_me && '✓ '}
                                    {option.label}
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                    {option.vote_count} · {percent}%
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
                {poll.total_voters}{' '}
                {poll.total_voters === 1 ? 'person voted' : 'people voted'}
                {closed
                    ? ' · Poll closed'
                    : poll.closes_at
                      ? ` · Closes ${formatEventDate(poll.closes_at)}`
                      : ''}
            </p>
        </div>
    );
}

export function EventCard({
    event,
    onRsvp,
}: {
    event: MessageEvent;
    onRsvp: (status: RsvpStatus) => void;
}) {
    const choices: Array<{ status: RsvpStatus; label: string }> = [
        { status: 'attending', label: 'Going' },
        { status: 'maybe', label: 'Maybe' },
        { status: 'declined', label: "Can't go" },
    ];

    return (
        <div className="min-w-64">
            <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
                    <Calendar className="size-5" />
                </span>
                <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                        {event.title}
                    </p>
                    <p className="text-sm font-medium text-brand">
                        {formatEventDate(event.starts_at)}
                    </p>
                    {event.location && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3.5" /> {event.location}
                        </p>
                    )}
                </div>
            </div>
            {event.description && (
                <p className="mt-3 text-sm leading-5 whitespace-pre-wrap text-muted-foreground">
                    {event.description}
                </p>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2">
                {choices.map(({ status, label }) => (
                    <button
                        aria-pressed={event.my_response === status}
                        className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                            event.my_response === status
                                ? 'border-brand bg-brand/15 text-brand'
                                : 'border-border bg-card/70 text-muted-foreground hover:border-brand/50'
                        }`}
                        key={status}
                        onClick={() => onRsvp(status)}
                        title={event.responses[status]
                            .map((user) => user.name)
                            .join(', ')}
                        type="button"
                    >
                        {label} · {event.responses[status].length}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
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

function formatEventDate(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
