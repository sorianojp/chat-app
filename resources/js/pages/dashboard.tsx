import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Inbox,
    MessageCircle,
    Settings,
    Users,
} from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import PendingInvitationsModal from '@/components/pending-invitations-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { dashboard, messenger } from '@/routes';
import type { Auth, DashboardInvitation, Team } from '@/types';

type Props = {
    pendingInvitations?: DashboardInvitation[];
};

type PageProps = {
    auth: Auth;
    currentTeam: Team | null;
    teams?: Team[];
};

export default function Dashboard({ pendingInvitations = [] }: Props) {
    const { auth, currentTeam, teams = [] } = usePage<PageProps>().props;
    const [showInvitations, setShowInvitations] = useState(
        pendingInvitations.length > 0,
    );
    const hour = new Date().getHours();
    const greeting =
        hour < 12
            ? 'Good morning'
            : hour < 18
              ? 'Good afternoon'
              : 'Good evening';
    const messagesHref = currentTeam
        ? messenger(currentTeam.slug)
        : '/settings/teams';

    return (
        <>
            <Head title="Dashboard" />
            <PendingInvitationsModal
                invitations={pendingInvitations}
                open={pendingInvitations.length > 0 && showInvitations}
                onOpenChange={setShowInvitations}
            />

            <div className="mx-auto w-full max-w-screen-2xl space-y-6 p-4 sm:p-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="font-heading text-2xl font-bold text-foreground">
                                {greeting}, {auth.user.name.split(' ')[0]}
                            </h1>
                            {auth.user.department && (
                                <Badge variant="outline">
                                    {auth.user.department.code ||
                                        auth.user.department.name}
                                </Badge>
                            )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {new Intl.DateTimeFormat(undefined, {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                            }).format(new Date())}
                        </p>
                    </div>
                    <Button asChild>
                        <Link href={messagesHref}>
                            Open messages <ArrowRight />
                        </Link>
                    </Button>
                </header>

                <div className="grid gap-4 md:grid-cols-3">
                    <SummaryCard
                        icon={<MessageCircle />}
                        label="Current workspace"
                        value={currentTeam?.name ?? 'Choose a team'}
                        href={messagesHref}
                    />
                    <SummaryCard
                        icon={<Users />}
                        label="Your teams"
                        value={`${teams.length} ${teams.length === 1 ? 'team' : 'teams'}`}
                        href="/settings/teams"
                    />
                    <SummaryCard
                        icon={<Inbox />}
                        label="Pending invitations"
                        value={`${pendingInvitations.length} waiting`}
                        href="/invitations"
                    />
                </div>

                <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.5fr)]">
                    <div className="relative overflow-hidden rounded-[20px] bg-primary p-6 text-primary-foreground sm:p-8">
                        <div className="absolute -top-16 -right-12 size-48 rounded-full bg-white/10" />
                        <div className="absolute -right-4 -bottom-24 size-56 rounded-full bg-white/5" />
                        <div className="relative max-w-xl">
                            <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-primary-foreground">
                                STEP communication
                            </span>
                            <h2 className="mt-5 font-heading text-2xl font-bold sm:text-3xl">
                                Keep school conversations focused and easy to
                                find.
                            </h2>
                            <p className="mt-3 max-w-lg text-sm leading-6 text-primary-foreground/75 sm:text-base">
                                Continue a conversation, share an update, or
                                check files from your current team.
                            </p>
                            <Button
                                asChild
                                className="mt-6 bg-white text-primary hover:bg-white/90"
                            >
                                <Link href={messagesHref}>
                                    Go to chat <ArrowRight />
                                </Link>
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-[20px] bg-card p-6">
                        <span className="grid size-11 place-items-center rounded-xl bg-muted text-primary">
                            <Settings className="size-5" />
                        </span>
                        <h2 className="mt-5 font-heading text-lg font-bold">
                            Workspace settings
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Review your STEP profile, teams, and appearance
                            preferences.
                        </p>
                        <Button
                            asChild
                            variant="secondary"
                            className="mt-6 w-full"
                        >
                            <Link href="/settings/profile">Open settings</Link>
                        </Button>
                    </div>
                </section>
            </div>
        </>
    );
}

function SummaryCard({
    href,
    icon,
    label,
    value,
}: {
    href: ComponentProps<typeof Link>['href'];
    icon: ReactNode;
    label: string;
    value: string;
}) {
    return (
        <Link
            href={href}
            className="group flex items-center gap-4 rounded-[20px] bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-4 focus-visible:ring-ring/20"
        >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-primary [&>svg]:size-5">
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {label}
                </span>
                <span className="mt-1 block truncate font-heading text-base font-bold">
                    {value}
                </span>
            </span>
            <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
        </Link>
    );
}

Dashboard.layout = (props: { currentTeam?: { slug: string } | null }) => ({
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: props.currentTeam ? dashboard(props.currentTeam.slug) : '/',
        },
    ],
});
