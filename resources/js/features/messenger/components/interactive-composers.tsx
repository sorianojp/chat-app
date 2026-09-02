import { Plus, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import type {
    NewEventPayload,
    NewPollPayload,
} from '@/features/messenger/types';

export function PollComposer({
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
            <form
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"
                onSubmit={submit}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-foreground">
                            Create poll
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Ask the conversation to vote.
                        </p>
                    </div>
                    <button
                        aria-label="Close"
                        className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-4" />
                    </button>
                </div>
                <label className="mt-5 block text-sm font-semibold text-foreground">
                    Question
                    <input
                        autoFocus
                        className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 font-normal outline-none focus:border-brand"
                        maxLength={300}
                        onChange={(event) => setQuestion(event.target.value)}
                        placeholder="What should we choose?"
                        value={question}
                    />
                </label>
                <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold text-foreground">
                        Options
                    </p>
                    {options.map((option, index) => (
                        <div className="flex gap-2" key={index}>
                            <input
                                className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-brand"
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
                                placeholder={`Option ${index + 1}`}
                                value={option}
                            />
                            {options.length > 2 && (
                                <button
                                    aria-label={`Remove option ${index + 1}`}
                                    className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-rose-600"
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
                    {options.length < 10 && (
                        <button
                            className="inline-flex items-center gap-2 text-sm font-semibold text-brand"
                            onClick={() =>
                                setOptions((items) => [...items, ''])
                            }
                            type="button"
                        >
                            <Plus className="size-4" /> Add option
                        </button>
                    )}
                </div>
                <label className="mt-4 flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-3 text-sm font-medium">
                    <input
                        checked={allowMultiple}
                        onChange={(event) =>
                            setAllowMultiple(event.target.checked)
                        }
                        type="checkbox"
                    />
                    Allow multiple choices
                </label>
                <label className="mt-4 block text-sm font-semibold text-foreground">
                    Close voting (optional)
                    <input
                        className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 font-normal outline-none focus:border-brand"
                        min={localDateTimeInputValue(1)}
                        onChange={(event) => setClosesAt(event.target.value)}
                        type="datetime-local"
                        value={closesAt}
                    />
                </label>
                <button
                    className="mt-6 h-11 w-full rounded-xl bg-brand-solid font-semibold text-white disabled:bg-muted"
                    disabled={!canSubmit || submitting}
                    type="submit"
                >
                    {submitting ? 'Creating…' : 'Create poll'}
                </button>
            </form>
        </div>
    );
}

export function EventComposer({
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
            <form
                className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl"
                onSubmit={submit}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-foreground">
                            Create event
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Invite everyone and collect RSVPs.
                        </p>
                    </div>
                    <button
                        aria-label="Close"
                        className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-4" />
                    </button>
                </div>
                <div className="mt-5 space-y-4">
                    <input
                        autoFocus
                        className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-brand"
                        maxLength={200}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Event title"
                        value={title}
                    />
                    <input
                        className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-brand"
                        min={localDateTimeInputValue(1)}
                        onChange={(event) => setStartsAt(event.target.value)}
                        type="datetime-local"
                        value={startsAt}
                    />
                    <input
                        className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-brand"
                        maxLength={240}
                        onChange={(event) => setLocation(event.target.value)}
                        placeholder="Location (optional)"
                        value={location}
                    />
                    <textarea
                        className="min-h-24 w-full rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-brand"
                        maxLength={2000}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Description (optional)"
                        value={description}
                    />
                </div>
                <button
                    className="mt-6 h-11 w-full rounded-xl bg-brand-solid font-semibold text-white disabled:bg-muted"
                    disabled={!canSubmit || submitting}
                    type="submit"
                >
                    {submitting ? 'Creating…' : 'Create event'}
                </button>
            </form>
        </div>
    );
}

function localDateTimeInputValue(minutesAhead = 0) {
    const date = new Date(Date.now() + minutesAhead * 60_000);
    const localTime = new Date(
        date.getTime() - date.getTimezoneOffset() * 60_000,
    );

    return localTime.toISOString().slice(0, 16);
}
