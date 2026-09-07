import { InfoIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { TeamInvitationContext } from '@/types';

type Props = {
    invitation: TeamInvitationContext;
    action: 'Log in' | 'Register' | 'Sign in';
};

export default function TeamInvitationAlert({ invitation, action }: Props) {
    return (
        <Alert data-test="team-invitation-alert" className="bg-muted/50">
            <InfoIcon />
            <AlertDescription>
                {action} to join the "{invitation.teamName}" team.
            </AlertDescription>
        </Alert>
    );
}
