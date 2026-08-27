import { Head, Link, usePage } from '@inertiajs/react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { edit } from '@/routes/profile';
import type { Auth } from '@/types';

type PageProps = {
    auth: Auth;
};

export default function Profile({
    stepAccountUrl,
}: {
    stepAccountUrl?: string | null;
}) {
    const { auth } = usePage<PageProps>().props;

    return (
        <>
            <Head title="Profile settings" />

            <h1 className="sr-only">Profile settings</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="STEP profile"
                    description="Your identity and roles are synchronized from STEP each time you sign in."
                />

                <div className="space-y-5 rounded-xl border bg-card p-6">
                    <ReadOnlyField label="Name" value={auth.user.name} />
                    <ReadOnlyField
                        label="Email address"
                        value={auth.user.email}
                    />

                    <div className="grid gap-2">
                        <p className="text-sm font-medium">STEP roles</p>
                        <div className="flex flex-wrap gap-2">
                            {auth.user.step_roles.length > 0 ? (
                                auth.user.step_roles.map((role) => (
                                    <Badge key={role} variant="secondary">
                                        {role}
                                    </Badge>
                                ))
                            ) : (
                                <span className="text-sm text-muted-foreground">
                                    No roles synchronized yet
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
                        <p>
                            Change your name, email, password, or assigned role
                            in STEP. Messenger will refresh them on your next
                            sign-in.
                        </p>
                    </div>

                    {stepAccountUrl && (
                        <Button asChild>
                            <Link href={stepAccountUrl} target="_blank">
                                Manage account in STEP
                                <ExternalLink className="size-4" />
                            </Link>
                        </Button>
                    )}
                </div>
            </div>
        </>
    );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid gap-1">
            <p className="text-sm font-medium">{label}</p>
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {value}
            </p>
        </div>
    );
}

Profile.layout = {
    breadcrumbs: [
        {
            title: 'Profile settings',
            href: edit(),
        },
    ],
};
