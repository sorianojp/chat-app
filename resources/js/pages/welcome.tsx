import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Check,
    CheckCheck,
    GraduationCap,
    MessageCircle,
} from 'lucide-react';
import { login, messenger, register } from '@/routes';
import type { User } from '@/types';

type WelcomeProps = {
    auth: {
        user: User | null;
    };
    currentTeam: {
        slug: string;
    } | null;
};

export default function Welcome() {
    const { auth, currentTeam } = usePage<WelcomeProps>().props;
    const isAuthenticated = auth.user !== null;
    const appHref = currentTeam
        ? messenger(currentTeam.slug)
        : '/settings/teams';

    return (
        <>
            <Head title="STEP Messenger">
                <meta
                    name="description"
                    content="STEP Messenger keeps school conversations and updates in one place."
                />
            </Head>

            <main className="min-h-screen bg-slate-50 text-slate-950">
                <header className="border-b border-slate-200 bg-white">
                    <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
                        <Brand />

                        <div className="flex items-center gap-2">
                            {!isAuthenticated && (
                                <Link
                                    className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                                    href={login()}
                                >
                                    Log in
                                </Link>
                            )}
                            <Link
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:ring-3 focus-visible:ring-blue-200 focus-visible:outline-none"
                                href={isAuthenticated ? appHref : register()}
                            >
                                {isAuthenticated
                                    ? 'Open messenger'
                                    : 'Create account'}
                                <ArrowRight className="size-4" />
                            </Link>
                        </div>
                    </div>
                </header>

                <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 lg:min-h-[calc(100vh-129px)] lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
                    <div className="max-w-xl">
                        <p className="text-sm font-semibold text-blue-700">
                            School communication in one place
                        </p>
                        <h1 className="mt-4 text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
                            Stay connected with your school community.
                        </h1>
                        <p className="mt-5 text-lg leading-8 text-slate-600">
                            STEP Messenger helps teachers, staff, and families
                            share messages, class updates, and files without the
                            clutter.
                        </p>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Link
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:ring-3 focus-visible:ring-blue-200 focus-visible:outline-none"
                                href={isAuthenticated ? appHref : login()}
                            >
                                {isAuthenticated
                                    ? 'Go to your messages'
                                    : 'Log in to STEP'}
                                <ArrowRight className="size-4" />
                            </Link>
                            {!isAuthenticated && (
                                <Link
                                    className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-slate-200 focus-visible:outline-none"
                                    href={register()}
                                >
                                    Create account
                                </Link>
                            )}
                        </div>

                        <ul className="mt-8 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                            {[
                                'Direct and group messaging',
                                'Mentions and read receipts',
                                'Shared files and links',
                                'Private team access',
                            ].map((item) => (
                                <li
                                    className="flex items-center gap-2"
                                    key={item}
                                >
                                    <Check className="size-4 text-emerald-600" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <MessengerPreview />
                </section>

                <footer className="border-t border-slate-200 bg-white">
                    <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-col justify-center gap-1 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                        <span className="font-semibold text-slate-700">
                            STEP Messenger
                        </span>
                        <span>
                            Simple communication for school communities.
                        </span>
                    </div>
                </footer>
            </main>
        </>
    );
}

function Brand() {
    return (
        <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-blue-700 text-white">
                <GraduationCap className="size-5" />
            </span>
            <span className="font-bold tracking-tight text-slate-900">
                STEP Messenger
            </span>
        </div>
    );
}

function MessengerPreview() {
    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-lg bg-blue-100 text-xs font-bold text-blue-800">
                        10A
                    </span>
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">
                            Grade 10 · Section A
                        </h2>
                        <p className="text-xs text-slate-500">
                            28 parents and teachers
                        </p>
                    </div>
                </div>
                <MessageCircle className="size-5 text-slate-400" />
            </div>

            <div className="space-y-5 bg-slate-50 p-5 sm:p-7">
                <div className="max-w-[82%]">
                    <p className="mb-1 text-xs font-medium text-slate-500">
                        Mrs. Cruz · Adviser
                    </p>
                    <div className="rounded-xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                        Good morning. The project outline is due this Friday. I
                        pinned the checklist for everyone.
                    </div>
                    <p className="mt-1 text-xs text-slate-400">8:42 AM</p>
                </div>

                <div className="ml-auto max-w-[78%]">
                    <div className="rounded-xl rounded-br-sm bg-blue-700 px-4 py-3 text-sm leading-6 text-white">
                        Thank you. We have received the checklist.
                    </div>
                    <p className="mt-1 flex items-center justify-end gap-1 text-xs text-blue-700">
                        <CheckCheck className="size-3.5" /> Seen
                    </p>
                </div>

                <div className="max-w-[72%] rounded-xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    Noted. Thank you for the reminder.
                </div>
            </div>

            <div className="flex items-center gap-3 border-t border-slate-200 p-4">
                <div className="flex h-10 flex-1 items-center rounded-lg bg-slate-100 px-3 text-sm text-slate-400">
                    Write a message…
                </div>
                <span className="grid size-10 place-items-center rounded-lg bg-blue-700 text-white">
                    <ArrowRight className="size-4" />
                </span>
            </div>
        </div>
    );
}
