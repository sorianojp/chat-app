import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { home } from '@/routes';

const LAST_UPDATED = '21 September 2026';
const CONTACT_EMAIL = 'arzatechnologies@gmail.com';

export default function Privacy() {
    return (
        <>
            <Head title="Privacy Policy">
                <meta
                    name="description"
                    content="How Uhoo! collects, uses, and protects information for school messaging."
                />
            </Head>

            <main className="min-h-screen bg-background text-foreground">
                <header className="border-b border-border bg-card">
                    <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-5 sm:px-8">
                        <Link
                            className="flex items-center gap-3"
                            href={home()}
                        >
                            <AppLogoIcon className="size-10 rounded-lg object-cover" />
                            <span className="font-bold tracking-tight text-foreground">
                                Uhoo!
                            </span>
                        </Link>

                        <Link
                            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                            href={home()}
                        >
                            <ArrowLeft className="size-4" />
                            Back to home
                        </Link>
                    </div>
                </header>

                <article className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                        Privacy Policy
                    </h1>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Last updated {LAST_UPDATED}
                    </p>

                    <p className="mt-6 text-base leading-7 text-muted-foreground">
                        Uhoo! is a messaging app for the Universidad de Dagupan
                        school community. It is operated by Universidad de
                        Dagupan, which is responsible for the information
                        described here. This policy explains what the Uhoo! web
                        app and the Uhoo! apps for Android and iOS collect, why,
                        and what choices you have.
                    </p>

                    <Section title="Information we collect">
                        <p>
                            <Term>Your school account.</Term> You sign in with
                            your STEP account. STEP gives Uhoo! your name,
                            school email address, your role (such as student,
                            teacher, or staff), your department, and your STEP
                            account identifier. Uhoo! never sees your STEP
                            password.
                        </p>
                        <p>
                            <Term>Your conversations.</Term> Messages you send,
                            files and images you attach, reactions, and the
                            groups you belong to are stored so the app can show
                            them to you and the people you are talking with.
                        </p>
                        <p>
                            <Term>Activity needed to run the app.</Term> When
                            you have read a message, whether you muted a
                            conversation, and when you were last active. These
                            power read receipts and unread counts.
                        </p>
                        <p>
                            <Term>Device and technical information.</Term> When
                            you sign in on a phone, we store a notification
                            token for that device, the platform (Android or
                            iOS), and the device name, so notifications reach
                            the right phone. Server sign-in records also include
                            your IP address and browser identification.
                        </p>
                    </Section>

                    <Section title="What we do not collect">
                        <ul className="list-disc space-y-2 pl-5">
                            <li>
                                No advertising, and no advertising identifiers.
                            </li>
                            <li>
                                No analytics or behaviour tracking services.
                            </li>
                            <li>
                                No location data, contacts, calendar,
                                microphone, or camera roll access beyond files
                                you choose to send.
                            </li>
                            <li>
                                We do not sell or rent your information, and we
                                do not use your messages for advertising or to
                                train artificial intelligence systems.
                            </li>
                        </ul>
                    </Section>

                    <Section title="How we use your information">
                        <p>
                            Your information is used only to run the service:
                            delivering messages and files to the right people,
                            showing who is in a conversation, sending
                            notifications, keeping accounts secure, and
                            diagnosing technical problems.
                        </p>
                    </Section>

                    <Section title="Who can see your information">
                        <p>
                            <Term>People in your conversations.</Term> Messages
                            and files are visible to the participants of that
                            conversation, along with your name, role, and
                            department.
                        </p>
                        <p>
                            <Term>School administrators and IT staff.</Term>{' '}
                            Because the school operates Uhoo!, authorised staff
                            can access accounts and stored content when needed
                            to administer, support, or secure the service, and
                            when school policy or law requires it.
                        </p>
                        <p>
                            <Term>Service providers.</Term> Notifications for
                            mobile devices are delivered through Google Firebase
                            Cloud Messaging and Apple Push Notification service.
                            A notification includes the sender&rsquo;s name and
                            a short preview of the message, so that text passes
                            through those services. You can turn off
                            notifications in your device settings.
                        </p>
                        <p>
                            <Term>Legal requests.</Term> We may disclose
                            information if required by law or to protect the
                            safety of members of the school community.
                        </p>
                    </Section>

                    <Section title="Where your information is kept">
                        <p>
                            Messages, files, and accounts are stored on servers
                            operated for Universidad de Dagupan. Traffic between
                            the apps and the server is encrypted in transit.
                            Access to the server is limited to authorised
                            administrators.
                        </p>
                    </Section>

                    <Section title="How long we keep it">
                        <p>
                            Messages and files remain available to the
                            conversation until they are deleted. Account
                            information is kept for as long as you are a member
                            of the school community, and may be retained
                            afterwards where school records policy or law
                            requires it. Notification tokens are removed when
                            you sign out of a device.
                        </p>
                    </Section>

                    <Section title="Students and younger users">
                        <p>
                            Uhoo! is provided to enrolled students and school
                            personnel as part of the school&rsquo;s educational
                            activities. Accounts are created from school
                            records, not by public sign-up. Parents or guardians
                            with questions about a student&rsquo;s account can
                            contact the school using the details below.
                        </p>
                    </Section>

                    <Section title="Your choices and rights">
                        <p>
                            You can ask what information Uhoo! holds about you,
                            ask for corrections, and request deletion of your
                            account and its content, subject to the
                            school&rsquo;s records obligations. Under the
                            Philippine Data Privacy Act of 2012, you also have
                            the right to object to processing and to complain to
                            the National Privacy Commission.
                        </p>
                        <p>
                            To make a request, email us at the address below
                            from your school email account.
                        </p>
                    </Section>

                    <Section title="Changes to this policy">
                        <p>
                            If this policy changes, the new version will be
                            posted on this page with an updated date. Significant
                            changes will be announced in the app.
                        </p>
                    </Section>

                    <Section title="Contact us">
                        <p>
                            For privacy questions, data requests, or account
                            deletion, contact Universidad de Dagupan at{' '}
                            <a
                                className="font-medium text-brand underline underline-offset-4"
                                href={`mailto:${CONTACT_EMAIL}`}
                            >
                                {CONTACT_EMAIL}
                            </a>
                            .
                        </p>
                    </Section>
                </article>

                <footer className="border-t border-border bg-card">
                    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-5 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
                        <p>Uhoo! · Universidad de Dagupan</p>
                        <Link
                            className="transition hover:text-foreground"
                            href={home()}
                        >
                            Home
                        </Link>
                    </div>
                </footer>
            </main>
        </>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="mt-10">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <div className="mt-3 space-y-4 text-base leading-7 text-muted-foreground">
                {children}
            </div>
        </section>
    );
}

function Term({ children }: { children: React.ReactNode }) {
    return <span className="font-medium text-foreground">{children}</span>;
}
