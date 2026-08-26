import { Form, Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    GraduationCap,
    LockKeyhole,
} from 'lucide-react';
import type { ComponentType } from 'react';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import TeamInvitationAlert from '@/components/team-invitation-alert';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { home, register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';
import type { TeamInvitationContext } from '@/types';

type Props = {
    status?: string;
    canResetPassword: boolean;
    teamInvitation?: TeamInvitationContext | null;
};

export default function Login({
    status,
    canResetPassword,
    teamInvitation,
}: Props) {
    return (
        <>
            <Head title="Log in">
                <meta
                    name="description"
                    content="Log in to STEP Messenger to continue to your school community."
                />
            </Head>

            <main className="min-h-svh bg-slate-50 text-slate-950">
                <header className="border-b border-slate-200 bg-white">
                    <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
                        <Link
                            className="flex items-center gap-3 rounded-lg focus-visible:ring-3 focus-visible:ring-blue-200 focus-visible:outline-none"
                            href={home()}
                        >
                            <span className="grid size-9 place-items-center rounded-lg bg-blue-700 text-white">
                                <GraduationCap className="size-5" />
                            </span>
                            <span className="font-bold tracking-tight">
                                STEP Messenger
                            </span>
                        </Link>

                        <Link
                            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
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
                                Log in to your account
                            </h1>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Enter your details to continue to STEP
                                Messenger.
                            </p>
                        </div>

                        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                            {teamInvitation && (
                                <TeamInvitationAlert
                                    invitation={teamInvitation}
                                    action="Log in"
                                />
                            )}

                            {status && (
                                <div
                                    aria-live="polite"
                                    className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800"
                                >
                                    <Check className="mt-0.5 size-4 shrink-0" />
                                    {status}
                                </div>
                            )}

                            <div className="[&_button]:h-11 [&_button]:rounded-lg [&_button]:border-slate-300 [&_button]:font-semibold [&_button]:text-slate-700 [&_button]:shadow-none [&_button]:hover:bg-slate-50">
                                <PasskeyVerify separator="Or use your email" />
                            </div>

                            <Form
                                {...store.form()}
                                resetOnSuccess={['password']}
                                className="grid gap-5"
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label
                                                className="text-sm font-semibold text-slate-800"
                                                htmlFor="email"
                                            >
                                                Email address
                                            </Label>
                                            <Input
                                                autoComplete="email"
                                                autoFocus
                                                className="h-11 rounded-lg border-slate-300 bg-white px-3 text-slate-950 shadow-none placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-blue-100"
                                                id="email"
                                                name="email"
                                                placeholder="you@school.edu"
                                                required
                                                tabIndex={1}
                                                type="email"
                                            />
                                            <InputError
                                                message={errors.email}
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <div className="flex items-center justify-between gap-4">
                                                <Label
                                                    className="text-sm font-semibold text-slate-800"
                                                    htmlFor="password"
                                                >
                                                    Password
                                                </Label>
                                                {canResetPassword && (
                                                    <TextLink
                                                        className="text-sm font-medium text-blue-700 no-underline hover:underline"
                                                        href={request()}
                                                        tabIndex={5}
                                                    >
                                                        Forgot password?
                                                    </TextLink>
                                                )}
                                            </div>
                                            <PasswordInput
                                                autoComplete="current-password"
                                                className="h-11 rounded-lg border-slate-300 bg-white px-3 text-slate-950 shadow-none placeholder:text-slate-400 focus-visible:border-blue-600 focus-visible:ring-blue-100"
                                                id="password"
                                                name="password"
                                                placeholder="Enter your password"
                                                required
                                                tabIndex={2}
                                            />
                                            <InputError
                                                message={errors.password}
                                            />
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                className="border-slate-300 data-[state=checked]:border-blue-700 data-[state=checked]:bg-blue-700"
                                                id="remember"
                                                name="remember"
                                                tabIndex={3}
                                            />
                                            <Label
                                                className="cursor-pointer text-sm font-medium text-slate-600"
                                                htmlFor="remember"
                                            >
                                                Remember me
                                            </Label>
                                        </div>

                                        <Button
                                            className="h-11 w-full rounded-lg bg-blue-700 text-sm font-semibold text-white shadow-none hover:bg-blue-800 focus-visible:ring-blue-200"
                                            data-test="login-button"
                                            disabled={processing}
                                            tabIndex={4}
                                            type="submit"
                                        >
                                            {processing ? (
                                                <>
                                                    <Spinner /> Logging in…
                                                </>
                                            ) : (
                                                <>
                                                    Log in
                                                    <ArrowRight className="size-4" />
                                                </>
                                            )}
                                        </Button>
                                    </>
                                )}
                            </Form>
                        </div>

                        <p className="mt-6 text-center text-sm text-slate-600">
                            Need an account?{' '}
                            <TextLink
                                className="font-semibold text-blue-700 no-underline hover:underline"
                                data-test="register-link"
                                href={register({
                                    query: {
                                        invitation: teamInvitation?.code,
                                    },
                                })}
                                tabIndex={6}
                            >
                                Create one
                            </TextLink>
                        </p>

                        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                            <LockKeyhole className="size-3.5" />
                            Secure account access
                        </p>
                    </div>
                </section>
            </main>
        </>
    );
}

Login.layout = [] as ComponentType[];
