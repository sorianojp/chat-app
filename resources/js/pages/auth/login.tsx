import { Head, Link } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Check,
    GraduationCap,
    LockKeyhole,
    ShieldCheck,
} from 'lucide-react';
import type { ComponentType } from 'react';
import TeamInvitationAlert from '@/components/team-invitation-alert';
import { home } from '@/routes';
import type { TeamInvitationContext } from '@/types';

type Props = {
    status?: string;
    ssoError?: string;
    stepSsoUrl: string;
    teamInvitation?: TeamInvitationContext | null;
};

export default function Login({
    status,
    ssoError,
    stepSsoUrl,
    teamInvitation,
}: Props) {
    return (
        <>
            <Head title="Sign in">
                <meta
                    name="description"
                    content="Sign in to STEP Messenger with your STEP account."
                />
            </Head>

            <main className="min-h-svh bg-background text-foreground">
                <header className="border-b border-border bg-card">
                    <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
                        <Link
                            className="flex items-center gap-3 rounded-lg focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none"
                            href={home()}
                        >
                            <span className="grid size-9 place-items-center rounded-lg bg-brand-solid text-brand-foreground">
                                <GraduationCap className="size-5" />
                            </span>
                            <span className="font-bold tracking-tight">
                                STEP Messenger
                            </span>
                        </Link>

                        <Link
                            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
                            href={home()}
                        >
                            <ArrowLeft className="size-4" />
                            Home
                        </Link>
                    </div>
                </header>

                <section className="mx-auto flex w-full max-w-6xl justify-center px-5 py-12 sm:px-8 sm:py-16">
                    <div className="w-full max-w-md">
                        <div className="mb-7 text-center">
                            <h1 className="text-3xl font-bold tracking-tight">
                                Sign in to Messenger
                            </h1>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Use the same STEP account and role assigned to
                                you by the school.
                            </p>
                        </div>

                        <div className="space-y-6 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
                            {teamInvitation && (
                                <TeamInvitationAlert
                                    invitation={teamInvitation}
                                    action="Sign in"
                                />
                            )}

                            {status && (
                                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                                    <Check className="mt-0.5 size-4 shrink-0" />
                                    {status}
                                </div>
                            )}

                            {ssoError && (
                                <div
                                    aria-live="polite"
                                    className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                                >
                                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                                    {ssoError}
                                </div>
                            )}

                            <div className="flex items-start gap-3 rounded-lg bg-brand/10 p-4 text-sm leading-6 text-foreground">
                                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" />
                                <p>
                                    You will be redirected to STEP to verify
                                    your account, then returned here securely.
                                </p>
                            </div>

                            <a
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-solid px-5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-solid/90 focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none"
                                data-test="step-sso-button"
                                href={stepSsoUrl}
                            >
                                Continue with STEP
                                <ArrowRight className="size-4" />
                            </a>
                        </div>

                        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                            <LockKeyhole className="size-3.5" />
                            Accounts and roles are managed in STEP
                        </p>
                    </div>
                </section>
            </main>
        </>
    );
}

Login.layout = [] as ComponentType[];
