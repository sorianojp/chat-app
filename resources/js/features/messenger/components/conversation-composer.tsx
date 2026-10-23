import {
    Check,
    GraduationCap,
    Reply,
    Search,
    UsersRound,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { initials } from '@/features/messenger/lib/format';
import type {
    Contact,
    NewConversationPayload,
    SchoolClassSummary,
} from '@/features/messenger/types';

type ComposerMode = 'direct' | 'group' | 'class';

export function ConversationComposer({
    contacts,
    onClose,
    onCreate,
    onLoadClasses,
    onOpenClassChat,
}: {
    contacts: Contact[];
    onClose: () => void;
    onCreate: (payload: NewConversationPayload) => Promise<boolean>;
    onLoadClasses: () => Promise<SchoolClassSummary[]>;
    onOpenClassChat: (schoolClass: SchoolClassSummary) => Promise<boolean>;
}) {
    const [mode, setMode] = useState<ComposerMode>('direct');
    // Teachers see a Class tab for their STEP classes; others never do.
    const [classes, setClasses] = useState<SchoolClassSummary[]>([]);
    const [openingClassId, setOpeningClassId] = useState<number | null>(null);

    useEffect(() => {
        let active = true;

        onLoadClasses()
            .then((items) => active && setClasses(items))
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, [onLoadClasses]);

    const openClassChat = async (schoolClass: SchoolClassSummary) => {
        setOpeningClassId(schoolClass.id);
        setError(null);

        try {
            if (await onOpenClassChat(schoolClass)) {
                onClose();

                return;
            }

            setError('Could not open that class chat.');
        } finally {
            setOpeningClassId(null);
        }
    };
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

    const chooseMode = (nextMode: ComposerMode) => {
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

        // Class chats are opened from their own row, not by submitting.
        if (mode === 'class' || !canSubmit || submitting) {
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
                    <div
                        className={`grid rounded-xl bg-muted p-1 ${
                            classes.length > 0 ? 'grid-cols-3' : 'grid-cols-2'
                        }`}
                    >
                        {(classes.length > 0
                            ? (['direct', 'group', 'class'] as const)
                            : (['direct', 'group'] as const)
                        ).map((item) => (
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
                                {item === 'direct'
                                    ? 'Direct'
                                    : item === 'group'
                                      ? 'Group'
                                      : 'Class'}
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

                    {mode === 'class' && (
                        <p className="text-xs leading-5 text-muted-foreground">
                            Your STEP classes this semester. Students join the
                            class chat automatically, including those who sign
                            in to Uhoo! later.
                        </p>
                    )}

                    <label
                        className={`h-11 items-center gap-2 rounded-xl bg-muted px-3 text-muted-foreground ${
                            mode === 'class' ? 'hidden' : 'flex'
                        }`}
                    >
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
                    {mode === 'class' ? (
                        classes.map((schoolClass) => (
                            <ClassRow
                                key={schoolClass.id}
                                onOpen={() => void openClassChat(schoolClass)}
                                opening={openingClassId === schoolClass.id}
                                schoolClass={schoolClass}
                            />
                        ))
                    ) : filteredContacts.length > 0 ? (
                        filteredContacts.map((contact) => {
                            const selected = selectedIds.includes(contact.id);

                            return (
                                <button
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-muted/40"
                                    key={contact.id}
                                    onClick={() => toggleContact(contact.id)}
                                    type="button"
                                >
                                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold text-foreground ring-1 ring-border">
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
                                                ? 'border-brand bg-brand-solid text-brand-foreground'
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
                    {mode === 'class' ? (
                        error && (
                            <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                                {error}
                            </p>
                        )
                    ) : (
                        <>
                            {error && (
                                <p className="mb-3 text-sm font-medium text-rose-600 dark:text-rose-400">
                                    {error}
                                </p>
                            )}
                            <button
                                className="h-11 w-full rounded-xl bg-brand-solid px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-solid/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                                disabled={!canSubmit || submitting}
                                type="submit"
                            >
                                {submitting ? 'Creating...' : 'Create'}
                            </button>
                        </>
                    )}
                </div>
            </form>
        </div>
    );
}

function ClassRow({
    schoolClass,
    opening,
    onOpen,
}: {
    schoolClass: SchoolClassSummary;
    opening: boolean;
    onOpen: () => void;
}) {
    const details = [schoolClass.section, schoolClass.subject]
        .filter(Boolean)
        .join(' · ');

    return (
        <div className="flex items-center gap-3 rounded-xl px-3 py-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <GraduationCap className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                    {schoolClass.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                    {details}
                </span>
                <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">
                    {schoolClass.joined_count} of {schoolClass.students_count}{' '}
                    students on Uhoo!
                </span>
            </span>
            <button
                className={`h-9 shrink-0 rounded-xl px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    schoolClass.conversation_id
                        ? 'bg-muted text-foreground hover:bg-muted/70'
                        : 'bg-brand-solid text-brand-foreground hover:bg-brand-solid/90'
                }`}
                disabled={opening}
                onClick={onOpen}
                type="button"
            >
                {opening
                    ? 'Opening...'
                    : schoolClass.conversation_id
                      ? 'Open chat'
                      : 'Start chat'}
            </button>
        </div>
    );
}

export function ComposerContext({
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
