import { Head, router } from '@inertiajs/react';
import { Check, Clock, Inbox, X } from 'lucide-react';
import { useState } from 'react';
import TeamInvitationController from '@/actions/App/Http/Controllers/Teams/TeamInvitationController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ReceivedInvitation } from '@/types';

type Props = {
    invitations: ReceivedInvitation[];
};

export default function InvitationsIndex({ invitations }: Props) {
    const [processingCode, setProcessingCode] = useState<string | null>(null);

    const acceptInvitation = (invitation: ReceivedInvitation) => {
        router.visit(TeamInvitationController.accept(invitation), {
            onStart: () => setProcessingCode(invitation.code),
            onFinish: () => setProcessingCode(null),
        });
    };

    const declineInvitation = (invitation: ReceivedInvitation) => {
        router.visit(TeamInvitationController.decline(invitation), {
            onStart: () => setProcessingCode(invitation.code),
            onFinish: () => setProcessingCode(null),
        });
    };

    return (
        <>
            <Head title="Team Invitations" />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Team Invitations
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Team invitations sent to your account.
                        </p>
                    </div>
                    {invitations.length > 0 && (
                        <Badge variant="secondary">
                            {invitations.length}{' '}
                            {invitations.length === 1
                                ? 'team invitation'
                                : 'team invitations'}
                        </Badge>
                    )}
                </div>

                {invitations.length > 0 ? (
                    <div className="grid gap-3">
                        {invitations.map((invitation) => (
                            <InvitationRow
                                invitation={invitation}
                                key={invitation.code}
                                onAccept={acceptInvitation}
                                onDecline={declineInvitation}
                                processing={processingCode === invitation.code}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed bg-background px-6 text-center">
                        <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                            <Inbox className="size-6" />
                        </span>
                        <h2 className="mt-4 text-base font-semibold">
                            No team invitations
                        </h2>
                        <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                            Team invitations sent to your email address will
                            appear here.
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}

function InvitationRow({
    invitation,
    onAccept,
    onDecline,
    processing,
}: {
    invitation: ReceivedInvitation;
    onAccept: (invitation: ReceivedInvitation) => void;
    onDecline: (invitation: ReceivedInvitation) => void;
    processing: boolean;
}) {
    const pending = invitation.status === 'pending';

    return (
        <div
            className="flex flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-xs md:flex-row md:items-center md:justify-between"
            data-test="invitation-row"
        >
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold">
                        {invitation.team.name}
                    </h2>
                    <InvitationStatus status={invitation.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                    {invitation.inviterName} invited you as{' '}
                    {invitation.roleLabel.toLowerCase()}.
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatDate(invitation.createdAt)}</span>
                    {invitation.expiresAt && pending && (
                        <span>Expires {formatDate(invitation.expiresAt)}</span>
                    )}
                </div>
            </div>

            {pending && (
                <div className="flex shrink-0 items-center gap-2 md:justify-end">
                    <Button
                        data-test="invitation-decline"
                        disabled={processing}
                        onClick={() => onDecline(invitation)}
                        type="button"
                        variant="secondary"
                    >
                        <X className="size-4" />
                        Decline
                    </Button>
                    <Button
                        data-test="invitation-accept"
                        disabled={processing}
                        onClick={() => onAccept(invitation)}
                        type="button"
                    >
                        <Check className="size-4" />
                        Accept
                    </Button>
                </div>
            )}
        </div>
    );
}

function InvitationStatus({
    status,
}: {
    status: ReceivedInvitation['status'];
}) {
    if (status === 'accepted') {
        return (
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                Accepted
            </Badge>
        );
    }

    if (status === 'expired') {
        return <Badge variant="secondary">Expired</Badge>;
    }

    return (
        <Badge className="border-sky-200 bg-sky-50 text-sky-700">
            <Clock className="size-3" />
            Pending
        </Badge>
    );
}

function formatDate(value: string | null) {
    if (!value) {
        return 'No date';
    }

    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(value));
}

InvitationsIndex.layout = () => ({
    breadcrumbs: [
        {
            title: 'Team Invitations',
            href: '/invitations',
        },
    ],
});
