import { Head, Link } from '@inertiajs/react';
import { AlertCircle, ArrowRight, Check, LockKeyhole } from 'lucide-react';
import type { ComponentType } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import TeamInvitationAlert from '@/components/team-invitation-alert';
import { privacy, support } from '@/routes';
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
                    content="Sign in to Uhoo! with your STEP account."
                />
            </Head>

            <main className="flex min-h-svh flex-col bg-background px-4 text-foreground">
                <div className="flex flex-1 items-center justify-center py-10 sm:py-14">
                    <div className="w-full max-w-md">
                        <section
                            aria-labelledby="login-title"
                            className="rounded-[20px] bg-card px-6 py-8 shadow-sm sm:px-9 sm:py-10"
                        >
                            <div className="flex items-center gap-3">
                                <AppLogoIcon className="size-12 rounded-full object-cover" />
                                <div>
                                    <p className="font-heading text-lg leading-tight font-bold">
                                        Uhoo!
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        STEP Messages
                                    </p>
                                </div>
                            </div>

                            <div className="mt-9">
                                <h1
                                    id="login-title"
                                    className="font-heading text-2xl font-bold sm:text-3xl"
                                >
                                    Welcome back
                                </h1>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    Use your STEP account to access your school
                                    conversations.
                                </p>
                            </div>

                            {(teamInvitation || status || ssoError) && (
                                <div className="mt-7 space-y-3">
                                    {teamInvitation && (
                                        <TeamInvitationAlert
                                            invitation={teamInvitation}
                                            action="Sign in"
                                        />
                                    )}

                                    {status && (
                                        <div
                                            aria-live="polite"
                                            className="flex items-start gap-2.5 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                                        >
                                            <Check className="mt-0.5 size-4 shrink-0" />
                                            <span>{status}</span>
                                        </div>
                                    )}

                                    {ssoError && (
                                        <div
                                            role="alert"
                                            className="flex items-start gap-2.5 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200"
                                        >
                                            <AlertCircle className="mt-0.5 size-4 shrink-0" />
                                            <span>{ssoError}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <a
                                className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[#121e41] focus-visible:ring-4 focus-visible:ring-ring/25 dark:hover:bg-[#3c53a9]"
                                data-test="step-sso-button"
                                href={stepSsoUrl}
                            >
                                Continue with STEP
                                <ArrowRight
                                    className="size-4"
                                    aria-hidden="true"
                                />
                            </a>

                            <p className="mt-4 flex items-start justify-center gap-2 text-center text-xs leading-5 text-muted-foreground">
                                <LockKeyhole
                                    className="mt-0.5 size-3.5 shrink-0"
                                    aria-hidden="true"
                                />
                                You’ll sign in securely on STEP and return here.
                            </p>
                        </section>

                        <p className="mt-6 text-center text-sm text-muted-foreground">
                            Having trouble?{' '}
                            <Link
                                href={support()}
                                className="font-semibold text-brand underline-offset-4 hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                Get support
                            </Link>
                        </p>
                    </div>
                </div>

                <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pb-6 text-xs text-muted-foreground">
                    <span>© {new Date().getFullYear()} Arzatechnologies</span>
                    <Link
                        href={privacy()}
                        className="hover:text-foreground focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        Privacy Policy
                    </Link>
                </footer>
            </main>
        </>
    );
}

Login.layout = [] as ComponentType[];
