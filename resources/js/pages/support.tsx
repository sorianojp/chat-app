import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, ExternalLink, Mail } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { login, privacy } from '@/routes';

const supportLinks = [
    {
        label: 'Universidad de Dagupan contact page',
        href: 'https://udd.edu.ph/contact-us',
    },
    {
        label: 'Arzatechnologies on Facebook',
        href: 'https://www.facebook.com/arzatechdagupan',
    },
    {
        label: 'STEP LMS on Facebook',
        href: 'https://www.facebook.com/steplms',
    },
    {
        label: 'Universidad de Dagupan on Facebook',
        href: 'https://www.facebook.com/udd1984',
    },
];

export default function Support() {
    return (
        <>
            <Head title="Support">
                <meta
                    name="description"
                    content="Contact Uhoo! support for sign-in, messaging, notifications, and account questions."
                />
            </Head>

            <main className="min-h-screen bg-background text-foreground">
                <header className="bg-card">
                    <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-5 sm:px-8">
                        <Link
                            className="flex items-center gap-3"
                            href={login()}
                        >
                            <AppLogoIcon className="size-10 rounded-full object-cover" />
                            <span className="font-heading font-bold tracking-tight text-foreground">
                                STEP Messages
                            </span>
                        </Link>
                        <Link
                            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                            href={login()}
                        >
                            <ArrowLeft className="size-4" />
                            Sign in
                        </Link>
                    </div>
                </header>

                <article className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
                    <p className="inline-flex rounded-full bg-brand/10 px-3 py-1 text-sm font-bold text-brand">
                        Help for the school community
                    </p>
                    <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                        Uhoo! Support
                    </h1>
                    <p className="mt-5 text-base leading-7 text-muted-foreground">
                        Need help signing in with STEP, sending messages or
                        files, receiving notifications, or using your school
                        account? Contact us using the options below. This page
                        is available without signing in.
                    </p>

                    <section className="mt-10" aria-labelledby="email-heading">
                        <h2
                            id="email-heading"
                            className="text-xl font-semibold tracking-tight"
                        >
                            Email support
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            Tell us what happened, which device you use, and any
                            error message you saw. Please do not send your STEP
                            password.
                        </p>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            <EmailCard
                                label="Uhoo! technical support"
                                address="arzatechnologies@gmail.com"
                            />
                            <EmailCard
                                label="Universidad de Dagupan"
                                address="info@udd.edu.ph"
                            />
                        </div>
                    </section>

                    <section
                        className="mt-12"
                        aria-labelledby="more-contact-heading"
                    >
                        <h2
                            id="more-contact-heading"
                            className="text-xl font-semibold tracking-tight"
                        >
                            Other ways to reach us
                        </h2>
                        <ul className="mt-5 divide-y divide-border overflow-hidden rounded-[20px] bg-card">
                            {supportLinks.map(({ label, href }) => (
                                <li key={href}>
                                    <a
                                        className="flex items-center justify-between gap-4 px-5 py-4 text-sm font-medium transition hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <span>{label}</span>
                                        <ExternalLink
                                            className="size-4 shrink-0 text-muted-foreground"
                                            aria-hidden="true"
                                        />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </section>
                </article>

                <footer className="border-t border-border bg-card">
                    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-5 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
                        <p>Uhoo! · Universidad de Dagupan</p>
                        <div className="flex gap-5">
                            <Link
                                className="transition hover:text-foreground"
                                href={login()}
                            >
                                Sign in
                            </Link>
                            <Link
                                className="transition hover:text-foreground"
                                href={privacy()}
                            >
                                Privacy
                            </Link>
                        </div>
                    </div>
                </footer>
            </main>
        </>
    );
}

function EmailCard({ label, address }: { label: string; address: string }) {
    return (
        <div className="rounded-[20px] bg-card p-5">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <a
                className="mt-3 inline-flex items-center gap-2 font-semibold break-all text-brand underline underline-offset-4 hover:text-foreground"
                href={`mailto:${address}`}
            >
                <Mail className="size-4 shrink-0" aria-hidden="true" />
                {address}
            </a>
        </div>
    );
}
